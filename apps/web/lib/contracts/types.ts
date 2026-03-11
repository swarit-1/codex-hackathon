import type {
  FlowforgeWorkflowSpecResult,
  UserProfileRecord,
} from "@convex/types/contracts";

export type AgentStatus = "active" | "paused" | "completed" | "error";
export type ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired";
export type MonitorStatus = "watching" | "registered" | "failed";
export type LabOpeningStatus = "discovered" | "reviewing" | "drafting_email" | "email_ready" | "contacted" | "expired";
export type PendingActionType = "essay" | "detail" | "confirmation" | "email_draft";
export type TemplateSource = "dev" | "student";
export type SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected";
export type TemplateVisibility = "private" | "public";
export type AgentOwnerType = "first_party" | "student" | "generated";
export type AgentType = "scholar" | "reg" | "eureka" | "custom"| "im";
export type AgentRunStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled";
export type AgentRunTrackingStatus =
  | "queued"
  | "launching"
  | "running"
  | "waiting_for_input"
  | "succeeded"
  | "failed"
  | "cancelled";
export type AgentRunPhase =
  | "queued"
  | "starting_browser"
  | "navigating"
  | "authenticating"
  | "scanning"
  | "extracting"
  | "writing_results"
  | "completed"
  | "failed";
export type AgentRunErrorCategory =
  | "configuration"
  | "authentication"
  | "site_changed"
  | "provider_error"
  | "timeout"
  | "unknown";
export type AuthMethod = "email" | "ut_sso" | "demo";
export type LogLevel = "info" | "warning" | "error";
export type RuntimeRunType = "manual" | "scheduled" | "resume";
export type RunTriggerSource = "my_agents" | "scheduler" | "pending_action" | "webhook";
export type ScenarioId =
  | "scholarbot_happy_path"
  | "regbot_happy_path"
  | "eurekabot_happy_path"
  | "flowforge_happy_path"
  | "regbot_duo_timeout"
  | "webhook_retry_path"
  | "marketplace_install_dev_template"
  | "marketplace_install_student_template"
  | "submission_pending_to_approved"
  | "my_agents_run_now"
  | "my_agents_schedule_update"
  | "imbot_happy_path";

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

export interface AgentRunRecord {
  id: string;
  userId: string;
  agentId: string;
  triggerType: RuntimeRunType;
  status: AgentRunTrackingStatus;
  phase: AgentRunPhase;
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  browserUseTaskId?: string;
  liveUrl?: string;
  summary?: string;
  resultCounts?: JsonObject;
  error?: string;
  errorCategory?: AgentRunErrorCategory;
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

export interface AgentOperationEvent {
  agentId: string;
  operation: "run_now" | "schedule_update" | "delete";
  status: "accepted" | "deferred" | "rejected";
  message: string;
  trace: {
    traceId: string;
    emittedAt: number;
    source: RunTriggerSource;
    scenarioId?: ScenarioId;
  };
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
  deleteMode: "archive_only" | "cancel_then_archive";
  operationEvent: AgentOperationEvent;
}

export type MarketplaceTemplate = {
  id: string;
  title: string;
  description: string;
  source: TemplateSource;
  category: string;
  installs: number;
  trustLabel: string;
  visibility: TemplateVisibility;
  status: "ready" | SubmissionStatus;
  scheduleDefault: string;
  setupFields: string[];
  outcomes: string[];
  templateConfig: ConfigEnvelope;
  ownerUserId?: string;
  approvedAt?: number;
  archivedAt?: number;
  imageSrc: string;
  iconKey: string;
  iconGlyph: string;
};

export type Agent = {
  id: string;
  name: string;
  templateId: string;
  source: TemplateSource;
  type: "scholar" | "reg" | "eureka" | "custom" | "im";
  status: AgentStatus;
  config?: ConfigEnvelope;
  pendingActionCount: number;
  currentRun?: AgentRun;
  latestSummary: string;
  nextStepLabel: string;
  lastRunLabel: string;
  nextRunLabel: string;
  pendingActionLabel: string;
  scheduleLabel: string;
  lastRunStatus?: AgentRunStatus;
};

export type AgentRun = {
  id: string;
  triggerType: RuntimeRunType;
  status: AgentRunTrackingStatus;
  phase: AgentRunPhase;
  statusLabel: string;
  phaseLabel: string;
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  updatedLabel: string;
  startedLabel: string;
  endedLabel?: string;
  summary?: string;
  resultCounts?: Record<string, number>;
  liveUrl?: string;
  browserUseTaskId?: string;
  error?: string;
  errorCategory?: AgentRunErrorCategory;
};

export type AgentEvent = {
  id: string;
  time: string;
  agentName: string;
  title: string;
  detail: string;
  kind: "success" | "warning" | "error";
};

export type LabOpening = {
  id: string;
  labName: string;
  professorName: string;
  professorEmail: string;
  department: string;
  researchArea: string;
  source: string;
  postedDate?: string;
  deadline?: string;
  requirements?: string;
  matchScore: number;
  status: LabOpeningStatus;
  emailDraft?: string;
  emailSentAt?: number;
};

export type RegistrationMonitor = {
  id: string;
  courseNumber: string;
  uniqueId: string;
  semester: string;
  status: MonitorStatus;
  pollInterval: number;
  updatedAt?: number;
};

export type ScholarshipMatch = {
  id: string;
  title: string;
  source: string;
  deadline?: number;
  matchScore?: number;
  status: ScholarshipStatus;
  missingFields?: string[];
  updatedAt: number;
};

export type PendingAction = {
  id: string;
  type: PendingActionType;
  prompt: string;
  createdAt: number;
  resolvedAt?: number;
};

export type AgentDetailData = {
  currentRun?: AgentRun;
  runs: AgentRun[];
  timeline: AgentEvent[];
  scholarships: ScholarshipMatch[];
  registrationMonitors: RegistrationMonitor[];
  labOpenings: LabOpening[];
  pendingActions: PendingAction[];
  isLoading: boolean;
};

export type StudioDraft = {
  id: string;
  title: string;
  state: string;
  summary: string;
  prompt: string;
  agentId?: string;
  generatedScript?: string;
  specResult?: FlowforgeWorkflowSpecResult;
  draftPayload?: TemplateDraftPayload;
};

export type SettingsSection = {
  title: string;
  description: string;
};

export type FilterOption = {
  label: string;
  value: string;
};

export type ProfileFormValues = {
  name: string;
  email: string;
  eid: string;
  major: string;
  classification: string;
  scholarshipInterests: string;
  notifications: string;
};

export type CurrentUserProfile = UserProfileRecord;
