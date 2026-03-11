/**
 * Thin adapters that expose getById / updateById / append / create semantics
 * on top of the in-memory RuntimeStore so the services layer can keep its
 * existing call-sites unchanged after the convex files moved to Convex mutations.
 */
import { getRuntimeStore, nextId } from "../../../convex/runtimeStore.ts";
import type {
  AgentRecord,
  AgentLogRecord,
  IntramuralSignupRecord,
  PendingActionRecord,
  ScholarshipRecord,
  RegistrationMonitorRecord,
} from "../../../convex/types/contracts.ts";

// ── Agents ───────────────────────────────────────────────────────────────────

export function getAgentById(id: string): (AgentRecord & Record<string, unknown>) | undefined {
  return getRuntimeStore().agents.get(id) as (AgentRecord & Record<string, unknown>) | undefined;
}

export function updateAgentById(id: string, patch: Record<string, unknown>): void {
  const agent = getRuntimeStore().agents.get(id);
  if (!agent) return;
  Object.assign(agent, patch, { updatedAt: new Date().toISOString() });
}

// ── Pending Actions ──────────────────────────────────────────────────────────

export function getPendingActionById(id: string): PendingActionRecord | undefined {
  return getRuntimeStore().pendingActions.get(id);
}

export function createPendingAction(entry: {
  userId: string;
  agentId: string;
  type: PendingActionRecord["type"];
  prompt: string;
}): PendingActionRecord {
  const id = nextId("pa");
  const record: PendingActionRecord = {
    id,
    userId: entry.userId,
    agentId: entry.agentId,
    type: entry.type,
    prompt: entry.prompt,
    createdAt: Date.now(),
  };
  getRuntimeStore().pendingActions.set(id, record);
  return record;
}

export function resolvePendingAction(actionId: string, response: string): PendingActionRecord {
  const action = getRuntimeStore().pendingActions.get(actionId);
  if (!action) throw new Error(`Pending action not found: ${actionId}`);
  action.response = response;
  action.resolvedAt = Date.now();
  return action;
}

// ── Scholarships ─────────────────────────────────────────────────────────────

export function listScholarshipsByAgent(agentId: string): ScholarshipRecord[] {
  const results: ScholarshipRecord[] = [];
  for (const s of getRuntimeStore().scholarships.values()) {
    if (s.agentId === agentId) results.push(s);
  }
  return results;
}

export function upsertScholarshipFromRun(entry: {
  userId: string;
  agentId: string;
  title: string;
  source: string;
  deadline?: number;
  eligibility?: ScholarshipRecord["eligibility"];
  matchScore?: number;
  status: ScholarshipRecord["status"];
  missingFields?: string[];
}): ScholarshipRecord {
  // Find existing by agentId + title
  for (const s of getRuntimeStore().scholarships.values()) {
    if (s.agentId === entry.agentId && s.title === entry.title) {
      Object.assign(s, entry, { updatedAt: Date.now() });
      return s;
    }
  }
  const id = nextId("sch");
  const now = Date.now();
  const record: ScholarshipRecord = {
    id,
    userId: entry.userId,
    agentId: entry.agentId,
    title: entry.title,
    source: entry.source,
    deadline: entry.deadline,
    eligibility: entry.eligibility,
    matchScore: entry.matchScore,
    status: entry.status,
    missingFields: entry.missingFields,
    createdAt: now,
    updatedAt: now,
  };
  getRuntimeStore().scholarships.set(id, record);
  return record;
}

// ── Registration Monitors ────────────────────────────────────────────────────

export function listMonitorsByAgent(agentId: string): RegistrationMonitorRecord[] {
  const results: RegistrationMonitorRecord[] = [];
  for (const m of getRuntimeStore().registrationMonitors.values()) {
    if (m.agentId === agentId) results.push(m);
  }
  return results;
}

