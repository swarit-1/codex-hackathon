import { mutation } from "./_generated/server";
import {
  getDoc,
  patchDoc,
  queryByIndexRecent,
} from "./lib/db";
import { notFoundError } from "./lib/errors";
import { appendAgentLog } from "./lib/logging";
import { createAgentRun } from "./lib/agentRuns";
import { getAgentOrThrow } from "./lib/agentUtils";
import {
  deriveLifecycleStatusFromRunStatus,
  deriveNextRunAt,
  deriveTriggerSource,
  isDuplicateWebhookEvent,
  normalizeRuntimeWebhookPayload,
  assertPendingActionReadyForResume,
} from "./lib/orchestrator";
import { toAgentLogRecord, toPendingActionRecord } from "./lib/records";
import {
  buildAgentOperationEvent,
  buildRuntimeHandoffPayload,
} from "./lib/runControl";
import {
  orchestratorHandleWebhookArgs,
  orchestratorResumeFromPendingActionArgs,
  orchestratorTriggerAgentRunArgs,
} from "./lib/validators";
import type {
  AgentLogRecord,
  AgentRecord,
  OrchestratorResumeResult,
  OrchestratorTriggerRunResult,
  OrchestratorWebhookResult,
  PendingActionRecord,
  RuntimeRunType,
  RuntimeWebhookPayload,
} from "./types/contracts";

function buildRunNowEvent(
  agent: AgentRecord,
  runType: RuntimeRunType,
  requestedAt: number,
  requestedByUserId?: string
) {
  const source = deriveTriggerSource(runType);
  const alreadyRunning = agent.lastRunStatus === "running";
  const operationEvent = buildAgentOperationEvent({
    agentId: agent.id,
    operation: runType === "scheduled" ? "schedule_update" : "run_now",
    status: alreadyRunning ? "deferred" : "accepted",
    source,
    emittedAt: requestedAt,
    message: alreadyRunning
      ? "runtime trigger ignored because agent is already running"
      : "runtime trigger accepted for downstream processing",
  });
  const handoffPayload = buildRuntimeHandoffPayload({
    agentId: agent.id,
    runType,
    source,
    requestedAt,
    requestedByUserId,
    schedule: agent.schedule,
  });

  return {
    alreadyRunning,
    operationEvent,
    handoffPayload,
  };
}

// NOTE: These are mutations (not actions) because they only perform DB operations.
// When runtime integration requires external HTTP calls, refactor to actions
// that call internal mutations for DB writes via ctx.runMutation.

export const triggerAgentRun = mutation({
  args: orchestratorTriggerAgentRunArgs,
  handler: async (ctx, args): Promise<OrchestratorTriggerRunResult> => {
    const agent = await getAgentOrThrow(ctx, args.agentId);
    const requestedAt = Date.now();
    const { alreadyRunning, operationEvent, handoffPayload } = buildRunNowEvent(
      agent,
      args.runType,
      requestedAt,
      agent.userId
    );
    let run: Awaited<ReturnType<typeof createAgentRun>> | undefined;

    if (!alreadyRunning) {
      run = await createAgentRun(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        triggerType: args.runType,
        status: "queued",
        phase: "queued",
        summary: "Run queued for orchestration handoff.",
      });

      await patchDoc(ctx, args.agentId, {
        status: "active",
        lastRunStatus: "running",
        lastRunAt: requestedAt,
        nextRunAt: undefined,
        updatedAt: requestedAt,
      });
    }

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: run?.id,
      event: "agent.orchestrator.triggered",
      phase: "queued",
      details: operationEvent,
    });
    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: run?.id,
      event: "agent.runtime.handoff_prepared",
      phase: "queued",
      details: handoffPayload,
      scenarioId:
        args.runType === "manual"
          ? "my_agents_run_now"
          : args.runType === "scheduled"
            ? "my_agents_schedule_update"
            : undefined,
    });

    return {
      agent: {
        ...agent,
        status: "active",
        lastRunStatus: alreadyRunning ? agent.lastRunStatus : "running",
        lastRunAt: alreadyRunning ? agent.lastRunAt : requestedAt,
        nextRunAt: undefined,
        updatedAt: alreadyRunning ? agent.updatedAt : requestedAt,
      },
      operationEvent,
      handoffPayload,
      alreadyRunning,
    };
  },
});

