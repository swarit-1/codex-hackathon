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
export type ReviewDecision = "approved" | "rejected";
export type WorkflowSourceAlias = "model_to_agent_studio" | "flowforge";
export type BackendErrorCode =
  | "PHASE_2_NOT_IMPLEMENTED"
  | "VALIDATION_ERROR"
  | "INVALID_STATE"
  | "FORBIDDEN"
  | "NOT_FOUND";
export type RuntimeRunType = "manual" | "scheduled" | "resume";
export type RunTriggerSource = "my_agents" | "scheduler" | "pending_action" | "webhook";
export type AgentOperationType = "run_now" | "schedule_update" | "delete";
export type AgentOperationStatus = "accepted" | "deferred" | "rejected";
export type AgentDeleteMode = "archive_only" | "cancel_then_archive";
export type ScenarioId =
  | "scholarbot_happy_path"
  | "regbot_happy_path"
  | "flowforge_happy_path"
  | "regbot_duo_timeout"
  | "webhook_retry_path"
  | "marketplace_install_dev_template"
  | "marketplace_install_student_template"
  | "submission_pending_to_approved"
  | "my_agents_run_now"
  | "my_agents_schedule_update";

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

export interface OperationTrace {
  traceId: string;
  emittedAt: number;
  source: RunTriggerSource;
  scenarioId?: ScenarioId;
}

export interface AgentOperationEvent {
  agentId: string;
  operation: AgentOperationType;
  status: AgentOperationStatus;
  message: string;
  trace: OperationTrace;
  metadata?: JsonObject;
}

export interface RuntimeHandoffPayload {
  agentId: string;
  runType: RuntimeRunType;
  source: RunTriggerSource;
  requestedAt: number;
  traceId: string;
  requestedByUserId?: string;
  scenarioId?: ScenarioId;
  schedule?: ScheduleConfig;
  metadata?: JsonObject;
}

export interface RuntimeWebhookPayload {
  agentId: string;
  event: string;
  status: AgentRunStatus;
  occurredAt: number;
  traceId: string;
  runType?: RuntimeRunType;
  scenarioId?: ScenarioId;
  details?: JsonObject;
}

export interface BackendScenarioFixture {
  scenarioId: ScenarioId;
  title: string;
  summary: string;
  agent: AgentRecord;
  operationEvent?: AgentOperationEvent;
  handoffPayload?: RuntimeHandoffPayload;
  expectedLogs: Array<{
    event: string;
    level: LogLevel;
    scenarioId: ScenarioId;
    details: JsonObject;
  }>;
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
  operationEvent: AgentOperationEvent;
  handoffPayload: RuntimeHandoffPayload;
  alreadyRunning: boolean;
}

export interface AgentScheduleUpdateResult {
  agent: AgentRecord;
  operationEvent: AgentOperationEvent;
}

export interface AgentDeleteResult {
  deletedAgentId: string;
  deleteMode: AgentDeleteMode;
  operationEvent: AgentOperationEvent;
}

export interface UserProfileRecord {
  id: string;
  name: string;
  email: string;
  eid?: string;
  authMethod: AuthMethod;
  profileData?: JsonValue;
  createdAt: number;
  updatedAt: number;
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

export interface ScholarshipRecord {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  source: string;
  deadline?: number;
  eligibility?: JsonValue;
  matchScore?: number;
  status: ScholarshipStatus;
  missingFields?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RegistrationMonitorRecord {
  id: string;
  userId: string;
  agentId: string;
  courseNumber: string;
  uniqueId: string;
  semester: string;
  status: MonitorStatus;
  pollInterval: number;
  createdAt: number;
  updatedAt: number;
}

export interface PendingActionRecord {
  id: string;
  userId: string;
  agentId: string;
  type: PendingActionType;
  prompt: string;
  response?: JsonValue;
  resolvedAt?: number;
  createdAt: number;
}

export interface CustomWorkflowRecord {
  id: string;
  userId: string;
  agentId?: string;
  sourceAlias: WorkflowSourceAlias;
  prompt: string;
  spec?: JsonValue;
  generatedScript?: string;
  templateSubmissionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentLogRecord {
  id: string;
  agentId: string;
  timestamp: number;
  event: string;
  level: LogLevel;
  details: JsonValue;
  screenshots?: string[];
  scenarioId?: ScenarioId;
}
