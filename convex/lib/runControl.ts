import {
  invalidStateError,
  validationError,
} from "./errors";
import type {
  AgentDeleteMode,
  AgentOperationEvent,
  AgentOperationStatus,
  AgentOperationType,
  AgentRecord,
  JsonObject,
  RunTriggerSource,
  RuntimeHandoffPayload,
  RuntimeRunType,
  ScheduleConfig,
  ScenarioId,
} from "../types/contracts";

const MIN_CRON_SEGMENTS = 5;
const MAX_CRON_SEGMENTS = 6;

export function normalizeScheduleConfig(schedule: ScheduleConfig): ScheduleConfig {
  return {
    enabled: schedule.enabled,
    cron: schedule.cron.trim(),
    timezone: schedule.timezone.trim(),
    jitterMinutes: schedule.jitterMinutes,
  };
}

export function isLikelyCronExpression(cron: string): boolean {
  const segmentCount = cron.trim().split(/\s+/).filter(Boolean).length;
  return segmentCount >= MIN_CRON_SEGMENTS && segmentCount <= MAX_CRON_SEGMENTS;
}

export function validateScheduleConfig(schedule: ScheduleConfig): string[] {
  const issues: string[] = [];
  const normalized = normalizeScheduleConfig(schedule);

  if (normalized.enabled && normalized.cron.length === 0) {
    issues.push("cron expression is required when the schedule is enabled");
  }

  if (normalized.enabled && !isLikelyCronExpression(normalized.cron)) {
    issues.push("cron expression must contain 5 or 6 space-delimited segments");
  }

  if (normalized.timezone.length === 0) {
    issues.push("timezone is required");
  }

  if (
    normalized.jitterMinutes !== undefined &&
    (!Number.isInteger(normalized.jitterMinutes) || normalized.jitterMinutes < 0)
  ) {
    issues.push("jitterMinutes must be a non-negative integer");
  }

  return issues;
}

export function assertValidScheduleConfig(schedule: ScheduleConfig): ScheduleConfig {
  const normalized = normalizeScheduleConfig(schedule);
  const issues = validateScheduleConfig(normalized);

  if (issues.length > 0) {
    throw validationError("schedule validation failed", {
      issues,
    });
  }

  return normalized;
}

export function buildOperationTraceId(
  agentId: string,
  operation: AgentOperationType,
  timestamp: number
): string {
  return `${operation}:${agentId}:${timestamp}`;
}

export function buildAgentOperationEvent(args: {
  agentId: string;
  operation: AgentOperationType;
  status: AgentOperationStatus;
  source: RunTriggerSource;
  emittedAt: number;
  message: string;
  scenarioId?: ScenarioId;
  metadata?: JsonObject;
}): AgentOperationEvent {
  return {
    agentId: args.agentId,
    operation: args.operation,
    status: args.status,
    message: args.message,
    trace: {
      traceId: buildOperationTraceId(args.agentId, args.operation, args.emittedAt),
      emittedAt: args.emittedAt,
      source: args.source,
      scenarioId: args.scenarioId,
    },
    metadata: args.metadata,
  };
}

export function buildRuntimeHandoffPayload(args: {
  agentId: string;
  runType: RuntimeRunType;
  source: RunTriggerSource;
  requestedAt: number;
  requestedByUserId?: string;
  scenarioId?: ScenarioId;
  schedule?: ScheduleConfig;
  metadata?: JsonObject;
}): RuntimeHandoffPayload {
  const operation: AgentOperationType =
    args.source === "scheduler" ? "schedule_update" : "run_now";

  return {
    agentId: args.agentId,
    runType: args.runType,
    source: args.source,
    requestedAt: args.requestedAt,
    requestedByUserId: args.requestedByUserId,
    scenarioId: args.scenarioId,
    schedule: args.schedule,
    traceId: buildOperationTraceId(args.agentId, operation, args.requestedAt),
    metadata: args.metadata,
  };
}

export function deriveDeleteMode(agent: Pick<AgentRecord, "status" | "lastRunStatus">): AgentDeleteMode {
  return agent.lastRunStatus === "running" ? "cancel_then_archive" : "archive_only";
}

export function assertDeleteAllowed(agent: Pick<AgentRecord, "status" | "lastRunStatus">): AgentDeleteMode {
  if (agent.status === "completed" && agent.lastRunStatus === "running") {
    throw invalidStateError("agent cannot be completed and running simultaneously");
  }

  return deriveDeleteMode(agent);
}
