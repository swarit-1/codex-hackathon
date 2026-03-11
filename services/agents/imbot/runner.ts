import {
  appendLog,
  updateAgentById,
  createPendingAction,
  listIntramuralSignupsByAgent,
  upsertIntramuralSignup,
  updateIntramuralSignupStatus,
} from "../shared/runtimeAdapters.ts";
import type { AgentRecord, RuntimeRunContext } from "../../../convex/types/contracts.ts";
import { matchSports, type MatchResult } from "./sportMatcher.ts";
import { checkSlotAvailability } from "./slotChecker.ts";

export interface IMBotRunResult {
  [key: string]: unknown;
  status: "completed" | "paused" | "error" | "active";
  matchesFound: number;
  signupsCreated: number;
}

/**
 * Main IMBot execution flow:
 * 1. Extract user preferences from config (sports, division, days, time, role)
 * 2. Scan IMLeagues for matching sports with open registration
 * 3. For each match, verify slot availability
 * 4. Create intramural signup records in "found" status
 * 5. Create a pending action for user confirmation before completing registration
 * 6. Pause for human approval (payment + final confirm)
 */
export function runIMBot(agent: AgentRecord, context: RuntimeRunContext): IMBotRunResult {
  appendLog({
    agentId: agent.id,
    event: "start",
    scenarioId: context.scenarioId,
    details: { runId: context.runId, message: "IMBot run started — scanning IMLeagues for open intramural games" },
  });

  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  const sports = arrayOrDefault(configObj.sports, ["Basketball", "Flag Football", "Soccer"]);
  const division = stringOrDefault(configObj.division, "C");
  const role = stringOrDefault(configObj.role, "free_agent") as "captain" | "free_agent";
  const teamName = stringOrDefault(configObj.teamName, "");
  const preferredDays = arrayOrDefault(configObj.preferredDays, ["Sunday", "Tuesday", "Thursday"]);
  const preferredTime = stringOrDefault(configObj.preferredTime, "evening");
  const maxCheckAttempts = numberOrDefault(configObj.maxCheckAttempts, 3);

  // Step 1: Match sports against preferences
  const matches = matchSports({ sports, division, preferredDays, preferredTime });

  appendLog({
    agentId: agent.id,
    event: "step",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      phase: "sport_matching",
      matchesFound: matches.length,
      matchedSports: matches.map((m) => `${m.sport} (${m.division}) — ${m.bestSlot.day} ${m.bestSlot.time}`),
    },
  });

  if (matches.length === 0) {
    appendLog({
      agentId: agent.id,
      event: "success",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        message: "No matching intramural sports with open registration found. Will check again next run.",
      },
    });

    updateAgentById(agent.id, {
      status: "active",
      lastRunStatus: "succeeded",
      lastRunAt: new Date().toISOString(),
    });

    return { status: "active", matchesFound: 0, signupsCreated: 0 };
  }

  // Step 2: Verify slot availability for each match
  let signupsCreated = 0;
  const confirmedMatches: MatchResult[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    let slotConfirmed = false;

    for (let attempt = 1; attempt <= maxCheckAttempts; attempt++) {
      const slotCheck = checkSlotAvailability(attempt, {
        slotAvailableOnAttempt: numberOrDefault(configObj.slotAvailableOnAttempt, 1),
      });

      appendLog({
        agentId: agent.id,
        event: "step",
        scenarioId: context.scenarioId,
        details: {
          runId: context.runId,
          phase: "slot_verification",
          sport: match.sport,
          division: match.division,
          attempt,
          available: slotCheck.available,
          spotsRemaining: slotCheck.spotsRemaining,
        },
      });

      if (slotCheck.available) {
        slotConfirmed = true;
        break;
      }
    }

    if (!slotConfirmed) continue;

    // Step 3: Create intramural signup record
    upsertIntramuralSignup({
      userId: agent.userId,
      agentId: agent.id,
      sport: match.sport,
      division: match.division,
      role,
      teamName: role === "captain" ? teamName : undefined,
      preferredDay: match.bestSlot.day,
      preferredTime: match.bestSlot.time,
      registrationFee: match.fee,
      status: "found",
    });

    confirmedMatches.push(match);
    signupsCreated++;
  }

  if (signupsCreated === 0) {
    appendLog({
      agentId: agent.id,
      event: "success",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        message: "Sports matched but no slots currently available. Will retry on next run.",
      },
    });

    updateAgentById(agent.id, {
      status: "active",
      lastRunStatus: "succeeded",
      lastRunAt: new Date().toISOString(),
    });

    return { status: "active", matchesFound: matches.length, signupsCreated: 0 };
  }

  // Step 4: Build confirmation summary and pause for human approval
  const summaryLines = confirmedMatches.map((m) =>
    `• ${m.sport} (${m.division} League) — ${m.bestSlot.day} at ${m.bestSlot.time} — $${m.fee} — ${m.bestSlot.spotsRemaining} spots left`
  );

  const roleDescription = role === "captain"
    ? `Creating team "${teamName}" as captain`
    : "Joining as free agent";

  const confirmPrompt = [
    `IMBot found ${signupsCreated} intramural game(s) matching your preferences:`,
    "",
    ...summaryLines,
    "",
    `Role: ${roleDescription}`,
    "",
    "Confirm to proceed with registration (payment of team fees will be required for captains).",
  ].join("\n");

  // Update signups to pending_confirm
  const existingSignups = listIntramuralSignupsByAgent(agent.id);
  for (const signup of existingSignups) {
    if (signup.status === "found") {
      updateIntramuralSignupStatus(signup.id, "pending_confirm");
    }
  }

  createPendingAction({
    userId: agent.userId,
    agentId: agent.id,
    type: "confirmation",
    prompt: confirmPrompt,
  });

  updateAgentById(agent.id, {
    status: "paused",
    lastRunStatus: "succeeded",
    lastRunAt: new Date().toISOString(),
  });

  appendLog({
    agentId: agent.id,
    event: "pause",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      matchesFound: matches.length,
      signupsCreated,
      message: "Paused for user confirmation before completing intramural registration",
    },
  });

  return { status: "paused", matchesFound: matches.length, signupsCreated };
}

