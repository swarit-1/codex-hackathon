import {
  invalidStateError,
  validationError,
} from "./errors";
import { getNextCronTime } from "./cronParser";
import type {
  AgentLogRecord,
  AgentRecord,
  AgentRunStatus,
  AgentStatus,
  PendingActionRecord,
  RuntimeRunType,
  RuntimeWebhookPayload,
  RunTriggerSource,
} from "../types/contracts";

export function deriveTriggerSource(runType: RuntimeRunType): RunTriggerSource {
  if (runType === "scheduled") {
    return "scheduler";
  }

  if (runType === "resume") {
    return "pending_action";
  }

  return "my_agents";
}

export function deriveLifecycleStatusFromRunStatus(
  currentStatus: AgentStatus,
  runStatus: AgentRunStatus
): AgentStatus {
  if (runStatus === "failed") {
    return "error";
  }

  if (runStatus === "cancelled") {
    return currentStatus === "completed" ? "completed" : "paused";
  }

  if (runStatus === "running") {
    return "active";
  }

  return currentStatus === "completed" ? "completed" : "active";
}

export function deriveNextRunAt(
  agent: Pick<AgentRecord, "schedule">,
  lifecycleStatus: AgentStatus,
  timestamp: number,
  runStatus: AgentRunStatus
): number | undefined {
  if (runStatus === "running") {
    return undefined;
  }

  if (!agent.schedule.enabled || lifecycleStatus !== "active") {
    return undefined;
  }

  // Compute the actual next cron fire time instead of returning the current timestamp
  return getNextCronTime(
    agent.schedule.cron,
    timestamp,
    agent.schedule.timezone
  ) ?? timestamp;
}

export function assertPendingActionReadyForResume(
  pendingAction: Pick<PendingActionRecord, "id" | "resolvedAt">
): void {
  if (!pendingAction.resolvedAt) {
    throw invalidStateError("pending action must be resolved before resuming an agent", {
      actionId: pendingAction.id,
    });
  }
}

export function normalizeRuntimeWebhookPayload(
  payload: RuntimeWebhookPayload
): RuntimeWebhookPayload {
  if (!payload.event.trim()) {
    throw validationError("runtime webhook event is required");
  }

  if (!payload.traceId.trim()) {
    throw validationError("runtime webhook traceId is required");
  }

  return {
    ...payload,
    event: payload.event.trim(),
    traceId: payload.traceId.trim(),
  };
}

export function isDuplicateWebhookEvent(
  logs: AgentLogRecord[],
  payload: RuntimeWebhookPayload
): boolean {
  return logs.some((log) => {
    if (log.event !== payload.event || log.timestamp !== payload.occurredAt) {
      return false;
    }

    if (!log.details || typeof log.details !== "object" || Array.isArray(log.details)) {
      return false;
    }

    const details = log.details as Record<string, unknown>;
    return details.traceId === payload.traceId;
  });
}
