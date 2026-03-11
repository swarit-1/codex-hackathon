import { internalAction, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import { getRegistrationTargets, hydrateRuntimeConfig } from "./lib/agentConfig";
import type {
  AgentRunErrorCategory,
  AgentRunPhase,
  AgentRunRecord,
  AgentRunTrackingStatus,
  AgentRecord,
  AgentType,
  ConfigEnvelope,
  JsonValue,
  LabOpeningRecord,
  PendingActionRecord,
  JsonObject,
  RegistrationMonitorRecord,
  ScholarshipRecord,
} from "./types/contracts";

// ---------------------------------------------------------------------------
// Browser Use API helpers
// ---------------------------------------------------------------------------

const BROWSER_USE_API_URL = "https://api.browser-use.com/api/v2";

type RuntimeProcessingResult = {
  summary?: string;
  resultCounts?: JsonObject;
};

function getCurrentConfig(config: ConfigEnvelope): JsonObject {
  return (config.currentConfig ?? config.defaultConfig) as JsonObject;
}

function phaseLabel(phase: AgentRunPhase): string {
  return phase.replace(/_/g, " ");
}

function trackingStatusToAgentRunStatus(
  status: AgentRunTrackingStatus
): AgentRecord["lastRunStatus"] {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "running";
  }
}

function categorizeRuntimeError(message?: string): AgentRunErrorCategory | undefined {
  if (!message) {
    return undefined;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("browser_use_api_key") ||
    normalized.includes("not configured") ||
    normalized.includes("missing")
  ) {
    return "configuration";
  }

  if (
    normalized.includes("auth") ||
    normalized.includes("login") ||
    normalized.includes("password") ||
    normalized.includes("credential") ||
    normalized.includes("duo") ||
    normalized.includes("sign in")
  ) {
    return "authentication";
  }

  if (
    normalized.includes("404") ||
    normalized.includes("selector") ||
    normalized.includes("layout") ||
    normalized.includes("page changed") ||
    normalized.includes("not found")
  ) {
    return "site_changed";
  }

  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "timeout";
  }

  if (
    normalized.includes("browser use api error") ||
    normalized.includes("poll error") ||
    normalized.includes("provider")
  ) {
    return "provider_error";
  }

  return "unknown";
}

function inferRunPhase(snapshot: { output?: string; steps?: unknown[] }): AgentRunPhase {
  const stepText = Array.isArray(snapshot.steps) ? JSON.stringify(snapshot.steps).toLowerCase() : "";
  const outputText = (snapshot.output ?? "").toLowerCase();
  const haystack = `${stepText} ${outputText}`;

  if (
    haystack.includes("duo") ||
    haystack.includes("login") ||
    haystack.includes("sign in") ||
    haystack.includes("password") ||
    haystack.includes("authenticat")
  ) {
    return "authenticating";
  }

  if (haystack.includes("extract") || haystack.includes("json") || haystack.includes("summary")) {
    return "extracting";
  }

  if (haystack.includes("navigate") || haystack.includes("page") || haystack.includes("open url")) {
    return "navigating";
  }

  return "scanning";
}

function inferTrackingStatus(browserStatus: string): AgentRunTrackingStatus {
  const normalized = browserStatus.toLowerCase();

  if (
    normalized.includes("waiting") ||
    normalized.includes("paused") ||
    normalized.includes("input") ||
    normalized.includes("blocked")
  ) {
    return "waiting_for_input";
  }

  if (normalized.includes("launch") || normalized.includes("queue") || normalized.includes("pending")) {
    return "launching";
  }

  return "running";
}

function buildRunTransitionEvent(
  status: AgentRunTrackingStatus,
  phase: AgentRunPhase
): { event: string; title: string } {
  if (status === "queued") {
    return {
      event: "agent.run.queued",
      title: "Run queued",
    };
  }

  if (status === "launching") {
    return {
      event: "agent.runtime.starting_browser",
      title: "Launching browser",
    };
  }

  if (status === "waiting_for_input") {
    return {
      event: "agent.runtime.waiting_for_input",
      title: "Waiting on you",
    };
  }

  if (status === "succeeded") {
    return {
      event: "agent.runtime.completed",
      title: "Run completed",
    };
  }

  if (status === "failed") {
    return {
      event: "agent.runtime.failed",
      title: "Run failed",
    };
  }

  if (status === "cancelled") {
    return {
      event: "agent.runtime.cancelled",
      title: "Run cancelled",
    };
  }

  return {
    event: `agent.runtime.${phase}`,
    title: phaseLabel(phase).replace(/^\w/, (character) => character.toUpperCase()),
  };
}

function normalizeStringList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return fallback;
}

