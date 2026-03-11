import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { patchDoc } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import {
  buildTaskPrompt,
  resolveBrowserUseRuntimeModeFromEnv,
} from "./lib/runtimePrompt";
import type {
  AgentType,
  ConfigEnvelope,
} from "./types/contracts";

// ---------------------------------------------------------------------------
// Browser Use API helpers
// ---------------------------------------------------------------------------

const BROWSER_USE_API_URL = "https://api.browser-use.com/api/v2";


function buildTaskPrompt(agentType: AgentType, config: ConfigEnvelope): string {
  const currentConfig = (config.currentConfig ?? config.defaultConfig) as JsonObject;
  const targetUrl = (currentConfig.targetUrl as string) ?? "";

  switch (agentType) {
    case "scholar": {
      const major = ((currentConfig.profile as JsonObject)?.major as string) ?? "Computer Science";
      const startUrl = targetUrl || "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search";
      return `You are a browser automation agent helping a UT Austin student apply to a scholarship.

GOAL: Navigate to the scholarship search page, find the "CREEES McWilliams Scholarship", \
click its "Apply Now" button, and then fill out the entire scholarship application \
form across all pages — but DO NOT submit at the end.

Step-by-step instructions:

1. You should already be on ${startUrl}. Wait for the page to fully load.

2. Look through the list of scholarships on the page for "CREEES McWilliams Scholarship". \
   You may need to scroll down or paginate through results to find it. \
   Once you find it, click the "Apply Now" button next to it.

3. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID and password if credentials are provided.
   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear (e.g. click "Send Me a Push" \
     or approve via the Duo app — wait for it to complete).
   - After login, you should be redirected back to the scholarship application.

4. Once on the scholarship application form, fill out ALL available fields on \
   each page. Use reasonable values for a UT Austin undergraduate ${major} student. \
   For text fields that ask for essays or explanations, write 2-3 thoughtful sentences.

5. After completing all fields on a page, click "Next", "Continue", or the next \
   step/page button to proceed.

6. Continue filling out ALL pages of the application.

7. On the FINAL page/step, STOP. Do NOT click "Submit", "Finish", or any button \
   that would finalize/submit the application.

8. Report back what fields you found on each page and what values you entered.

CRITICAL RULES:
- DO NOT click any Submit or Finish button that would finalize the application.
- Fill out EVERY field on EVERY page before moving to the next page.
- If a dropdown does not have an exact match, pick the closest available option.
- Take your time and be thorough — fill ALL fields before proceeding.`;
    }

    case "reg": {
      const courseNumber = (currentConfig.courseNumber as string) ?? "";
      const uniqueId = (currentConfig.uniqueId as string) ?? "";
      const semester = (currentConfig.semester as string) ?? "";
      return `You are a class registration monitor for a UT Austin student.

GOAL: Check if a seat is available for ${courseNumber} (Unique ID: ${uniqueId}) for ${semester}.

1. Navigate to ${targetUrl || "https://utdirect.utexas.edu/registration/classlist/nologin/"}.
2. Search for course ${courseNumber} with unique ID ${uniqueId}.
3. Check if there are any open seats available.
4. Report the current enrollment status: total seats, seats taken, seats available, and waitlist count if any.`;
    }

    case "custom":
    default: {
      const taskDescription = (currentConfig.taskDescription as string) ?? "";
      if (taskDescription) {
        return taskDescription;
      }
      if (targetUrl) {
        return `Navigate to ${targetUrl} and report what you find on the page.`;
      }
      return "No task configured for this agent.";
    }
  }
}

// Browser profile with saved cookies/auth for UT Austin sites
const BROWSER_USE_PROFILE_ID = "bcf273d4-abc4-40c4-b506-8ad330d4c678";

async function callBrowserUseAPI(
  apiKey: string,
  taskPrompt: string,
  startUrl?: string
): Promise<{ taskId: string; liveUrl: string }> {
  const response = await fetch(`${BROWSER_USE_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Browser-Use-API-Key": apiKey,
    },
    body: JSON.stringify({
      task: taskPrompt,
      sessionSettings: {
        profileId: BROWSER_USE_PROFILE_ID,
        proxyCountryCode: "us",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browser Use API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    taskId: data.id ?? data.task_id ?? "",
    liveUrl: data.live_url ?? `https://cloud.browser-use.com/tasks/${data.id ?? data.task_id ?? ""}`,
  };
}

