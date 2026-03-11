declare const process: { env: Record<string, string | undefined> };

import { appendLog, getAgentById, updateAgentById, getPendingActionById } from "./shared/runtimeAdapters.ts";
import type { AgentRecord, AgentRunState, AgentStatus, RunType } from "../../convex/types/contracts.ts";
import { getBrowserUseClient } from "./browserUseClient.ts";
import {
  MY_AGENTS_DELETE_SCENARIO,
  MY_AGENTS_RUN_NOW_SCENARIO,
  buildRunContext,
  deriveInstallScenarioId,
  toLogDetails,
} from "./shared/payloadMappers.ts";
import { normalizeRuntimeEvent, runtimeEventFromContext, type RawWebhookPayload } from "./shared/eventTypes.ts";
import { runScholarBot, resumeScholarBot } from "./scholarbot/runner.ts";
import { runRegBot } from "./regbot/runner.ts";
import { runEurekaBot, resumeEurekaBot } from "./eurekabot/runner.ts";

const DEFAULT_SCHOLAR_SEARCH_URL = "https://utexas.scholarships.ngwebsolutions.com/ScholarX_StudentLanding.aspx";
const DEFAULT_EUREKA_URL = "https://eureka-prod.herokuapp.com/opportunities";

export async function triggerAgentRun(agentId: string, runType: RunType): Promise<Record<string, unknown>> {
  const agent = getAgentById(agentId);
  if (!agent || agent.deletedAt) {
    throw new Error(`Cannot run missing/deleted agent: ${agentId}`);
  }

  const context = buildRunContext(agent, runType);
  const browserClient = getBrowserUseClient();
  const browserTask = browserClient.create({
    agentId: agent.id,
    runId: context.runId,
    templateId: agent.templateId,
    startUrl: buildBrowserUseStartUrl(agent),
    taskPrompt: buildBrowserUseTaskPrompt(agent, runType),
  });
  browserClient.start(browserTask.taskId);

  updateAgentById(agent.id, {
    status: "active",
    browserUseTaskId: browserTask.taskId,
    currentRunId: context.runId,
    currentRunState: "running",
    lastRunAt: new Date().toISOString(),
    lastControlAction: runType === "manual" ? "run_now" : agent.lastControlAction,
    lastControlActionAt: runType === "manual" ? new Date().toISOString() : agent.lastControlActionAt,
  });

  if (runType === "manual") {
    appendLog({
      agentId: agent.id,
      event: "step",
      scenarioId: MY_AGENTS_RUN_NOW_SCENARIO,
      details: {
        runId: context.runId,
        runType,
        message: "Run-now execution started",
      },
    });
  }

  const installScenario = deriveInstallScenarioId(runType);
  if (installScenario) {
    appendLog({
      agentId: agent.id,
      event: "step",
      scenarioId: installScenario,
      details: toLogDetails({
        runId: context.runId,
        runType,
        message: "Install-triggered runtime execution started",
      }),
    });
  }

  let outcome: Record<string, unknown>;
  if (agent.type === "scholar") {
    outcome = runScholarBot(agent, context);
  } else if (agent.type === "reg") {
    outcome = runRegBot(agent, context);
  } else if (agent.type === "eureka") {
    outcome = runEurekaBot(agent, context);
  } else {
    appendLog({
      agentId: agent.id,
      event: "failure",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        message: `Unsupported agent type for runtime: ${agent.type}`,
      },
    });

    updateAgentById(agent.id, {
      status: "error",
      currentRunState: "failed",
      lastRunStatus: "failed",
    });

    throw new Error(`Unsupported agent type for runtime: ${agent.type}`);
  }

  const browserStatus = browserClient.status(browserTask.taskId);
  const terminalRunState = deriveTerminalRunState(outcome.status, browserStatus.state);

  const patch: {
    currentRunState: AgentRunState;
    lastRunStatus?: "success" | "paused" | "failed";
    status?: AgentStatus;
  } = {
    currentRunState: terminalRunState,
  };

  if (terminalRunState === "completed") {
    patch.lastRunStatus = "success";
  }
  if (terminalRunState === "failed") {
    patch.lastRunStatus = "failed";
    patch.status = "error";
  }
  if (terminalRunState === "cancelled") {
    patch.status = "paused";
  }

  updateAgentById(agent.id, patch);

  if (runType === "manual") {
    appendLog({
      agentId: agent.id,
      event: terminalRunState === "failed" ? "failure" : "success",
      scenarioId: MY_AGENTS_RUN_NOW_SCENARIO,
      details: {
        runId: context.runId,
        runState: terminalRunState,
        browserTaskId: browserTask.taskId,
        message: "Run-now execution reached terminal state",
      },
    });
  }

  return {
    ...outcome,
    runId: context.runId,
    runState: terminalRunState,
    scenarioId: context.scenarioId,
    browserTaskId: browserTask.taskId,
    browserStatus: browserStatus.state,
  };
}