async function buildTaskPrompt(agentType: AgentType, config: ConfigEnvelope): Promise<string> {
  const runtimeConfig = await hydrateRuntimeConfig(config);
  const currentConfig = getCurrentConfig(runtimeConfig);
  const targetUrl = (currentConfig.targetUrl as string) ?? "";

  switch (agentType) {
    case "scholar": {
      const sources = normalizeStringList(currentConfig.sources, ["UT Scholarships"]);
      const major =
        (currentConfig.major as string) ??
        ((currentConfig.profile as JsonObject | undefined)?.major as string) ??
        "Computer Science";
      const classification =
        (currentConfig.classification as string) ??
        ((currentConfig.profile as JsonObject | undefined)?.classification as string) ??
        "Undergraduate";
      const essayNotes = (currentConfig.essayNotes as string) ?? "";

      return `You are a scholarship discovery agent for a UT Austin ${classification} ${major} student.

GOAL: Navigate to the scholarship search page and find relevant scholarships.

1. Navigate to ${targetUrl || "https://utexas.scholarships.ngwebsolutions.com/ScholarX_StudentLanding.aspx"}.
2. Search through available scholarships.
3. Focus on scholarships that plausibly fit the student profile and are still open or upcoming.
4. For each scholarship found, capture: title, source, deadline, eligibility requirements, fit score from 0 to 1, and any missing materials.
5. Do not submit or finalize any applications.

Student notes:
- Sources to check: ${sources.join(", ")}
${essayNotes ? `- Resume and essay notes: ${essayNotes}` : "- Resume and essay notes: none provided"}

Return the final result as JSON only inside a \`\`\`json code block using this shape:
{
  "scholarships": [
    {
      "title": "string",
      "source": "string",
      "deadline": "YYYY-MM-DD or null",
      "eligibility": "string",
      "matchScore": 0.0,
      "status": "found",
      "missingFields": ["string"]
    }
  ],
  "summary": "string"
}`;
    }

    case "reg": {
      const eidLogin = (currentConfig.eidLogin as string) ?? "";
      const eidPassword = (currentConfig.eidPassword as string) ?? "";
      const conflictPolicy = (currentConfig.conflictPolicy as string) ?? "";
      const courseTargets = getRegistrationTargets(runtimeConfig);
      const courseTargetLines =
        courseTargets.length > 0
          ? courseTargets
              .map(
                (target, index) =>
                  `${index + 1}. ${target.courseNumber} (Unique ID: ${target.uniqueId}) for ${target.semester}`
              )
              .join("\n")
          : "1. Review the configured course target.";

      return `You are a class registration monitor for a UT Austin student.

GOAL: Check if seats are available for the student's configured UT registration targets.

1. Navigate to ${targetUrl || "https://utdirect.utexas.edu/registration/classlist/nologin/"}.
2. Check these course targets:
${courseTargetLines}
3. For each target, check if there are any open seats available.
4. If login is needed, use the provided EID login and password only if both are supplied for this run. Do not guess credentials.
5. Report the current enrollment status for each target: total seats, seats taken, seats available, and waitlist count if any.
6. Do not attempt to register for any class.

Student preferences:
- EID login: ${eidLogin || "not provided"}
- EID password: ${eidPassword ? "provided for this run" : "not provided"}
${conflictPolicy ? `- Conflict policy: ${conflictPolicy}` : "- Conflict policy: none provided"}

Return the final result as JSON only inside a \`\`\`json code block using this shape:
{
  "courses": [
    {
      "courseNumber": "string",
      "uniqueId": "string",
      "semester": "string",
      "status": "open | closed | waitlist | unknown",
      "totalSeats": 0,
      "seatsTaken": 0,
      "seatsAvailable": 0,
      "waitlistCount": 0,
      "notes": "string"
    }
  ],
  "summary": "string"
}`;
    }

    case "eureka": {
      const researchInterests = normalizeStringList(currentConfig.researchInterests, []);
      const departmentTargets = normalizeStringList(currentConfig.departmentTargets, ["Computer Science"]);
      const facultyList = normalizeStringList(currentConfig.facultyList, []);

      return `You are a UT Austin research-lab opportunity scout.

GOAL: Find active lab openings or research opportunities that fit the student's interests, then draft outreach notes without sending anything.

1. Navigate to ${targetUrl || "https://eureka-prod.herokuapp.com/opportunities"}.
2. Search for open undergraduate research opportunities.
3. Prioritize matches in these departments: ${departmentTargets.join(", ")}.
4. Prioritize research interests matching: ${researchInterests.join(", ") || "general computer science research"}.
5. If the user provided a faculty list, treat those faculty as higher priority: ${facultyList.join(", ") || "none"}.
6. Capture only openings that look active and actionable.
7. Do not apply, email, or submit any forms.

Return the final result as JSON only inside a \`\`\`json code block using this shape:
{
  "openings": [
    {
      "labName": "string",
      "professorName": "string",
      "professorEmail": "string",
      "department": "string",
      "researchArea": "string",
      "source": "string",
      "postedDate": "YYYY-MM-DD or null",
      "deadline": "YYYY-MM-DD or null",
      "requirements": "string",
      "matchScore": 0.0,
      "emailDraft": "string"
    }
  ],
  "summary": "string"
}`;
    }

    case "custom":
    default: {
      const taskDescription = (currentConfig.taskDescription as string) ?? "";
      if (taskDescription) {
        return taskDescription;
      }
      if (targetUrl) {
        return `Navigate to ${targetUrl} and report what you find on the page.`;
      }
      return "No task configured for this agent.";
    }
  }
}

