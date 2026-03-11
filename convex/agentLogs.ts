import { getRuntimeStore, nextId } from "./runtimeStore.ts";
import type { AgentLogRecord } from "./types/contracts.ts";

export interface AppendLogInput {
  agentId: string;
  event: AgentLogRecord["event"];
  details?: Record<string, unknown>;
  scenarioId?: string;
  timestamp?: string;
}

export interface LogPagination {
  limit?: number;
  cursor?: number;
}

export function append(payload: AppendLogInput): AgentLogRecord {
  const store = getRuntimeStore();
  const log: AgentLogRecord = {
    id: nextId("log"),
    agentId: payload.agentId,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    event: payload.event,
    details: payload.details ?? {},
    scenarioId: payload.scenarioId,
  };
  store.agentLogs.set(log.id, log);
  return log;
}

export function list(agentId: string, pagination: LogPagination = {}): AgentLogRecord[] {
  const store = getRuntimeStore();
  const allLogs = [...store.agentLogs.values()]
    .filter((log) => log.agentId === agentId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const start = Math.max(0, pagination.cursor ?? 0);
  const limit = Math.max(1, pagination.limit ?? 100);
  return allLogs.slice(start, start + limit);
}

export function listByScenario(scenarioId: string): AgentLogRecord[] {
  const store = getRuntimeStore();
  return [...store.agentLogs.values()]
    .filter((log) => log.scenarioId === scenarioId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
