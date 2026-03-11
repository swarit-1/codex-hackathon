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

// Browser profile with saved cookies/auth for UT Austin sites
const BROWSER_USE_PROFILE_ID = "bcf273d4-abc4-40c4-b506-8ad330d4c678";

async function callBrowserUseAPI(
  apiKey: string,
  taskPrompt: string,
  startUrl?: string
): Promise<{ taskId: string; liveUrl: string }> {
  const payload: Record<string, unknown> = {
    task: taskPrompt,
    sessionSettings: {
      profileId: BROWSER_USE_PROFILE_ID,
      proxyCountryCode: "us",
    },
  };
  if (startUrl && startUrl.trim().length > 0) {
    payload.start_url = startUrl;
    payload.startUrl = startUrl;
  }

  const response = await fetch(`${BROWSER_USE_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Browser-Use-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
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
    runId: v.optional(v.string()),
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
