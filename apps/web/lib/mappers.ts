import type {
  Agent,
  AgentEvent,
  MarketplaceTemplate,
  StudioDraft,
} from "./contracts/types";

/**
 * Maps a backend MarketplaceTemplateRecord (from Convex) to the frontend
 * MarketplaceTemplate UI type used by components.
 */
export function toMarketplaceTemplate(record: {
  id: string;
  title: string;
  description: string;
  source: "dev" | "student";
  category: string;
  visibility: "private" | "public";
  templateType: string;
  installCount: number;
  templateConfig: {
    defaultSchedule?: { enabled: boolean; cron: string; timezone: string };
    inputSchema?: { fields?: Array<{ label: string }> };
    defaultConfig?: { cadenceLabel?: string; outcomes?: string[] };
    currentConfig?: { cadenceLabel?: string; outcomes?: string[] };
  };
  approvedAt?: number;
  archivedAt?: number;
}): MarketplaceTemplate {
  const config = record.templateConfig;
  const fields = (config.inputSchema as any)?.fields as
    | Array<{ label: string }>
    | undefined;

  const cadenceLabel =
    (config.currentConfig as any)?.cadenceLabel ??
    (config.defaultConfig as any)?.cadenceLabel ??
    (config.defaultSchedule?.cron || "Manual");

  const outcomes: string[] =
    (config.currentConfig as any)?.outcomes ??
    (config.defaultConfig as any)?.outcomes ??
    [];

  let trustLabel: string;
  let status: MarketplaceTemplate["status"];

  if (record.source === "dev") {
    trustLabel = "LonghorNet official";
    status = "ready";
  } else if (record.approvedAt) {
    trustLabel = "Reviewed student workflow";
    status = "approved";
  } else {
    trustLabel = "Pending moderation update";
    status = "pending_review";
  }

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    source: record.source,
    category: record.category,
    installs: record.installCount,
    trustLabel,
    visibility: record.visibility,
    status,
    scheduleDefault: cadenceLabel,
    setupFields: fields?.map((f) => f.label) ?? [],
    outcomes,
  };
}

/**
 * Maps a backend AgentRecord + related data to the frontend Agent UI type.
 */
export function toAgentUI(
  record: {
    id: string;
    userId: string;
    templateId?: string;
    ownerType: string;
    type: "scholar" | "reg" | "custom";
    status: "active" | "paused" | "completed" | "error";
    config: { defaultConfig?: { title?: string }; currentConfig?: { title?: string; cadenceLabel?: string } };
    schedule: { enabled: boolean; cron: string };
    lastRunStatus: string;
    lastRunAt?: number;
    nextRunAt?: number;
  },
  templateTitle?: string,
  pendingCount?: number
): Agent {
  const name =
    templateTitle ??
    (record.config.currentConfig as any)?.title ??
    (record.config.defaultConfig as any)?.title ??
    `Agent ${record.id.slice(-4)}`;

  const source: "dev" | "student" =
    record.ownerType === "first_party" ? "dev" : "student";

  return {
    id: record.id,
    name,
    templateId: record.templateId ?? "",
    source,
    type: record.type,
    status: record.status,
    lastRunLabel: formatLastRun(record.lastRunStatus, record.lastRunAt),
    nextRunLabel: formatNextRun(record.nextRunAt, record.status),
    pendingActionLabel:
      pendingCount && pendingCount > 0
        ? `${pendingCount} action${pendingCount > 1 ? "s" : ""} pending`
        : "No pending action",
    scheduleLabel: record.schedule.enabled
      ? ((record.config.currentConfig as any)?.cadenceLabel ?? record.schedule.cron)
      : "Manual",
  };
}

function formatLastRun(status: string, at?: number): string {
  if (!at) return "Never run";
  const ago = formatTimeAgo(at);
  switch (status) {
    case "succeeded":
      return `Completed ${ago}`;
    case "failed":
      return `Failed ${ago}`;
    case "running":
      return `Running since ${ago}`;
    default:
      return `Last run ${ago}`;
  }
}

function formatNextRun(at?: number, agentStatus?: string): string {
  if (agentStatus === "paused") return "Resume to continue";
  if (agentStatus === "error") return "Fix error to continue";
  if (!at) return "Not scheduled";
  const d = new Date(at);
  return d.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Maps a backend AgentLogRecord to the frontend AgentEvent UI type.
 */
export function toAgentEvent(
  record: {
    id: string;
    agentId: string;
    timestamp: number;
    event: string;
    level: "info" | "warning" | "error";
    details: unknown;
  },
  agentName?: string
): AgentEvent {
  const details = record.details as {
    title?: string;
    detail?: string;
  } | null;

  const kindMap: Record<string, AgentEvent["kind"]> = {
    info: "success",
    warning: "warning",
    error: "error",
  };

  return {
    id: record.id,
    time: new Date(record.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    agentName: agentName ?? record.agentId.slice(-6),
    title: details?.title ?? record.event.replace(/\./g, " "),
    detail: details?.detail ?? "",
    kind: kindMap[record.level] ?? "success",
  };
}

/**
 * Maps a backend CustomWorkflowRecord to the frontend StudioDraft UI type.
 */
export function toStudioDraft(record: {
  id: string;
  prompt: string;
  spec?: unknown;
  generatedScript?: string;
}): StudioDraft {
  const specResult = record.spec as { title?: string; summary?: string } | null;
  const hasScript = !!record.generatedScript;

  return {
    id: record.id,
    title: specResult?.title ?? record.prompt.slice(0, 50),
    state: hasScript ? "Spec ready" : "Generating",
    summary: specResult?.summary ?? record.prompt,
  };
}
