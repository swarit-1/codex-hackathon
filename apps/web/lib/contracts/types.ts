export type AgentStatus = "active" | "paused" | "completed" | "error";
export type ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired";
export type MonitorStatus = "watching" | "registered" | "failed";
export type PendingActionType = "essay" | "detail" | "confirmation";
export type TemplateSource = "dev" | "student";
export type SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected";
export type TemplateVisibility = "private" | "public";

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
};

export type Agent = {
  id: string;
  name: string;
  templateId: string;
  source: TemplateSource;
  type: "scholar" | "reg" | "custom";
  status: AgentStatus;
  lastRunLabel: string;
  nextRunLabel: string;
  pendingActionLabel: string;
  scheduleLabel: string;
};

export type AgentEvent = {
  id: string;
  time: string;
  agentName: string;
  title: string;
  detail: string;
  kind: "success" | "warning" | "error";
};

export type StudioDraft = {
  id: string;
  title: string;
  state: string;
  summary: string;
};

export type SettingsSection = {
  title: string;
  description: string;
};

export type FilterOption = {
  label: string;
  value: string;
};