async function pollBrowserUseTask(
  apiKey: string,
  taskId: string
): Promise<{ status: string; output?: string; steps?: unknown[] }> {
  const response = await fetch(`${BROWSER_USE_API_URL}/tasks/${taskId}`, {
    method: "GET",
    headers: {
      "X-Browser-Use-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browser Use API poll error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    status: data.status ?? "unknown",
    output: data.output ?? data.result,
    steps: data.steps,
  };
}

// ---------------------------------------------------------------------------
// Internal mutation: update agent after runtime launch
// ---------------------------------------------------------------------------

export const updateAgentRunStatus = internalMutation({
  args: {
    agentId: v.string(),
    browserUseTaskId: v.optional(v.string()),
    lastRunStatus: v.string(),
    liveUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const patch: Record<string, unknown> = {
      lastRunStatus: args.lastRunStatus,
      updatedAt: timestamp,
    };

    if (args.browserUseTaskId) {
      patch.browserUseTaskId = args.browserUseTaskId;
    }

    if (args.lastRunStatus === "failed" || args.lastRunStatus === "succeeded") {
      patch.status = args.lastRunStatus === "failed" ? "error" : "active";
    }

    await patchDoc(ctx, args.agentId, patch);

    const event =
      args.lastRunStatus === "failed"
        ? "agent.runtime.launch_failed"
        : args.lastRunStatus === "succeeded"
          ? "agent.runtime.completed"
          : "agent.runtime.launched";

    const titleMap: Record<string, string> = {
      "agent.runtime.launched": "Agent started",
      "agent.runtime.launch_failed": "Agent failed to start",
      "agent.runtime.completed": "Agent completed",
    };
    const detailMap: Record<string, string> = {
      "agent.runtime.launched": args.liveUrl
        ? `Browser task launched. Watch live: ${args.liveUrl}`
        : "Browser task launched successfully.",
      "agent.runtime.launch_failed": args.error ?? "Unknown error",
      "agent.runtime.completed": "Browser task finished successfully.",
    };

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event,
      level: args.lastRunStatus === "failed" ? "error" : "info",
      details: {
        title: titleMap[event] ?? event,
        detail: detailMap[event] ?? "",
        browserUseTaskId: args.browserUseTaskId,
        liveUrl: args.liveUrl,
        error: args.error,
        updatedAt: timestamp,
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Internal action: launch a Browser Use task for an agent
// ---------------------------------------------------------------------------

export const launchBrowserTask = internalAction({
  args: {
    agentId: v.string(),
    agentType: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BROWSER_USE_API_KEY;

    if (!apiKey) {
      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        lastRunStatus: "failed",
        error: "BROWSER_USE_API_KEY is not configured",
      });
      return;
    }

    const runtimeMode = resolveBrowserUseRuntimeModeFromEnv();
    const { taskPrompt, startUrl } = buildTaskPrompt(
      args.agentType as AgentType,
      args.config as ConfigEnvelope,
      runtimeMode
    );

    try {
      const { taskId, liveUrl } = await callBrowserUseAPI(apiKey, taskPrompt, startUrl);

      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        browserUseTaskId: taskId,
        lastRunStatus: "running",
        liveUrl,
      });

      // Schedule polling to check when the task completes
      await ctx.scheduler.runAfter(15_000, internal.runtime.pollTaskStatus, {
        agentId: args.agentId,
        taskId,
        attempt: 1,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        lastRunStatus: "failed",
        error: message,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Internal action: poll Browser Use for task completion
// ---------------------------------------------------------------------------

const MAX_POLL_ATTEMPTS = 60; // ~15 minutes at 15s intervals
const POLL_INTERVAL_MS = 15_000;

export const pollTaskStatus = internalAction({
  args: {
    agentId: v.string(),
    taskId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BROWSER_USE_API_KEY;

    if (!apiKey) {
      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        lastRunStatus: "failed",
        error: "BROWSER_USE_API_KEY not available for polling",
      });
      return;
    }

    try {
      const result = await pollBrowserUseTask(apiKey, args.taskId);

      if (result.status === "completed" || result.status === "finished" || result.status === "done") {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          browserUseTaskId: args.taskId,
          lastRunStatus: "succeeded",
        });

        // Log the output
        await ctx.runMutation(internal.runtime.logTaskOutput, {
          agentId: args.agentId,
          taskId: args.taskId,
          output: result.output ?? "Task completed with no output",
        });
        return;
      }

      if (result.status === "failed" || result.status === "error") {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          browserUseTaskId: args.taskId,
          lastRunStatus: "failed",
          error: result.output ?? "Browser Use task failed",
        });
        return;
      }

      // Still running — schedule another poll if under the limit
      if (args.attempt < MAX_POLL_ATTEMPTS) {
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.runtime.pollTaskStatus, {
          agentId: args.agentId,
          taskId: args.taskId,
          attempt: args.attempt + 1,
        });
      } else {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          browserUseTaskId: args.taskId,
          lastRunStatus: "failed",
          error: `Task timed out after ${MAX_POLL_ATTEMPTS} poll attempts`,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Retry on transient errors
      if (args.attempt < MAX_POLL_ATTEMPTS) {
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.runtime.pollTaskStatus, {
          agentId: args.agentId,
          taskId: args.taskId,
          attempt: args.attempt + 1,
        });
      } else {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          lastRunStatus: "failed",
          error: `Polling failed after ${MAX_POLL_ATTEMPTS} attempts: ${message}`,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: log task output
// ---------------------------------------------------------------------------

export const logTaskOutput = internalMutation({
  args: {
    agentId: v.string(),
    taskId: v.string(),
    output: v.string(),
  },
  handler: async (ctx, args) => {
    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.runtime.task_output",
      details: {
        title: "Agent output received",
        detail: args.output.length > 200 ? args.output.slice(0, 200) + "..." : args.output,
        browserUseTaskId: args.taskId,
        output: args.output,
      },
    });
  },
});