export function createMonitor(entry: {
  userId: string;
  agentId: string;
  courseNumber: string;
  uniqueId: string;
  semester: string;
  pollIntervalMinutes: number;
}): RegistrationMonitorRecord {
  const id = nextId("mon");
  const now = Date.now();
  const record: RegistrationMonitorRecord = {
    id,
    userId: entry.userId,
    agentId: entry.agentId,
    courseNumber: entry.courseNumber,
    uniqueId: entry.uniqueId,
    semester: entry.semester,
    status: "watching",
    pollInterval: entry.pollIntervalMinutes,
    createdAt: now,
    updatedAt: now,
  };
  getRuntimeStore().registrationMonitors.set(id, record);
  return record;
}

export function updateMonitorStatus(id: string, status: RegistrationMonitorRecord["status"]): void {
  const monitor = getRuntimeStore().registrationMonitors.get(id);
  if (!monitor) return;
  monitor.status = status;
  monitor.updatedAt = Date.now();
}

// ── Pending Actions (queries) ────────────────────────────────────────────────

export function listPendingActionsByAgent(agentId: string): PendingActionRecord[] {
  const results: PendingActionRecord[] = [];
  for (const pa of getRuntimeStore().pendingActions.values()) {
    if (pa.agentId === agentId) results.push(pa);
  }
  return results;
}

// ── Registration Monitors (queries) ──────────────────────────────────────────

export function listMonitorsByUser(userId: string): RegistrationMonitorRecord[] {
  const results: RegistrationMonitorRecord[] = [];
  for (const m of getRuntimeStore().registrationMonitors.values()) {
    if (m.userId === userId) results.push(m);
  }
  return results;
}

// ── Intramural Signups ────────────────────────────────────────────────────────

export function listIntramuralSignupsByAgent(agentId: string): IntramuralSignupRecord[] {
  const results: IntramuralSignupRecord[] = [];
  for (const s of getRuntimeStore().intramuralSignups.values()) {
    if (s.agentId === agentId) results.push(s);
  }
  return results;
}

export function upsertIntramuralSignup(entry: {
  userId: string;
  agentId: string;
  sport: string;
  division: string;
  role: IntramuralSignupRecord["role"];
  teamName?: string;
  preferredDay?: string;
  preferredTime?: string;
  registrationFee?: number;
  status: IntramuralSignupRecord["status"];
}): IntramuralSignupRecord {
  for (const s of getRuntimeStore().intramuralSignups.values()) {
    if (s.agentId === entry.agentId && s.sport === entry.sport && s.division === entry.division) {
      Object.assign(s, entry, { updatedAt: Date.now() });
      return s;
    }
  }
  const id = nextId("ims");
  const now = Date.now();
  const record: IntramuralSignupRecord = {
    id,
    userId: entry.userId,
    agentId: entry.agentId,
    sport: entry.sport,
    division: entry.division,
    role: entry.role,
    teamName: entry.teamName,
    preferredDay: entry.preferredDay,
    preferredTime: entry.preferredTime,
    registrationFee: entry.registrationFee,
    status: entry.status,
    createdAt: now,
    updatedAt: now,
  };
  getRuntimeStore().intramuralSignups.set(id, record);
  return record;
}

export function updateIntramuralSignupStatus(id: string, status: IntramuralSignupRecord["status"]): void {
  const signup = getRuntimeStore().intramuralSignups.get(id);
  if (!signup) return;
  signup.status = status;
  signup.updatedAt = Date.now();
}

// ── Agent Logs ───────────────────────────────────────────────────────────────

export function appendLog(entry: {
  agentId: string;
  event: string;
  scenarioId?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}): void {
  const id = nextId("log");
  const record: AgentLogRecord = {
    id,
    agentId: entry.agentId,
    timestamp: Date.now(),
    event: entry.event,
    level: "info",
    details: (entry.details ?? {}) as AgentLogRecord["details"],
    scenarioId: entry.scenarioId as AgentLogRecord["scenarioId"],
  };
  getRuntimeStore().agentLogs.set(id, record);
}

export function listLogsByScenario(scenarioId: string): AgentLogRecord[] {
  const results: AgentLogRecord[] = [];
  for (const log of getRuntimeStore().agentLogs.values()) {
    if (log.scenarioId === scenarioId) results.push(log);
  }
  return results;
}
