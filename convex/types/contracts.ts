export type AgentStatus = "active" | "paused" | "completed" | "error";
export type ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired";
export type MonitorStatus = "watching" | "registered" | "failed";
export type PendingActionType = "essay" | "detail" | "confirmation";
export type TemplateSource = "dev" | "student";
export type SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected";
export type TemplateVisibility = "private" | "public";

export type AgentType = "scholar" | "reg" | "custom";
export type AgentOwnerType = "first_party" | "student" | "generated";
export type RunType = "install" | "manual" | "schedule" | "resume" | "webhook";
export type AgentRunState = "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
export type AgentControlAction = "run_now" | "update_schedule" | "delete" | "cancel_run";

export interface AgentRecord {
  id: string;
  userId: string;
  templateId?: string;
  ownerType: AgentOwnerType;
  type: AgentType;
  status: AgentStatus;
  config: Record<string, unknown>;
  schedule?: string;
  lastRunStatus?: "success" | "paused" | "failed";
  lastRunAt?: string;
  nextRunAt?: string;
  browserUseTaskId?: string;
  currentRunId?: string;
  currentRunState: AgentRunState;
  scheduledTaskId?: string;
  lastControlAction?: AgentControlAction;
  lastControlActionAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTaskRecord {
  id: string;
  agentId: string;
  schedule: string;
  nextRunAt: string;
  state: "scheduled" | "cancelled";
  createdAt: string;
  cancelledAt?: string;
}

export interface MarketplaceTemplate {
  id: string;
  title: string;
  description: string;
  source: TemplateSource;
  visibility: TemplateVisibility;
  category: string;
  installCount: number;
  templateConfig: Record<string, unknown>;
  agentType: AgentType;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSubmission {
  id: string;
  userId: string;
  templateId?: string;
  draftPayload: Record<string, unknown>;
  status: SubmissionStatus;
  reviewerId?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScholarshipRecord {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  source: string;
  deadline: string;
  eligibility: string;
  matchScore: number;
  status: ScholarshipStatus;
  missingFields: string[];
  updatedAt: string;
}

export interface RegistrationMonitorRecord {
  id: string;
  userId: string;
  agentId: string;
  courseNumber: string;
  uniqueId: string;
  semester: string;
  status: MonitorStatus;
  pollIntervalMinutes: number;
  lastCheckedAt?: string;
  updatedAt: string;
}

export interface PendingActionRecord {
  id: string;
  userId: string;
  agentId: string;
  type: PendingActionType;
  prompt: string;
  response?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AgentLogRecord {
  id: string;
  agentId: string;
  timestamp: string;
  event: "start" | "step" | "pause" | "resume" | "retry" | "success" | "failure";
  details: Record<string, unknown>;
  scenarioId?: string;
}

export interface RuntimeRunContext {
  agentId: string;
  runId: string;
  templateId?: string;
  scenarioId: string;
  status: AgentStatus;
  timestamp: string;
  details: Record<string, unknown>;
}
