import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getDoc, patchDoc } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import type {
  AgentRecord,
  AgentType,
  ConfigEnvelope,
  JsonObject,
} from "./types/contracts";

// ---------------------------------------------------------------------------
// Browser Use API helpers
// ---------------------------------------------------------------------------

const BROWSER_USE_API_URL = "https://api.browser-use.com/api/v1";

function buildTaskPrompt(agentType: AgentType, config: ConfigEnvelope): string {
  const currentConfig = (config.currentConfig ?? config.defaultConfig) as JsonObject;
  const targetUrl = (currentConfig.targetUrl as string) ?? "";

  switch (agentType) {
    case "scholar": {
      const sources = (currentConfig.sources as string[]) ?? ["UT Scholarships"];
      const major = ((currentConfig.profile as JsonObject)?.major as string) ?? "Computer Science";
      return `You are a scholarship discovery agent for a UT Austin ${major} student.

GOAL: Navigate to the scholarship search page and find relevant scholarships.

1. Navigate to ${targetUrl || "https://utexas.scholarships.ngwebsolutions.com/ScholarX_StudentLanding.aspx"}.
2. Search through available scholarships.
3. For each scholarship found, note: title, deadline, eligibility requirements, and application link.
4. Report back a summary of all scholarships found with their details.

Sources to check: ${sources.join(", ")}`;
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

async function callBrowserUseAPI(
  apiKey: string,
  taskPrompt: string
): Promise<{ taskId: string; liveUrl: string }> {
  const response = await fetch(`${BROWSER_USE_API_URL}/run-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      task: taskPrompt,
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
  const response = await fetch(`${BROWSER_USE_API_URL}/task/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
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

    const taskPrompt = buildTaskPrompt(
      args.agentType as AgentType,
      args.config as ConfigEnvelope
    );

    try {
      const { taskId, liveUrl } = await callBrowserUseAPI(apiKey, taskPrompt);

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
