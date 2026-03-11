export type AgentStatus = "active" | "paused" | "completed" | "error";
export type ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired";
export type MonitorStatus = "watching" | "registered" | "failed";
export type PendingActionType = "essay" | "detail" | "confirmation";
export type TemplateSource = "dev" | "student";
export type SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected";
export type TemplateVisibility = "private" | "public";
export type AgentOwnerType = "first_party" | "student" | "generated";
export type AgentType = "scholar" | "reg" | "custom";
export type AgentRunStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";
export type AuthMethod = "email" | "ut_sso" | "demo";
export type LogLevel = "info" | "warning" | "error";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface ScheduleConfig {
  enabled: boolean;
  cron: string;
  timezone: string;
  jitterMinutes?: number;
}

export interface ConfigEnvelope {
  schemaVersion: string;
  inputSchema: JsonObject;
  defaultConfig: JsonObject;
  defaultSchedule?: ScheduleConfig;
  currentConfig?: JsonObject;
}

export interface TemplateDraftPayload {
  title: string;
  description: string;
  category: string;
  templateType: AgentType;
  visibility?: TemplateVisibility;
  templateConfig: ConfigEnvelope;
}

export interface PaginationArgs {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface MarketplaceTemplateFilters extends PaginationArgs {
  source: TemplateSource;
  category?: string;
  visibility?: TemplateVisibility;
  ownerUserId?: string;
}

export interface AgentListFilters extends PaginationArgs {
  userId: string;
  status?: AgentStatus;
  ownerType?: AgentOwnerType;
  type?: AgentType;
}

export interface AgentLogListArgs extends PaginationArgs {
  agentId: string;
}

export interface MarketplaceTemplateRecord {
  id: string;
  title: string;
  description: string;
  source: TemplateSource;
  category: string;
  visibility: TemplateVisibility;
  templateType: AgentType;
  installCount: number;
  ownerUserId?: string;
  templateConfig: ConfigEnvelope;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  archivedAt?: number;
}

export interface TemplateSubmissionRecord {
  id: string;
  userId: string;
  templateId?: string;
  draftPayload: TemplateDraftPayload;
  status: SubmissionStatus;
  reviewerId?: string;
  reviewNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentRecord {
  id: string;
  userId: string;
  templateId?: string;
  ownerType: AgentOwnerType;
  type: AgentType;
  status: AgentStatus;
  config: ConfigEnvelope;
  schedule: ScheduleConfig;
  lastRunStatus: AgentRunStatus;
  lastRunAt?: number;
  nextRunAt?: number;
  browserUseTaskId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateInstallResult {
  agent: AgentRecord;
  template: MarketplaceTemplateRecord;
  installed: boolean;
}

export interface TemplateReviewResult {
  submission: TemplateSubmissionRecord;
  template?: MarketplaceTemplateRecord;
}

export interface AgentRunNowResult {
  agent: AgentRecord;
  operationEvent: {
    agentId: string;
    operation: "run_now" | "schedule_update" | "delete";
    status: "accepted" | "deferred" | "rejected";
    message: string;
    trace: {
      traceId: string;
      emittedAt: number;
      source: "my_agents" | "scheduler" | "pending_action" | "webhook";
      scenarioId?: ScenarioId;
    };
  };
  handoffPayload: {
    agentId: string;
    runType: "manual" | "scheduled" | "resume";
    source: "my_agents" | "scheduler" | "pending_action" | "webhook";
    requestedAt: number;
    traceId: string;
    requestedByUserId?: string;
    scenarioId?: ScenarioId;
    schedule?: ScheduleConfig;
  };
  alreadyRunning: boolean;
}

export interface AgentScheduleUpdateResult {
  agent: AgentRecord;
  operationEvent: AgentRunNowResult["operationEvent"];
}

export interface AgentDeleteResult {
  deletedAgentId: string;
  deleteMode: "archive_only" | "cancel_then_archive";
  operationEvent: AgentRunNowResult["operationEvent"];
}
