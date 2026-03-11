import { append as appendLog } from "./agentLogs.ts";
import { DEFAULT_USER_ID, getRuntimeStore, nextId } from "./runtimeStore.ts";
import type {
  AgentRecord,
  AgentStatus,
  AgentType,
  AgentOwnerType,
  RunType,
  ScheduledTaskRecord,
} from "./types/contracts.ts";
import {
  MY_AGENTS_DELETE_SCENARIO,
  MY_AGENTS_RUN_NOW_SCENARIO,
  MY_AGENTS_SCHEDULE_UPDATE_SCENARIO,
} from "../services/agents/shared/payloadMappers.ts";
import { computeNextRunAt, validateCronSchedule } from "../services/agents/shared/schedule.ts";

export interface CreateAgentOptions {
  userId?: string;
  templateId?: string;
  ownerType?: AgentOwnerType;
  schedule?: string;
}

export function create(type: AgentType, config: Record<string, unknown>, options: CreateAgentOptions = {}): AgentRecord {
  const store = getRuntimeStore();
  const now = new Date().toISOString();

  const agent: AgentRecord = {
    id: nextId("agent"),
    userId: options.userId ?? DEFAULT_USER_ID,
    templateId: options.templateId,
    ownerType: options.ownerType ?? "generated",
    type,
    status: "active",
    config,
    schedule: options.schedule,
    currentRunState: "idle",
    createdAt: now,
    updatedAt: now,
  };

  store.agents.set(agent.id, agent);
  return agent;
}

export function getById(agentId: string): AgentRecord | undefined {
  return getRuntimeStore().agents.get(agentId);
}

export function listByUser(userId: string = DEFAULT_USER_ID): AgentRecord[] {
  return [...getRuntimeStore().agents.values()].filter((agent) => agent.userId === userId && !agent.deletedAt);
}

