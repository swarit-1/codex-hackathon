import type {
  Agent,
  AgentEvent,
  AgentRun,
  MarketplaceTemplate,
  PendingAction,
  RegistrationMonitor,
  ScholarshipMatch,
  StudioDraft,
} from "./contracts/types";
import type {
  ConfigEnvelope,
  FlowforgeWorkflowSpecResult,
} from "@convex/types/contracts";

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
  } & ConfigEnvelope;
  ownerUserId?: string;
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

  const { iconKey, iconGlyph } = resolveTemplateIcon(record.title, record.category, record.source);
  const imageSrc = resolveTemplateImage(record.title, iconKey);

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
    templateConfig: record.templateConfig,
    ownerUserId: record.ownerUserId,
    approvedAt: record.approvedAt,
    archivedAt: record.archivedAt,
    imageSrc,
    iconKey,
    iconGlyph,
  };
}

function resolveTemplateImage(title: string, iconKey: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const known: Record<string, string> = {
    regbot: "/workflows/regbot.svg",
    scholarbot: "/workflows/scholarbot.svg",
    "financial-aid-audit": "/workflows/financial-aid-audit.svg",
    "lab-openings-watch": "/workflows/lab-openings-watch.svg",
    "conference-travel-fund-tracker": "/workflows/conference-travel-fund-tracker.svg",
    "study-abroad-bot": "/workflows/study-abroad-bot.svg",
    "intramural-sports-bot": "/workflows/intramural-sports-bot.svg",
  };

  return known[slug] ?? `/workflows/${iconKey}.svg`;
}

function resolveTemplateIcon(title: string, category: string, source: "dev" | "student") {
  const normalizedTitle = title.toLowerCase();
  const normalizedCategory = category.toLowerCase();

  if (normalizedTitle.includes("reg")) {
    return { iconKey: "registration", iconGlyph: "RG" };
  }

  if (normalizedTitle.includes("scholar")) {
    return { iconKey: "scholarship", iconGlyph: "SC" };
  }

  if (normalizedTitle.includes("lab") || normalizedCategory.includes("research")) {
    return { iconKey: "research", iconGlyph: "LB" };
  }

  if (normalizedTitle.includes("travel") || normalizedTitle.includes("fund")) {
    return { iconKey: "funding", iconGlyph: "TR" };
  }

  if (normalizedCategory.includes("admin")) {
    return { iconKey: "admin", iconGlyph: "AD" };
  }

  return source === "dev"
    ? { iconKey: "official", iconGlyph: "LH" }
    : { iconKey: "student", iconGlyph: "ST" };
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
    type: "scholar" | "reg" | "eureka" | "custom" | "im";
    status: "active" | "paused" | "completed" | "error";
    config: { defaultConfig?: { title?: string }; currentConfig?: { title?: string; cadenceLabel?: string } };
    schedule: { enabled: boolean; cron: string };
    lastRunStatus: string;
    lastRunAt?: number;
    nextRunAt?: number;
  },
  templateTitle?: string,
  pendingCount?: number,
  currentRun?: {
    id: string;
    triggerType: "manual" | "scheduled" | "resume";
    status: "queued" | "launching" | "running" | "waiting_for_input" | "succeeded" | "failed" | "cancelled";
    phase: "queued" | "starting_browser" | "navigating" | "authenticating" | "scanning" | "extracting" | "writing_results" | "completed" | "failed";
    startedAt: number;
    updatedAt: number;
    endedAt?: number;
    browserUseTaskId?: string;
    liveUrl?: string;
    summary?: string;
    resultCounts?: Record<string, number>;
    error?: string;
    errorCategory?: "configuration" | "authentication" | "site_changed" | "provider_error" | "timeout" | "unknown";
  }
): Agent {
  const name =
    templateTitle ??
    (record.config.currentConfig as any)?.title ??
    (record.config.defaultConfig as any)?.title ??
    `Agent ${record.id.slice(-4)}`;

  const source: "dev" | "student" =
    record.ownerType === "first_party" ? "dev" : "student";

  const pendingActionCount = pendingCount ?? 0;
  const mappedRun = currentRun ? toAgentRunUI(currentRun) : undefined;
  const latestSummary =
    mappedRun?.summary ??
    (mappedRun?.status === "failed"
      ? mappedRun.error ?? "The latest run failed."
      : formatLastRun(record.lastRunStatus, record.lastRunAt));
  const nextStepLabel =
    mappedRun?.status === "waiting_for_input"
      ? "Needs your input"
      : pendingActionCount > 0
        ? `${pendingActionCount} action${pendingActionCount === 1 ? "" : "s"} pending`
        : "No action needed";

  return {
    id: record.id,
    name,
    templateId: record.templateId ?? "",
    source,
    type: record.type,
    status: record.status,
    pendingActionCount,
    currentRun: mappedRun,
    latestSummary,
    nextStepLabel,
    lastRunLabel: formatLastRun(record.lastRunStatus, record.lastRunAt),
    nextRunLabel: formatNextRun(record.nextRunAt, record.status),
    pendingActionLabel: pendingActionCount > 0
      ? `${pendingActionCount} action${pendingActionCount > 1 ? "s" : ""} pending`
      : "No pending action",
    scheduleLabel: record.schedule.enabled
      ? ((record.config.currentConfig as any)?.cadenceLabel ?? record.schedule.cron)
      : "Manual",
    lastRunStatus: record.lastRunStatus as Agent["lastRunStatus"],
  };
}

