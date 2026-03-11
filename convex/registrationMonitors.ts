import { getRuntimeStore, nextId } from "./runtimeStore.ts";
import type { MonitorStatus, RegistrationMonitorRecord } from "./types/contracts.ts";

export interface CreateMonitorInput {
  userId: string;
  agentId: string;
  courseNumber: string;
  uniqueId: string;
  semester: string;
  pollIntervalMinutes: number;
}

export function create(payload: CreateMonitorInput): RegistrationMonitorRecord {
  const store = getRuntimeStore();
  const existing = [...store.registrationMonitors.values()].find(
    (monitor) =>
      monitor.agentId === payload.agentId &&
      monitor.courseNumber === payload.courseNumber &&
      monitor.uniqueId === payload.uniqueId &&
      monitor.semester === payload.semester,
  );

  if (existing) {
    return existing;
  }

  const monitor: RegistrationMonitorRecord = {
    id: nextId("reg_monitor"),
    userId: payload.userId,
    agentId: payload.agentId,
    courseNumber: payload.courseNumber,
    uniqueId: payload.uniqueId,
    semester: payload.semester,
    status: "watching",
    pollIntervalMinutes: payload.pollIntervalMinutes,
    updatedAt: new Date().toISOString(),
  };

  store.registrationMonitors.set(monitor.id, monitor);
  return monitor;
}

export function listByUser(userId: string): RegistrationMonitorRecord[] {
  return [...getRuntimeStore().registrationMonitors.values()].filter((monitor) => monitor.userId === userId);
}

export function updateStatus(monitorId: string, status: MonitorStatus): RegistrationMonitorRecord {
  const store = getRuntimeStore();
  const existing = store.registrationMonitors.get(monitorId);
  if (!existing) {
    throw new Error(`Registration monitor not found: ${monitorId}`);
  }

  const updated: RegistrationMonitorRecord = {
    ...existing,
    status,
    lastCheckedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.registrationMonitors.set(monitorId, updated);
  return updated;
}

export function listByAgent(agentId: string): RegistrationMonitorRecord[] {
  return [...getRuntimeStore().registrationMonitors.values()].filter((monitor) => monitor.agentId === agentId);
}