async function callBrowserUseAPI(
  apiKey: string,
  taskPrompt: string
): Promise<{ taskId: string; liveUrl: string }> {
  const session = await createBrowserUseSession(apiKey);
  const taskResponse = await createBrowserUseTask(apiKey, taskPrompt, session.id);
  const taskData = await taskResponse.json();
  const taskId = taskData.id ?? taskData.task_id ?? "";

  if (!taskId) {
    throw new Error("Browser Use API returned no task id.");
  }

  return {
    taskId,
    liveUrl: session.liveUrl,
  };
}

async function createBrowserUseSession(
  apiKey: string
): Promise<{ id: string; liveUrl: string }> {
  const response = await fetch(`${BROWSER_USE_API_URL}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Browser-Use-API-Key": apiKey,
    },
    body: JSON.stringify({
      keepAlive: true,
      persistMemory: true,
      enableRecording: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browser Use session API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const sessionId = data.id ?? data.session_id ?? "";
  const liveUrl = data.liveUrl ?? data.live_url ?? "";

  if (!sessionId || typeof liveUrl !== "string" || liveUrl.length === 0) {
    throw new Error("Browser Use session API returned no usable liveUrl.");
  }

  return {
    id: sessionId,
    liveUrl,
  };
}

async function createBrowserUseTask(
  apiKey: string,
  taskPrompt: string,
  sessionId: string
): Promise<Response> {
  const primaryResponse = await fetch(`${BROWSER_USE_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Browser-Use-API-Key": apiKey,
    },
    body: JSON.stringify({
      task: taskPrompt,
      sessionId,
    }),
  });

  if (primaryResponse.ok) {
    return primaryResponse;
  }

  if (primaryResponse.status !== 422) {
    const errorText = await primaryResponse.text();
    throw new Error(`Browser Use task API error (${primaryResponse.status}): ${errorText}`);
  }

  const fallbackResponse = await fetch(`${BROWSER_USE_API_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Browser-Use-API-Key": apiKey,
    },
    body: JSON.stringify({
      task: taskPrompt,
    }),
  });

  if (!fallbackResponse.ok) {
    const errorText = await fallbackResponse.text();
    throw new Error(`Browser Use task API error (${fallbackResponse.status}): ${errorText}`);
  }

  return fallbackResponse;
}

async function pollBrowserUseTask(
  apiKey: string,
  taskId: string
): Promise<{ status: string; output?: string; steps?: unknown[] }> {
  const response = await fetch(`${BROWSER_USE_API_URL}/tasks/${taskId}`, {
    method: "GET",
    headers: {
      "X-Browser-Use-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browser Use API poll error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    status: data.status ?? "unknown",
    output: data.output ?? data.result ?? data.finalResult,
    steps: data.steps,
  };
}

type ParsedJsonObject = Record<string, unknown>;

function asObject(value: unknown): ParsedJsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as ParsedJsonObject;
}

function parseJsonCandidate(candidate: string): ParsedJsonObject | null {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return asObject(parsed);
  } catch {
    return null;
  }
}

function extractJsonPayload(output: string): ParsedJsonObject | null {
  const candidates: string[] = [];
  const trimmed = output.trim();

  const fencedMatch =
    trimmed.match(/```json\s*([\s\S]*?)```/i) ??
    trimmed.match(/```\s*([\s\S]*?)```/);

  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  candidates.push(trimmed);

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const parsed = parseJsonCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]+/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => toNonEmptyString(entry)).filter((entry): entry is string => Boolean(entry));
  }

  const single = toNonEmptyString(value);
  if (!single) {
    return [];
  }

  return single
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function ensurePendingAction(
  ctx: MutationCtx,
  args: {
    userId: string;
    agentId: string;
    type: PendingActionRecord["type"];
    prompt: string;
  }
): Promise<void> {
  const existing = await queryByIndex<Omit<PendingActionRecord, "id">>(
    ctx,
    "pendingActions",
    "by_agentId",
    [["agentId", args.agentId]]
  );

  const hasOpenMatch = existing.some(
    (action) =>
      !(action as { resolvedAt?: number }).resolvedAt &&
      (action as { type: PendingActionRecord["type"] }).type === args.type &&
      (action as { prompt: string }).prompt === args.prompt
  );

  if (hasOpenMatch) {
    return;
  }

  await insertDoc(ctx, "pendingActions", {
    userId: args.userId,
    agentId: args.agentId,
    type: args.type,
    prompt: args.prompt,
    response: undefined,
    resolvedAt: undefined,
    createdAt: Date.now(),
  });
}

async function processScholarshipOutput(
  ctx: MutationCtx,
  agent: AgentRecord,
  output: string,
  runId?: string
): Promise<RuntimeProcessingResult> {
  const payload = extractJsonPayload(output);
  const scholarships = Array.isArray(payload?.scholarships) ? payload.scholarships : [];
  const summary = toNonEmptyString(payload?.summary);

  const existing = await queryByIndex<Omit<ScholarshipRecord, "id">>(
    ctx,
    "scholarships",
    "by_agentId",
    [["agentId", agent.id]]
  );
  const existingByKey = new Map(
    existing.map((record) => {
      const title = toNonEmptyString((record as { title?: unknown }).title) ?? "";
      const source = toNonEmptyString((record as { source?: unknown }).source) ?? "";
      return [`${title}::${source}`, record];
    })
  );

  let processedCount = 0;
  let highPriorityCount = 0;

  for (const entry of scholarships) {
    const record = asObject(entry);
    if (!record) {
      continue;
    }

    const title = toNonEmptyString(record.title);
    const source = toNonEmptyString(record.source);

    if (!title || !source) {
      continue;
    }

    const timestamp = Date.now();
    const matchScore = Math.max(0, Math.min(1, toFiniteNumber(record.matchScore) ?? 0.5));
    const missingFields = normalizeStringArray(record.missingFields);
    const deadline = toTimestamp(record.deadline);
    const eligibility = toNonEmptyString(record.eligibility);
    const status =
      record.status === "applying" || record.status === "paused" || record.status === "submitted" || record.status === "expired"
        ? record.status
        : "found";

    const existingRecord = existingByKey.get(`${title}::${source}`);

    if (existingRecord) {
      await patchDoc(ctx, String((existingRecord as { _id: string })._id), {
        deadline,
        eligibility,
        matchScore,
        status,
        missingFields,
        updatedAt: timestamp,
      });
    } else {
      await insertDoc(ctx, "scholarships", {
        userId: agent.userId,
        agentId: agent.id,
        title,
        source,
        deadline,
        eligibility,
        matchScore,
        status,
        missingFields,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    processedCount += 1;

    if (matchScore >= 0.75 || missingFields.length > 0) {
      highPriorityCount += 1;
      await appendAgentLog(ctx, {
        agentId: agent.id,
        runId,
        phase: "writing_results",
        event: "scholarship.match.found",
        details: {
          title: "Scholarship match found",
          detail: `${title} from ${source}${deadline ? ` · deadline ${new Date(deadline).toLocaleDateString("en-US")}` : ""}`,
          scholarshipTitle: title,
          source,
          matchScore,
          missingFields,
        },
      });
    }

    if (missingFields.length > 0) {
      const actionType: PendingActionRecord["type"] = missingFields.some((field) => field.toLowerCase().includes("essay"))
        ? "essay"
        : "detail";
      await ensurePendingAction(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        type: actionType,
        prompt: `${title} needs attention: ${missingFields.join(", ")}`,
      });
    }
  }

  await appendAgentLog(ctx, {
    agentId: agent.id,
    runId,
    phase: "writing_results",
    event: "scholarship.scan.completed",
    details: {
      title: "Scholarship scan completed",
      detail:
        summary ??
        (processedCount > 0
          ? `${processedCount} scholarship match${processedCount === 1 ? "" : "es"} processed, ${highPriorityCount} high priority.`
          : "No scholarship matches were parsed from the latest run."),
      processedCount,
      highPriorityCount,
    },
  });

  return {
    summary:
      summary ??
      (processedCount > 0
        ? `${processedCount} scholarship match${processedCount === 1 ? "" : "es"} found, ${highPriorityCount} high priority.`
        : "No scholarship matches found in the latest run."),
    resultCounts: {
      matches: processedCount,
      highPriority: highPriorityCount,
      needsAttention: highPriorityCount,
    },
  };
}

async function processRegistrationOutput(
  ctx: MutationCtx,
  agent: AgentRecord,
  output: string,
  runId?: string
): Promise<RuntimeProcessingResult> {
  const payload = extractJsonPayload(output);
  const currentConfig = getCurrentConfig(agent.config);
  const fallbackSemester =
    toNonEmptyString(currentConfig.semester) ?? "Unknown semester";
  const rawCourses = Array.isArray(payload?.courses) ? payload.courses : [payload];
  const summary = toNonEmptyString(payload?.summary);
  const pollInterval = Math.max(1, toFiniteNumber(currentConfig.pollIntervalMinutes) ?? 10);
  const existingMonitors = await queryByIndex<Omit<RegistrationMonitorRecord, "id">>(
    ctx,
    "registrationMonitors",
    "by_agentId",
    [["agentId", agent.id]]
  );
  const existingByKey = new Map(
    existingMonitors.map((monitor) => [
      `${String((monitor as { uniqueId?: unknown }).uniqueId)}::${String((monitor as { semester?: unknown }).semester)}`,
      monitor,
    ])
  );

  let processedCount = 0;
  let coursesWithOpenSeats = 0;
  let totalSeatsAvailable = 0;
  let totalWaitlistCount = 0;

  for (const entry of rawCourses) {
    const record = asObject(entry);

    if (!record) {
      continue;
    }

    const courseNumber =
      toNonEmptyString(record.courseNumber) ??
      toNonEmptyString(currentConfig.courseNumber) ??
      "Unknown course";
    const uniqueId =
      toNonEmptyString(record.uniqueId) ??
      toNonEmptyString(currentConfig.uniqueId) ??
      "Unknown unique ID";
    const semester =
      toNonEmptyString(record.semester) ??
      fallbackSemester;
    const seatsAvailable = Math.max(0, toFiniteNumber(record.seatsAvailable) ?? 0);
    const waitlistCount = Math.max(0, toFiniteNumber(record.waitlistCount) ?? 0);
    const totalSeats = toFiniteNumber(record.totalSeats);
    const seatsTaken = toFiniteNumber(record.seatsTaken);
    const notes = toNonEmptyString(record.notes);
    const statusValue = toNonEmptyString(record.status)?.toLowerCase() ?? "unknown";
    const status: RegistrationMonitorRecord["status"] =
      statusValue === "unknown" && seatsAvailable === 0 && waitlistCount === 0 ? "failed" : "watching";
    const timestamp = Date.now();
    const existing = existingByKey.get(`${uniqueId}::${semester}`);

    if (existing) {
      await patchDoc(ctx, String((existing as { _id: string })._id), {
        courseNumber,
        uniqueId,
        semester,
        status,
        pollInterval,
        updatedAt: timestamp,
      });
    } else {
      await insertDoc(ctx, "registrationMonitors", {
        userId: agent.userId,
        agentId: agent.id,
        courseNumber,
        uniqueId,
        semester,
        status,
        pollInterval,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const detailParts = [
      `${courseNumber} (${uniqueId}) for ${semester}`,
      totalSeats !== undefined && seatsTaken !== undefined
        ? `${Math.max(totalSeats - seatsTaken, seatsAvailable)} seat${Math.max(totalSeats - seatsTaken, seatsAvailable) === 1 ? "" : "s"} open`
        : `${seatsAvailable} seat${seatsAvailable === 1 ? "" : "s"} open`,
      `waitlist ${waitlistCount}`,
    ];

    await appendAgentLog(ctx, {
      agentId: agent.id,
      runId,
      phase: "writing_results",
      event: seatsAvailable > 0 ? "registration.seat.available" : "registration.scan.completed",
      level: seatsAvailable > 0 ? "warning" : status === "failed" ? "error" : "info",
      details: {
        title: seatsAvailable > 0 ? "Seat alert" : "Registration check completed",
        detail: `${detailParts.join(" · ")}${notes ? ` · ${notes}` : ""}`,
        courseNumber,
        uniqueId,
        semester,
        seatsAvailable,
        waitlistCount,
        notes,
      },
    });

    if (seatsAvailable > 0) {
      coursesWithOpenSeats += 1;
      await ensurePendingAction(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        type: "confirmation",
        prompt: `Seat available for ${courseNumber} (${uniqueId}) in ${semester}. Review the opening now.`,
      });
    }

    processedCount += 1;
    totalSeatsAvailable += seatsAvailable;
    totalWaitlistCount += waitlistCount;
  }

  return {
    summary:
      summary ??
      (coursesWithOpenSeats > 0
        ? `${coursesWithOpenSeats} watched course${coursesWithOpenSeats === 1 ? "" : "s"} now ha${coursesWithOpenSeats === 1 ? "s" : "ve"} open seats.`
        : processedCount > 0
          ? `Checked ${processedCount} course target${processedCount === 1 ? "" : "s"}. No seats available right now.`
          : "No registration results were parsed from the latest run."),
    resultCounts: {
      coursesChecked: processedCount,
      openCourses: coursesWithOpenSeats,
      seatsAvailable: totalSeatsAvailable,
      waitlistCount: totalWaitlistCount,
    },
  };
}

async function processEurekaOutput(
  ctx: MutationCtx,
  agent: AgentRecord,
  output: string,
  runId?: string
): Promise<RuntimeProcessingResult> {
  const payload = extractJsonPayload(output);
  const openings = Array.isArray(payload?.openings) ? payload.openings : [];
  const summary = toNonEmptyString(payload?.summary);
  const existing = await queryByIndex<Omit<LabOpeningRecord, "id">>(
    ctx,
    "labOpenings",
    "by_agentId",
    [["agentId", agent.id]]
  );
  const existingByKey = new Map(
    existing.map((record) => {
      const labName = toNonEmptyString((record as { labName?: unknown }).labName) ?? "";
      const professorEmail = toNonEmptyString((record as { professorEmail?: unknown }).professorEmail) ?? "";
      return [`${labName}::${professorEmail}`, record];
    })
  );

  let processedCount = 0;
  let draftReadyCount = 0;

  for (const entry of openings) {
    const record = asObject(entry);
    if (!record) {
      continue;
    }

    const labName = toNonEmptyString(record.labName);
    const professorName = toNonEmptyString(record.professorName);
    const professorEmail = toNonEmptyString(record.professorEmail);
    const department = toNonEmptyString(record.department) ?? "Unknown department";
    const researchArea = toNonEmptyString(record.researchArea) ?? "General research";
    const source = toNonEmptyString(record.source) ?? "Eureka";

    if (!labName || !professorName || !professorEmail) {
      continue;
    }

    const timestamp = Date.now();
    const matchScore = Math.max(0, Math.min(1, toFiniteNumber(record.matchScore) ?? 0.75));
    const postedDate = toTimestamp(record.postedDate);
    const deadline = toTimestamp(record.deadline);
    const requirements = toNonEmptyString(record.requirements);
    const emailDraft = toNonEmptyString(record.emailDraft);
    const status: LabOpeningRecord["status"] = emailDraft ? "email_ready" : "discovered";
    const existingRecord = existingByKey.get(`${labName}::${professorEmail}`);
    const isNew = !existingRecord;

    if (existingRecord) {
      await patchDoc(ctx, String((existingRecord as { _id: string })._id), {
        professorName,
        professorEmail,
        department,
        researchArea,
        source,
        postedDate,
        deadline,
        requirements,
        matchScore,
        status,
        emailDraft,
        updatedAt: timestamp,
      });
    } else {
      await insertDoc(ctx, "labOpenings", {
        userId: agent.userId,
        agentId: agent.id,
        labName,
        professorName,
        professorEmail,
        department,
        researchArea,
        source,
        postedDate,
        deadline,
        requirements,
        matchScore,
        status,
        emailDraft,
        emailSentAt: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    processedCount += 1;

    await appendAgentLog(ctx, {
      agentId: agent.id,
      runId,
      phase: "writing_results",
      event: isNew ? "lab.opening.discovered" : "lab.opening.updated",
      details: {
        title: isNew ? "Lab opening discovered" : "Lab opening updated",
        detail: `${labName} · ${professorName}${deadline ? ` · deadline ${new Date(deadline).toLocaleDateString("en-US")}` : ""}`,
        labName,
        professorName,
        professorEmail,
        matchScore,
      },
    });

    if (emailDraft) {
      draftReadyCount += 1;
      await ensurePendingAction(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        type: "email_draft",
        prompt: `Review outreach draft for ${labName} (${professorName}).`,
      });
    }
  }

  await appendAgentLog(ctx, {
    agentId: agent.id,
    runId,
    phase: "writing_results",
    event: "lab.scan.completed",
    details: {
      title: "Lab opening scan completed",
      detail:
        summary ??
        (processedCount > 0
          ? `${processedCount} lab opening${processedCount === 1 ? "" : "s"} processed from the latest scan.`
          : "No lab openings were parsed from the latest run."),
      processedCount,
    },
  });

  return {
    summary:
      summary ??
      (processedCount > 0
        ? `${processedCount} lab opening${processedCount === 1 ? "" : "s"} found, ${draftReadyCount} outreach draft${draftReadyCount === 1 ? "" : "s"} ready.`
        : "No lab openings found in the latest run."),
    resultCounts: {
      openings: processedCount,
      draftsReady: draftReadyCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal mutation: update agent after runtime launch
// ---------------------------------------------------------------------------

export const updateAgentRunStatus = internalMutation({
  args: {
    agentId: v.string(),
    runId: v.optional(v.string()),
    browserUseTaskId: v.optional(v.string()),
    runStatus: v.string(),
    phase: v.optional(v.string()),
    liveUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    errorCategory: v.optional(v.string()),
    summary: v.optional(v.string()),
    resultCounts: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const runDoc = args.runId
      ? await getDoc<Omit<AgentRunRecord, "id">>(ctx, args.runId)
      : null;
    const phase = (args.phase as AgentRunPhase | undefined) ?? (runDoc?.phase as AgentRunPhase | undefined) ?? "queued";
    const runStatus = args.runStatus as AgentRunTrackingStatus;
    const patch: Record<string, unknown> = {
      lastRunStatus: trackingStatusToAgentRunStatus(runStatus),
      updatedAt: timestamp,
    };

    if (args.browserUseTaskId) {
      patch.browserUseTaskId = args.browserUseTaskId;
    }

    if (runStatus === "failed" || runStatus === "succeeded" || runStatus === "cancelled") {
      patch.status =
        runStatus === "failed" ? "error" : runStatus === "cancelled" ? "paused" : "active";
    } else {
      patch.status = "active";
    }

    await patchDoc(ctx, args.agentId, patch);

    if (args.runId && runDoc) {
      const runPatch: Record<string, unknown> = {
        status: runStatus,
        phase,
        updatedAt: timestamp,
      };

      if (args.browserUseTaskId) {
        runPatch.browserUseTaskId = args.browserUseTaskId;
      }

      if (args.liveUrl !== undefined) {
        runPatch.liveUrl = args.liveUrl;
      }

      if (args.summary !== undefined) {
        runPatch.summary = args.summary;
      }

      if (args.resultCounts !== undefined) {
        runPatch.resultCounts = args.resultCounts;
      }

      if (args.error !== undefined) {
        runPatch.error = args.error;
      }

      if (args.errorCategory !== undefined) {
        runPatch.errorCategory = args.errorCategory;
      }

      if (runStatus === "succeeded" || runStatus === "failed" || runStatus === "cancelled") {
        runPatch.endedAt = timestamp;
      }

      await patchDoc(ctx, args.runId, runPatch);
    }

    const previousStatus = runDoc?.status as AgentRunTrackingStatus | undefined;
    const previousPhase = runDoc?.phase as AgentRunPhase | undefined;
    const shouldLogTransition =
      !runDoc ||
      previousStatus !== runStatus ||
      previousPhase !== phase ||
      (args.error && args.error !== runDoc.error) ||
      (args.summary && args.summary !== runDoc.summary);

    if (!shouldLogTransition) {
      return;
    }

    const transition = buildRunTransitionEvent(runStatus, phase);
    const detail =
      args.summary ??
      (runStatus === "failed"
        ? args.error ?? "Runtime execution failed."
        : runStatus === "waiting_for_input"
          ? "The agent needs your attention before it can continue."
          : args.liveUrl
            ? "Browser task is running and progress is updating in-app."
            : `Current phase: ${phaseLabel(phase)}.`);

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: args.runId,
      event: transition.event,
      phase,
      level: runStatus === "failed" ? "error" : runStatus === "waiting_for_input" ? "warning" : "info",
      details: {
        title: transition.title,
        detail,
        browserUseTaskId: args.browserUseTaskId ?? runDoc?.browserUseTaskId,
        liveUrl: args.liveUrl ?? runDoc?.liveUrl,
        error: args.error,
        errorCategory: args.errorCategory,
        summary: args.summary,
        resultCounts: args.resultCounts,
        updatedAt: timestamp,
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Internal action: launch a Browser Use task for an agent
// ---------------------------------------------------------------------------

export const launchBrowserTask = internalAction({
  args: {
    agentId: v.string(),
    runId: v.string(),
    agentType: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BROWSER_USE_API_KEY;

    if (!apiKey) {
      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        runId: args.runId,
        runStatus: "failed",
        phase: "failed",
        error: "BROWSER_USE_API_KEY is not configured",
        errorCategory: "configuration",
        summary: "Runtime could not start because Browser Use is not configured.",
      });
      return;
    }

    await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
      agentId: args.agentId,
      runId: args.runId,
      runStatus: "launching",
      phase: "starting_browser",
      summary: "Starting browser session.",
    });

    const taskPrompt = await buildTaskPrompt(
      args.agentType as AgentType,
      args.config as ConfigEnvelope
    );

    try {
      const { taskId, liveUrl } = await callBrowserUseAPI(apiKey, taskPrompt);

      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        runId: args.runId,
        browserUseTaskId: taskId,
        runStatus: "running",
        phase: "navigating",
        liveUrl,
        summary: "Browser launched and navigation is underway.",
      });

      // Schedule polling to check when the task completes
      await ctx.scheduler.runAfter(15_000, internal.runtime.pollTaskStatus, {
        agentId: args.agentId,
        runId: args.runId,
        taskId,
        attempt: 1,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        runId: args.runId,
        runStatus: "failed",
        phase: "failed",
        error: message,
        errorCategory: categorizeRuntimeError(message),
        summary: "Runtime launch failed before browsing could begin.",
      });
    }
  },
});

// ---------------------------------------------------------------------------
// Internal action: poll Browser Use for task completion
// ---------------------------------------------------------------------------

const MAX_POLL_ATTEMPTS = 60; // ~15 minutes at 15s intervals
const POLL_INTERVAL_MS = 15_000;

export const pollTaskStatus = internalAction({
  args: {
    agentId: v.string(),
    runId: v.string(),
    taskId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.BROWSER_USE_API_KEY;

    if (!apiKey) {
      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        runId: args.runId,
        runStatus: "failed",
        phase: "failed",
        error: "BROWSER_USE_API_KEY not available for polling",
        errorCategory: "configuration",
        summary: "Run polling failed because Browser Use is not configured.",
      });
      return;
    }

    try {
      const result = await pollBrowserUseTask(apiKey, args.taskId);

      if (result.status === "completed" || result.status === "finished" || result.status === "done") {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          runId: args.runId,
          browserUseTaskId: args.taskId,
          runStatus: "running",
          phase: "extracting",
          summary: "Results received. Extracting structured output.",
        });

        // Log the output
        await ctx.runMutation(internal.runtime.logTaskOutput, {
          agentId: args.agentId,
          runId: args.runId,
          taskId: args.taskId,
          output: result.output ?? "Task completed with no output",
        });
        return;
      }

      if (result.status === "failed" || result.status === "error") {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          runId: args.runId,
          browserUseTaskId: args.taskId,
          runStatus: "failed",
          phase: "failed",
          error: result.output ?? "Browser Use task failed",
          errorCategory: categorizeRuntimeError(result.output ?? "Browser Use task failed"),
          summary: "Run failed while the browser task was executing.",
        });
        return;
      }

      await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
        agentId: args.agentId,
        runId: args.runId,
        browserUseTaskId: args.taskId,
        runStatus: inferTrackingStatus(result.status),
        phase: inferRunPhase(result),
      });

      // Still running — schedule another poll if under the limit
      if (args.attempt < MAX_POLL_ATTEMPTS) {
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.runtime.pollTaskStatus, {
          agentId: args.agentId,
          runId: args.runId,
          taskId: args.taskId,
          attempt: args.attempt + 1,
        });
      } else {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          runId: args.runId,
          browserUseTaskId: args.taskId,
          runStatus: "failed",
          phase: "failed",
          error: `Task timed out after ${MAX_POLL_ATTEMPTS} poll attempts`,
          errorCategory: "timeout",
          summary: "Run timed out before the browser task completed.",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Retry on transient errors
      if (args.attempt < MAX_POLL_ATTEMPTS) {
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internal.runtime.pollTaskStatus, {
          agentId: args.agentId,
          runId: args.runId,
          taskId: args.taskId,
          attempt: args.attempt + 1,
        });
      } else {
        await ctx.runMutation(internal.runtime.updateAgentRunStatus, {
          agentId: args.agentId,
          runId: args.runId,
          runStatus: "failed",
          phase: "failed",
          error: `Polling failed after ${MAX_POLL_ATTEMPTS} attempts: ${message}`,
          errorCategory: categorizeRuntimeError(message),
          summary: "Run polling exhausted all retry attempts.",
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Internal mutation: log task output
// ---------------------------------------------------------------------------

export const logTaskOutput = internalMutation({
  args: {
    agentId: v.string(),
    runId: v.string(),
    taskId: v.string(),
    output: v.string(),
  },
  handler: async (ctx, args) => {
    let processingResult: RuntimeProcessingResult | undefined;

    try {
      const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

      if (agentDoc) {
        const agent = {
          id: args.agentId,
          ...agentDoc,
        } as AgentRecord;

        if (agent.type === "scholar") {
          processingResult = await processScholarshipOutput(ctx, agent, args.output, args.runId);
        } else if (agent.type === "reg") {
          processingResult = await processRegistrationOutput(ctx, agent, args.output, args.runId);
        } else if (agent.type === "eureka") {
          processingResult = await processEurekaOutput(ctx, agent, args.output, args.runId);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const timestamp = Date.now();

      await patchDoc(ctx, args.agentId, {
        lastRunStatus: "failed",
        status: "error",
        browserUseTaskId: args.taskId,
        updatedAt: timestamp,
      });
      await patchDoc(ctx, args.runId, {
        status: "failed",
        phase: "failed",
        browserUseTaskId: args.taskId,
        error: message,
        errorCategory: "unknown",
        summary: "Run completed, but result processing failed.",
        updatedAt: timestamp,
        endedAt: timestamp,
      });

      await appendAgentLog(ctx, {
        agentId: args.agentId,
        runId: args.runId,
        phase: "failed",
        event: "agent.runtime.output_processing_failed",
        level: "warning",
        details: {
          title: "Agent output parsing degraded",
          detail: message,
        },
      });
      return;
    }

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: args.runId,
      phase: "writing_results",
      event: "agent.runtime.task_output",
      details: {
        title: "Agent output received",
        detail: args.output.length > 200 ? args.output.slice(0, 200) + "..." : args.output,
        browserUseTaskId: args.taskId,
        output: args.output,
      },
    });

    const timestamp = Date.now();
    await patchDoc(ctx, args.agentId, {
      lastRunStatus: "succeeded",
      status: "active",
      browserUseTaskId: args.taskId,
      updatedAt: timestamp,
    });
    await patchDoc(ctx, args.runId, {
      status: "succeeded",
      phase: "completed",
      browserUseTaskId: args.taskId,
      summary: processingResult?.summary ?? "Run completed successfully.",
      resultCounts: processingResult?.resultCounts,
      updatedAt: timestamp,
      endedAt: timestamp,
    });

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: args.runId,
      phase: "completed",
      event: "agent.runtime.completed",
      details: {
        title: "Run completed",
        detail: processingResult?.summary ?? "Run completed successfully.",
        browserUseTaskId: args.taskId,
        resultCounts: processingResult?.resultCounts,
      },
    });
  },
});
