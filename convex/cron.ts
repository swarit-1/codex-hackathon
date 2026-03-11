import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { patchDoc, queryByIndex } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import { toAgentRecord } from "./lib/records";
import { getNextCronTime } from "./lib/cronParser";
import type { AgentRecord } from "./types/contracts";

/**
 * Internal mutation that checks for agents due for scheduled execution.
 * Called by the Convex cron job defined in crons.ts every minute.
 */
export const checkScheduledAgents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Query active agents using the scheduler index
    const activeAgents = await queryByIndex<Omit<AgentRecord, "id">>(
      ctx,
      "agents",
      "by_status_nextRunAt",
      [["status", "active"]]
    );

    const dueAgents = activeAgents
      .map((doc) => toAgentRecord(doc as any))
      .filter(
        (agent) =>
          agent.schedule.enabled &&
          agent.nextRunAt !== undefined &&
          agent.nextRunAt <= now &&
          agent.lastRunStatus !== "running"
      );

    let triggeredCount = 0;

    for (const agent of dueAgents) {
      const nextRunAt = getNextCronTime(
        agent.schedule.cron,
        now,
        agent.schedule.timezone
      );

      await patchDoc(ctx, agent.id, {
        lastRunStatus: "running",
        lastRunAt: now,
        nextRunAt,
        updatedAt: now,
      });

      await appendAgentLog(ctx, {
        agentId: agent.id,
        event: "agent.scheduler.triggered",
        details: {
          runType: "scheduled",
          triggeredAt: now,
          nextRunAt,
        },
      });

      // Launch the actual Browser Use task
      await ctx.scheduler.runAfter(0, internal.runtime.launchBrowserTask, {
        agentId: agent.id,
        agentType: agent.type,
        config: agent.config,
      });

      triggeredCount++;
    }

    return { triggered: triggeredCount, checked: activeAgents.length };
  },
});