export const handleWebhook = mutation({
  args: orchestratorHandleWebhookArgs,
  handler: async (ctx, args): Promise<OrchestratorWebhookResult> => {
    const eventPayload = normalizeRuntimeWebhookPayload(args.eventPayload as RuntimeWebhookPayload);
    const agent = await getAgentOrThrow(ctx, eventPayload.agentId);

    // Bounded dedup: only scan the 100 most recent logs instead of unbounded full scan
    const existingLogs = await queryByIndexRecent<Omit<AgentLogRecord, "id">>(
      ctx,
      "agentLogs",
      "by_agentId_timestamp",
      [["agentId", eventPayload.agentId]],
      100
    );
    const duplicateIgnored = isDuplicateWebhookEvent(
      existingLogs.map((log) => toAgentLogRecord(log as any)),
      eventPayload
    );

    if (!duplicateIgnored) {
      const lifecycleStatus = deriveLifecycleStatusFromRunStatus(
        agent.status,
        eventPayload.status
      );
      const nextRunAt = deriveNextRunAt(
        agent,
        lifecycleStatus,
        eventPayload.occurredAt,
        eventPayload.status
      );

      await patchDoc(ctx, eventPayload.agentId, {
        status: lifecycleStatus,
        lastRunStatus: eventPayload.status,
        lastRunAt: eventPayload.occurredAt,
        nextRunAt,
        updatedAt: eventPayload.occurredAt,
      });

      await appendAgentLog(ctx, {
        agentId: eventPayload.agentId,
        event: eventPayload.event,
        level: eventPayload.status === "failed" ? "error" : "info",
        details: {
          traceId: eventPayload.traceId,
          runType: eventPayload.runType,
          details: eventPayload.details,
        },
        scenarioId: eventPayload.scenarioId,
        timestamp: eventPayload.occurredAt,
      });

      return {
        agent: {
          ...agent,
          status: lifecycleStatus,
          lastRunStatus: eventPayload.status,
          lastRunAt: eventPayload.occurredAt,
          nextRunAt,
          updatedAt: eventPayload.occurredAt,
        },
        eventPayload,
        duplicateIgnored,
      };
    }

    return {
      agent,
      eventPayload,
      duplicateIgnored,
    };
  },
});

export const resumeFromPendingAction = mutation({
  args: orchestratorResumeFromPendingActionArgs,
  handler: async (ctx, args): Promise<OrchestratorResumeResult> => {
    const pendingActionDoc = await getDoc<Omit<PendingActionRecord, "id">>(ctx, args.actionId);

    if (!pendingActionDoc) {
      throw notFoundError("pending action not found", {
        actionId: args.actionId,
      });
    }

    const pendingAction = toPendingActionRecord(pendingActionDoc as any);
    assertPendingActionReadyForResume(pendingAction);

    const agent = await getAgentOrThrow(ctx, pendingAction.agentId);
    const requestedAt = Date.now();
    const { alreadyRunning, operationEvent, handoffPayload } = buildRunNowEvent(
      agent,
      "resume",
      requestedAt,
      pendingAction.userId
    );
    let run: Awaited<ReturnType<typeof createAgentRun>> | undefined;

    if (!alreadyRunning) {
      run = await createAgentRun(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        triggerType: "resume",
        status: "queued",
        phase: "queued",
        summary: "Run queued after pending action resume.",
      });

      await patchDoc(ctx, pendingAction.agentId, {
        status: "active",
        lastRunStatus: "running",
        lastRunAt: requestedAt,
        nextRunAt: undefined,
        updatedAt: requestedAt,
      });
    }

    await appendAgentLog(ctx, {
      agentId: pendingAction.agentId,
      runId: run?.id,
      event: "pending_action.resume_requested",
      phase: "queued",
      details: {
        pendingActionId: pendingAction.id,
        operationEvent,
      },
    });
    await appendAgentLog(ctx, {
      agentId: pendingAction.agentId,
      runId: run?.id,
      event: "agent.runtime.handoff_prepared",
      phase: "queued",
      details: handoffPayload,
    });

    return {
      agent: {
        ...agent,
        status: "active",
        lastRunStatus: alreadyRunning ? agent.lastRunStatus : "running",
        lastRunAt: alreadyRunning ? agent.lastRunAt : requestedAt,
        nextRunAt: undefined,
        updatedAt: alreadyRunning ? agent.updatedAt : requestedAt,
      },
      pendingAction,
      operationEvent,
      handoffPayload,
      alreadyRunning,
    };
  },
});