export async function handleWebhook(eventPayload: RawWebhookPayload): Promise<Record<string, unknown>> {
  const event = normalizeRuntimeEvent(eventPayload);
  const agent = getAgentById(event.agentId);
  if (!agent) {
    throw new Error(`Webhook references unknown agent: ${event.agentId}`);
  }

  appendLog({
    agentId: event.agentId,
    event: event.type,
    scenarioId: event.scenarioId,
    details: {
      ...event.details,
      webhook: true,
      runId: event.runId,
    },
    timestamp: event.timestamp,
  });

  if (event.status !== agent.status) {
    updateAgentById(agent.id, {
      status: event.status,
      currentRunState: mapStatusToRunState(event.status),
      lastRunAt: event.timestamp,
    });
  }

  if (event.details.actionId && event.type === "resume") {
    return resumeFromPendingAction(String(event.details.actionId));
  }

  return {
    accepted: true,
    normalizedEvent: event,
  };
}

export async function resumeFromPendingAction(actionId: string): Promise<Record<string, unknown>> {
  const pendingAction = getPendingActionById(actionId);
  if (!pendingAction) {
    throw new Error(`Cannot resume missing pending action: ${actionId}`);
  }

  const agent = getAgentById(pendingAction.agentId);
  if (!agent) {
    throw new Error(`Cannot resume missing agent: ${pendingAction.agentId}`);
  }

  const context = buildRunContext(agent, "resume");

  if (agent.type !== "scholar" && agent.type !== "eureka") {
    appendLog({
      agentId: agent.id,
      event: "failure",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        actionId,
        message: "Pending action resume currently supported only for ScholarBot and EurekaBot",
      },
    });

    throw new Error("Pending action resume currently supported only for ScholarBot and EurekaBot");
  }

  const resumeEvent = runtimeEventFromContext(context, "resume", {
    actionId,
    message: "Resume requested from pending action",
  });
  appendLog({
    agentId: resumeEvent.agentId,
    event: resumeEvent.type,
    scenarioId: resumeEvent.scenarioId,
    details: resumeEvent.details,
    timestamp: resumeEvent.timestamp,
  });

  const outcome = agent.type === "eureka"
    ? resumeEurekaBot(agent, context, actionId)
    : resumeScholarBot(agent, context, actionId);

  updateAgentById(agent.id, {
    currentRunId: context.runId,
    currentRunState: outcome.status === "completed" ? "completed" : "paused",
  });

  return {
    ...outcome,
    runId: context.runId,
    scenarioId: context.scenarioId,
  };
}

export async function cancelAgentRun(
  agentId: string,
  options: { scenarioId?: string; reason?: string } = {},
): Promise<{ attempted: boolean; succeeded: boolean; taskId?: string; state?: string; reason?: string }> {
  const agent = getAgentById(agentId);
  if (!agent) {
    throw new Error(`Cannot cancel run for missing agent: ${agentId}`);
  }

  const scenarioId = options.scenarioId ?? MY_AGENTS_DELETE_SCENARIO;
  const reason = options.reason ?? "control_request";

  if (!agent.browserUseTaskId) {
    appendLog({
      agentId,
      event: "step",
      scenarioId,
      details: {
        reason,
        message: "No active Browser Use task to cancel",
      },
    });
    return { attempted: false, succeeded: false, reason: "no_active_task" };
  }

  const client = getBrowserUseClient();
  const snapshot = client.snapshot(agent.browserUseTaskId);
  if (!snapshot) {
    appendLog({
      agentId,
      event: "failure",
      scenarioId,
      details: {
        taskId: agent.browserUseTaskId,
        reason,
        message: "Browser task handle missing from runtime provider",
      },
    });
    return { attempted: true, succeeded: false, taskId: agent.browserUseTaskId, reason: "task_handle_missing" };
  }

  const cancelled = client.cancel(snapshot.taskId);
  updateAgentById(agentId, {
    currentRunState: "cancelled",
    status: "paused",
    lastControlAction: "cancel_run",
    lastControlActionAt: new Date().toISOString(),
  });

  appendLog({
    agentId,
    event: "success",
    scenarioId,
    details: {
      taskId: cancelled.taskId,
      state: cancelled.state,
      reason,
      message: "Active run cancelled",
    },
  });

  return {
    attempted: true,
    succeeded: cancelled.state === "cancelled",
    taskId: cancelled.taskId,
    state: cancelled.state,
  };
}