export function updateStatus(agentId: string, status: AgentStatus): AgentRecord {
  return updateById(agentId, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export function updateById(agentId: string, patch: Partial<AgentRecord>): AgentRecord {
  const store = getRuntimeStore();
  const existing = store.agents.get(agentId);
  if (!existing) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const updated: AgentRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  store.agents.set(agentId, updated);
  return updated;
}

export async function runNow(agentId: string): Promise<{
  idempotent: boolean;
  agentId: string;
  runId?: string;
  runState: AgentRecord["currentRunState"];
  browserTaskId?: string;
  scenarioId: string;
  reason?: string;
  result?: Record<string, unknown>;
}> {
  const agent = getById(agentId);
  if (!agent || agent.deletedAt) {
    throw new Error(`Cannot run missing/deleted agent: ${agentId}`);
  }

  appendLog({
    agentId,
    event: "step",
    scenarioId: MY_AGENTS_RUN_NOW_SCENARIO,
    details: {
      message: "Run-now requested",
      currentRunState: agent.currentRunState,
      currentRunId: agent.currentRunId,
    },
  });

  if (agent.currentRunState === "running") {
    appendLog({
      agentId,
      event: "step",
      scenarioId: MY_AGENTS_RUN_NOW_SCENARIO,
      details: {
        message: "Run-now idempotent short-circuit; run already in progress",
        currentRunState: agent.currentRunState,
        currentRunId: agent.currentRunId,
        browserTaskId: agent.browserUseTaskId,
      },
    });

    return {
      idempotent: true,
      reason: "agent already running",
      agentId: agent.id,
      runId: agent.currentRunId,
      runState: agent.currentRunState,
      browserTaskId: agent.browserUseTaskId,
      scenarioId: MY_AGENTS_RUN_NOW_SCENARIO,
    };
  }

  const orchestrator = await import("./orchestrator.ts");
  const result = (await orchestrator.triggerAgentRun(agentId, "manual")) as Record<string, unknown>;
  const latest = getById(agentId);

  return {
    idempotent: false,
    agentId,
    runId: typeof result.runId === "string" ? result.runId : latest?.currentRunId,
    runState: latest?.currentRunState ?? "idle",
    browserTaskId:
      typeof result.browserTaskId === "string" ? result.browserTaskId : latest?.browserUseTaskId,
    scenarioId: MY_AGENTS_RUN_NOW_SCENARIO,
    result,
  };
}

export function updateSchedule(
  agentId: string,
  schedule: string,
): {
  agent: AgentRecord;
  nextRunAt: string;
  scheduledTaskId: string;
  validation: { valid: true; normalized: string; errors: [] };
  scenarioId: string;
} {
  const agent = getById(agentId);
  if (!agent || agent.deletedAt) {
    throw new Error(`Cannot update schedule for missing/deleted agent: ${agentId}`);
  }

  const validation = validateCronSchedule(schedule);
  if (!validation.valid || !validation.normalized) {
    throw new Error(`Invalid schedule. ${validation.errors.join(" ")}`);
  }

  const previousSchedule = agent.schedule;
  const previousTaskId = agent.scheduledTaskId;
  let cancelledPreviousTask = false;

  if (previousTaskId) {
    cancelledPreviousTask = cancelScheduledTask(previousTaskId).cancelled;
  }

  const nextRunAt = computeNextRunAt(validation.normalized);
  const scheduledTask = createScheduledTask(agentId, validation.normalized, nextRunAt);

  const updated = updateById(agentId, {
    schedule: validation.normalized,
    nextRunAt,
    scheduledTaskId: scheduledTask.id,
    lastControlAction: "update_schedule",
    lastControlActionAt: new Date().toISOString(),
  });

  appendLog({
    agentId,
    event: "success",
    scenarioId: MY_AGENTS_SCHEDULE_UPDATE_SCENARIO,
    details: {
      message: "Schedule update applied",
      previousSchedule,
      nextSchedule: validation.normalized,
      previousTaskId,
      cancelledPreviousTask,
      nextRunAt,
      scheduledTaskId: scheduledTask.id,
      validation: {
        valid: true,
        normalized: validation.normalized,
      },
    },
  });

  return {
    agent: updated,
    nextRunAt,
    scheduledTaskId: scheduledTask.id,
    validation: {
      valid: true,
      normalized: validation.normalized,
      errors: [],
    },
    scenarioId: MY_AGENTS_SCHEDULE_UPDATE_SCENARIO,
  };
}

export async function deleteAgent(agentId: string): Promise<{
  agentId: string;
  deletedAt: string;
  cancellation: {
    attempted: boolean;
    succeeded: boolean;
    taskId?: string;
    scheduleTaskId?: string;
    scheduleCancelled: boolean;
  };
  scenarioId: string;
}> {
  const existing = getById(agentId);
  if (!existing) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  const orchestrator = await import("./orchestrator.ts");

  const runCancellation =
    existing.currentRunState === "running" || Boolean(existing.browserUseTaskId)
      ? await orchestrator.cancelAgentRun(agentId, {
          scenarioId: MY_AGENTS_DELETE_SCENARIO,
          reason: "delete_request",
        })
      : { attempted: false, succeeded: false };

  let scheduleCancelled = false;
  if (existing.scheduledTaskId) {
    scheduleCancelled = cancelScheduledTask(existing.scheduledTaskId).cancelled;
  }

  const deletedAt = new Date().toISOString();
  updateById(agentId, {
    status: "completed",
    deletedAt,
    currentRunState: runCancellation.succeeded ? "cancelled" : "completed",
    currentRunId: undefined,
    browserUseTaskId: undefined,
    scheduledTaskId: undefined,
    nextRunAt: undefined,
    lastControlAction: "delete",
    lastControlActionAt: deletedAt,
  });

  appendLog({
    agentId,
    event: "success",
    scenarioId: MY_AGENTS_DELETE_SCENARIO,
    details: {
      message: "Delete completed with safe cancellation semantics",
      deletedAt,
      runCancellation,
      scheduleCancelled,
      scheduleTaskId: existing.scheduledTaskId,
    },
  });

  return {
    agentId,
    deletedAt,
    cancellation: {
      attempted: runCancellation.attempted,
      succeeded: runCancellation.succeeded,
      taskId: runCancellation.taskId,
      scheduleTaskId: existing.scheduledTaskId,
      scheduleCancelled,
    },
    scenarioId: MY_AGENTS_DELETE_SCENARIO,
  };
}

export { deleteAgent as delete };

export function getScheduledTaskById(taskId: string): ScheduledTaskRecord | undefined {
  return getRuntimeStore().scheduledTasks.get(taskId);
}

export function listScheduledTasksByAgent(agentId: string): ScheduledTaskRecord[] {
  return [...getRuntimeStore().scheduledTasks.values()].filter((task) => task.agentId === agentId);
}

export interface RunTypeInput {
  agentId: string;
  runType: RunType;
}

function createScheduledTask(agentId: string, schedule: string, nextRunAt: string): ScheduledTaskRecord {
  const task: ScheduledTaskRecord = {
    id: nextId("scheduled_task"),
    agentId,
    schedule,
    nextRunAt,
    state: "scheduled",
    createdAt: new Date().toISOString(),
  };

  getRuntimeStore().scheduledTasks.set(task.id, task);
  return task;
}

function cancelScheduledTask(taskId: string): { cancelled: boolean; taskId: string } {
  const store = getRuntimeStore();
  const task = store.scheduledTasks.get(taskId);
  if (!task || task.state === "cancelled") {
    return { cancelled: false, taskId };
  }

  store.scheduledTasks.set(taskId, {
    ...task,
    state: "cancelled",
    cancelledAt: new Date().toISOString(),
  });

  return { cancelled: true, taskId };
}