/**
 * Resume after user confirms the intramural registration.
 * Completes the signup on IMLeagues.
 */
export function resumeIMBot(
  agent: AgentRecord,
  context: RuntimeRunContext,
  _actionId: string,
): IMBotRunResult {
  appendLog({
    agentId: agent.id,
    event: "resume",
    scenarioId: context.scenarioId,
    details: { runId: context.runId, message: "User confirmed — completing intramural registration" },
  });

  const signups = listIntramuralSignupsByAgent(agent.id);
  let registered = 0;

  for (const signup of signups) {
    if (signup.status === "pending_confirm") {
      updateIntramuralSignupStatus(signup.id, "registered");
      registered++;

      appendLog({
        agentId: agent.id,
        event: "step",
        scenarioId: context.scenarioId,
        details: {
          runId: context.runId,
          phase: "registration_complete",
          sport: signup.sport,
          division: signup.division,
          day: signup.preferredDay,
          time: signup.preferredTime,
          role: signup.role,
          message: `Registered for ${signup.sport} (${signup.division} League) on ${signup.preferredDay} at ${signup.preferredTime}`,
        },
      });
    }
  }

  updateAgentById(agent.id, {
    status: "completed",
    lastRunStatus: "succeeded",
    lastRunAt: new Date().toISOString(),
  });

  appendLog({
    agentId: agent.id,
    event: "success",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      registered,
      message: `IMBot completed — registered for ${registered} intramural sport(s)`,
    },
  });

  return { status: "completed", matchesFound: registered, signupsCreated: registered };
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function arrayOrDefault(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String) : fallback;
}
