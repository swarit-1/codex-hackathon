import { action } from "./_generated/server";
import {
  getDoc,
  patchDoc,
  queryByIndex,
} from "./lib/db";
import { notFoundError } from "./lib/errors";
import { appendAgentLog } from "./lib/logging";
import {
  deriveLifecycleStatusFromRunStatus,
  deriveNextRunAt,
  deriveTriggerSource,
  isDuplicateWebhookEvent,
  normalizeRuntimeWebhookPayload,
  assertPendingActionReadyForResume,
} from "./lib/orchestrator";
import { toAgentRecord, toAgentLogRecord, toPendingActionRecord } from "./lib/records";
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

async function getAgentOrThrow(ctx: any, agentId: string): Promise<AgentRecord> {
  const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, agentId);

  if (!agentDoc) {
    throw notFoundError("agent not found", {
      agentId,
    });
  }

  return toAgentRecord(agentDoc as any);
}

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

export const triggerAgentRun = action({
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

    if (!alreadyRunning) {
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
      event: "agent.orchestrator.triggered",
      details: operationEvent,
    });
    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.runtime.handoff_prepared",
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

export const handleWebhook = action({
  args: orchestratorHandleWebhookArgs,
  handler: async (ctx, args): Promise<OrchestratorWebhookResult> => {
    const eventPayload = normalizeRuntimeWebhookPayload(args.eventPayload as RuntimeWebhookPayload);
    const agent = await getAgentOrThrow(ctx, eventPayload.agentId);
    const existingLogs = await queryByIndex<Omit<AgentLogRecord, "id">>(
      ctx,
      "agentLogs",
      "by_agentId_timestamp",
      [["agentId", eventPayload.agentId]]
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

export const resumeFromPendingAction = action({
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

    if (!alreadyRunning) {
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
      event: "pending_action.resume_requested",
      details: {
        pendingActionId: pendingAction.id,
        operationEvent,
      },
    });
    await appendAgentLog(ctx, {
      agentId: pendingAction.agentId,
      event: "agent.runtime.handoff_prepared",
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