function deriveTerminalRunState(outcomeStatus: unknown, browserStatus: string): AgentRunState {
  if (browserStatus === "cancelled") {
    return "cancelled";
  }

  if (outcomeStatus === "paused") {
    return "paused";
  }
  if (outcomeStatus === "completed") {
    return "completed";
  }
  if (outcomeStatus === "error") {
    return "failed";
  }
  return "completed";
}

function mapStatusToRunState(status: AgentStatus): AgentRunState {
  if (status === "active") {
    return "running";
  }
  if (status === "paused") {
    return "paused";
  }
  if (status === "completed") {
    return "completed";
  }
  return "failed";
}

function buildBrowserUseTaskPrompt(agent: AgentRecord, runType: RunType): string {
  if (agent.type === "scholar") {
    const scholarUrl = resolveScholarSearchUrl(agent);
    const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
    const profile = (configObj.profile as Record<string, unknown> | undefined) ?? {};
    const major = typeof profile.major === "string" ? profile.major : "General Studies";
    const classification = typeof profile.classification === "string" ? profile.classification : "Undergraduate";
    const gpa = typeof profile.gpa === "string" ? profile.gpa : undefined;
    const citizenship = typeof profile.citizenship === "string" ? profile.citizenship : undefined;

    if (runType === "resume") {
      return [
        `Navigate to ${scholarUrl}.`,
        "Continue the in-progress scholarship search flow using the current browser context.",
        "If a login or MFA screen blocks progress, stop at the blocking screen and report the blocker.",
        "Do NOT click any final Submit button.",
      ].join(" ");
    }

    const profileDetails: string[] = [];
    profileDetails.push(`Classification/Year: ${classification}`);
    profileDetails.push(`Major/Field of Study: ${major}`);
    if (gpa) profileDetails.push(`GPA: ${gpa}`);
    if (citizenship) profileDetails.push(`Citizenship: ${citizenship}`);

    return [
      `You are a browser automation agent helping a UT Austin student find scholarships.`,
      ``,
      `GOAL: Navigate to the UT Austin scholarship search page, fill out ALL available search/filter form fields with the student's profile, but DO NOT submit or click the Search button.`,
      ``,
      `Student Profile:`,
      ...profileDetails.map((d) => `  - ${d}`),
      ``,
      `Step-by-step instructions:`,
      `1. Navigate to ${scholarUrl} if not already there. Wait for the page to fully load.`,
      `2. Look for the scholarship search form on the page. It may have dropdowns, text inputs, checkboxes, or radio buttons.`,
      `3. For each form field you find, fill it in with the appropriate student information:`,
      `   - If there is a keyword or search text field, type "${major} scholarship".`,
      `   - If there is a Classification or Academic Level dropdown, select "${classification}" or the closest match.`,
      `   - If there is a Major, Field of Study, or Area of Study field, enter or select "${major}" or the closest match.`,
      `   - If there is a College or School dropdown, select the most relevant college for "${major}".`,
      gpa ? `   - If there is a GPA or academic performance field, enter "${gpa}".` : "",
      citizenship ? `   - If there is a Citizenship or Residency field, select "${citizenship}" or the closest option.` : "",
      `   - For any other filter fields (financial need, ethnicity, gender, etc.), select reasonable defaults or leave them at their default values.`,
      `4. After filling ALL available form fields on the first page, scroll down and click on step/page "2" to proceed to the second page.`,
      `5. On the second page, fill out ALL available form fields with the appropriate student information (use the same profile details and matching logic as step 3).`,
      `6. After filling the second page, click on step/page "3" to proceed to the third page.`,
      `7. On the third page, review the information but proceed to step/page "4".`,
      `8. On step/page "4", STOP. Do NOT click Submit, Search, Apply, or any button that would submit the form.`,
      `9. Report back what fields you found on each page and what values you entered.`,
      ``,
      `CRITICAL RULES:`,
      `- DO NOT click any Submit, Search, or Apply button.`,
      `- DO NOT navigate away from the search page after filling fields.`,
      `- If you encounter a login page, stop and report that authentication is required.`,
      `- If a dropdown does not have an exact match, pick the closest available option.`,
      `- Take your time to find and fill ALL available fields before stopping.`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  if (agent.type === "reg") {
    const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
    const semester = typeof configObj.semester === "string" ? configObj.semester : "Fall 2026";
    const watchList = Array.isArray(configObj.watchList) ? configObj.watchList : [];
    const watchedSections = watchList
      .map((entry) => {
        if (!entry || typeof entry !== "object") return undefined;
        const record = entry as Record<string, unknown>;
        const courseNumber = typeof record.courseNumber === "string" ? record.courseNumber : "Unknown Course";
        const uniqueId = typeof record.uniqueId === "string" ? record.uniqueId : undefined;
        if (!uniqueId) return undefined;
        return `${courseNumber} (${uniqueId})`;
      })
      .filter((value): value is string => Boolean(value));
    const singleTarget =
      watchedSections.length === 0
        ? `${typeof configObj.courseNumber === "string" ? configObj.courseNumber : "CS 378"} (${typeof configObj.uniqueId === "string" ? configObj.uniqueId : "12345"})`
        : undefined;
    const targetSummary = watchedSections.length > 0 ? watchedSections.join(", ") : singleTarget;
    return [
      "Open the UT registration portal in the local browser context.",
      `Watch the configured registration numbers for ${semester}: ${targetSummary}.`,
      "When one of the watched sections opens, immediately continue through the registration flow for that exact registration number.",
      "If a conflict, hold, or authentication step blocks the registration, report the blocker with the affected registration number.",
      "If authentication is required, pause and report the required user action.",
    ]
      .filter((line) => Boolean(line))
      .join(" ");
  }

  if (agent.type === "eureka") {
    const eurekaUrl = resolveEurekaUrl(agent);
    const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
    const profile = (configObj.profile as Record<string, unknown> | undefined) ?? {};
    const major = typeof profile.major === "string" ? profile.major : "Computer Science";
    const classification = typeof profile.classification === "string" ? profile.classification : "Undergraduate";
    const researchInterests = Array.isArray(profile.researchInterests)
      ? (profile.researchInterests as string[]).join(", ")
      : "machine learning, systems";

    if (runType === "resume") {
      return [
        `Navigate to ${eurekaUrl}.`,
        "Continue reviewing the lab opening listings in the current browser context.",
        "If a login page blocks progress, stop and report the blocker.",
        "Do NOT submit any applications or send any emails.",
      ].join(" ");
    }

    return [
      `You are a browser automation agent helping a UT Austin student find research lab openings.`,
      ``,
      `GOAL: Navigate to the UT Eureka research opportunities page and scan for open lab positions matching the student's profile.`,
      ``,
      `Student Profile:`,
      `  - Major: ${major}`,
      `  - Classification: ${classification}`,
      `  - Research Interests: ${researchInterests}`,
      ``,
      `Step-by-step instructions:`,
      `1. Navigate to ${eurekaUrl} if not already there. Wait for the page to fully load.`,
      `2. Look for search/filter options on the page. If available:`,
      `   - Filter by department or field related to "${major}".`,
      `   - Filter by keywords related to "${researchInterests}".`,
      `   - Filter for "${classification}" level positions if the option exists.`,
      `3. Browse through the listed research opportunities and lab openings.`,
      `4. For each relevant posting, extract:`,
      `   - Lab/project name`,
      `   - Professor/PI name and email`,
      `   - Department`,
      `   - Research area/description`,
      `   - Requirements or qualifications`,
      `   - Application deadline (if listed)`,
      `   - Posted date`,
      `5. Collect information for up to 10 relevant openings.`,
      `6. Report back all extracted lab openings with their details.`,
      ``,
      `CRITICAL RULES:`,
      `- DO NOT submit any applications or send any emails.`,
      `- DO NOT click on any Apply or Contact buttons.`,
      `- If you encounter a login page, stop and report that authentication is required.`,
      `- Focus on positions that match the student's major and research interests.`,
      `- Take your time to thoroughly scan all available listings.`,
    ]
      .filter((line) => line !== "")
      .join("\n");
  }

  return process.env.BROWSER_USE_DEFAULT_TASK_PROMPT ?? "Open the target workflow page and report ready state.";
}

function buildBrowserUseStartUrl(agent: AgentRecord): string | undefined {
  if (agent.type === "scholar") {
    return resolveScholarSearchUrl(agent);
  }
  if (agent.type === "eureka") {
    return resolveEurekaUrl(agent);
  }
  return undefined;
}

function resolveScholarSearchUrl(agent: AgentRecord): string {
  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  const fromConfig = configObj.scholarshipSearchUrl;
  if (typeof fromConfig === "string" && fromConfig.trim().length > 0) {
    return fromConfig.trim();
  }

  const fromEnv = process.env.BROWSER_USE_SCHOLAR_SEARCH_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return DEFAULT_SCHOLAR_SEARCH_URL;
}

function resolveEurekaUrl(agent: AgentRecord): string {
  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  const fromConfig = configObj.eurekaUrl;
  if (typeof fromConfig === "string" && fromConfig.trim().length > 0) {
    return fromConfig.trim();
  }

  const fromEnv = process.env.BROWSER_USE_EUREKA_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  return DEFAULT_EUREKA_URL;
}