export function toAgentRunUI(record: {
  id: string;
  triggerType: "manual" | "scheduled" | "resume";
  status: "queued" | "launching" | "running" | "waiting_for_input" | "succeeded" | "failed" | "cancelled";
  phase: "queued" | "starting_browser" | "navigating" | "authenticating" | "scanning" | "extracting" | "writing_results" | "completed" | "failed";
  startedAt: number;
  updatedAt: number;
  endedAt?: number;
  browserUseTaskId?: string;
  liveUrl?: string;
  summary?: string;
  resultCounts?: Record<string, number>;
  error?: string;
  errorCategory?: "configuration" | "authentication" | "site_changed" | "provider_error" | "timeout" | "unknown";
}): AgentRun {
  return {
    id: record.id,
    triggerType: record.triggerType,
    status: record.status,
    phase: record.phase,
    statusLabel: formatRunStatus(record.status),
    phaseLabel: formatRunPhase(record.phase),
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    endedAt: record.endedAt,
    updatedLabel: formatTimeAgo(record.updatedAt),
    startedLabel: formatAbsoluteTime(record.startedAt),
    endedLabel: record.endedAt ? formatAbsoluteTime(record.endedAt) : undefined,
    summary: record.summary,
    resultCounts: record.resultCounts,
    liveUrl: record.liveUrl,
    browserUseTaskId: record.browserUseTaskId,
    error: record.error,
    errorCategory: record.errorCategory,
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

function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRunStatus(status: string): string {
  switch (status) {
    case "waiting_for_input":
      return "Waiting on you";
    case "launching":
      return "Launching";
    default:
      return formatStatusText(status);
  }
}

function formatRunPhase(phase: string): string {
  switch (phase) {
    case "starting_browser":
      return "Launching browser";
    case "writing_results":
      return "Writing results";
    default:
      return formatStatusText(phase);
  }
}

function formatStatusText(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

export function toScholarshipMatch(record: {
  id: string;
  title: string;
  source: string;
  deadline?: number;
  matchScore?: number;
  status: "found" | "applying" | "paused" | "submitted" | "expired";
  missingFields?: string[];
  updatedAt: number;
}): ScholarshipMatch {
  return {
    id: record.id,
    title: record.title,
    source: record.source,
    deadline: record.deadline,
    matchScore: record.matchScore,
    status: record.status,
    missingFields: record.missingFields,
    updatedAt: record.updatedAt,
  };
}

export function toRegistrationMonitor(record: {
  id: string;
  courseNumber: string;
  uniqueId: string;
  semester: string;
  status: "watching" | "registered" | "failed";
  pollInterval: number;
  updatedAt?: number;
}): RegistrationMonitor {
  return {
    id: record.id,
    courseNumber: record.courseNumber,
    uniqueId: record.uniqueId,
    semester: record.semester,
    status: record.status,
    pollInterval: record.pollInterval,
    updatedAt: record.updatedAt,
  };
}

export function toPendingAction(record: {
  id: string;
  type: "essay" | "detail" | "confirmation" | "email_draft";
  prompt: string;
  createdAt: number;
  resolvedAt?: number;
}): PendingAction {
  return {
    id: record.id,
    type: record.type,
    prompt: record.prompt,
    createdAt: record.createdAt,
    resolvedAt: record.resolvedAt,
  };
}

/**
 * Maps a backend CustomWorkflowRecord to the frontend StudioDraft UI type.
 */
export function toStudioDraft(record: {
  id: string;
  prompt: string;
  agentId?: string;
  spec?: unknown;
  generatedScript?: string;
}): StudioDraft {
  const specResult = (record.spec as FlowforgeWorkflowSpecResult | null) ?? undefined;
  const hasScript = !!record.generatedScript;

  return {
    id: record.id,
    title: specResult?.title ?? record.prompt.slice(0, 50),
    state: hasScript ? "Spec ready" : "Generating",
    summary: specResult?.summary ?? record.prompt,
    prompt: record.prompt,
    agentId: record.agentId,
    generatedScript: record.generatedScript,
    specResult,
    draftPayload: specResult?.draftPayload,
  };
}
