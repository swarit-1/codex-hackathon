import { append as appendLog } from "../../../convex/agentLogs.ts";
import { create as createPendingAction, getById as getPendingAction, resolve as resolvePendingAction } from "../../../convex/pendingActions.ts";
import { listByAgent, upsertFromRun } from "../../../convex/scholarships.ts";
import { updateById as updateAgentById } from "../../../convex/agents.ts";
import type { AgentRecord, PendingActionRecord, RuntimeRunContext } from "../../../convex/types/contracts.ts";
import { matchScholarships } from "./matcher.ts";
import { nextScholarshipStatus } from "./stateMachine.ts";

export interface ScholarRunResult {
  [key: string]: unknown;
  status: "paused" | "completed";
  pendingActionId?: string;
  scholarshipsUpdated: number;
}

export function runScholarBot(agent: AgentRecord, context: RuntimeRunContext): ScholarRunResult {
  appendLog({
    agentId: agent.id,
    event: "start",
    scenarioId: context.scenarioId,
    details: { runId: context.runId, message: "ScholarBot run started" },
  });

  const sources = Array.isArray(agent.config.sources) ? (agent.config.sources as string[]) : [];
  const profile = (agent.config.profile as Record<string, unknown>) ?? {};
  const matches = matchScholarships(
    {
      major: typeof profile.major === "string" ? profile.major : undefined,
      classification: typeof profile.classification === "string" ? profile.classification : undefined,
    },
    sources,
  );

  const [primaryMatch] = matches;
  upsertFromRun({
    userId: agent.userId,
    agentId: agent.id,
    title: primaryMatch.title,
    source: primaryMatch.source,
    deadline: primaryMatch.deadline,
    eligibility: primaryMatch.eligibility,
    matchScore: primaryMatch.matchScore,
    status: nextScholarshipStatus("found", "start_application"),
  });

  const pendingAction = createPendingAction({
    userId: agent.userId,
    agentId: agent.id,
    type: "essay",
    prompt: `Provide essay draft for ${primaryMatch.title}`,
  });

  upsertFromRun({
    userId: agent.userId,
    agentId: agent.id,
    title: primaryMatch.title,
    source: primaryMatch.source,
    deadline: primaryMatch.deadline,
    eligibility: primaryMatch.eligibility,
    matchScore: primaryMatch.matchScore,
    status: nextScholarshipStatus("applying", "missing_details"),
    missingFields: ["essay"],
  });

  updateAgentById(agent.id, {
    status: "paused",
    lastRunStatus: "paused",
    lastRunAt: new Date().toISOString(),
  });

  appendLog({
    agentId: agent.id,
    event: "pause",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      pendingActionId: pendingAction.id,
      message: "ScholarBot paused for human input",
    },
  });

  return {
    status: "paused",
    pendingActionId: pendingAction.id,
    scholarshipsUpdated: 1,
  };
}

export function resumeScholarBot(agent: AgentRecord, context: RuntimeRunContext, actionId: string): ScholarRunResult {
  const action = getPendingAction(actionId);
  const resolvedAction = ensureResolvedAction(actionId, action);

  appendLog({
    agentId: agent.id,
    event: "resume",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      actionId: resolvedAction.id,
      message: "ScholarBot resumed from pending action",
    },
  });

  const scholarships = listByAgent(agent.id);
  for (const scholarship of scholarships) {
    if (scholarship.status !== "paused") {
      continue;
    }

    upsertFromRun({
      userId: scholarship.userId,
      agentId: scholarship.agentId,
      title: scholarship.title,
      source: scholarship.source,
      deadline: scholarship.deadline,
      eligibility: scholarship.eligibility,
      matchScore: scholarship.matchScore,
      status: nextScholarshipStatus("paused", "resume_with_details"),
      missingFields: [],
    });

    upsertFromRun({
      userId: scholarship.userId,
      agentId: scholarship.agentId,
      title: scholarship.title,
      source: scholarship.source,
      deadline: scholarship.deadline,
      eligibility: scholarship.eligibility,
      matchScore: scholarship.matchScore,
      status: nextScholarshipStatus("applying", "submit"),
      missingFields: [],
    });
  }

  updateAgentById(agent.id, {
    status: "completed",
    lastRunStatus: "success",
    lastRunAt: new Date().toISOString(),
  });

  appendLog({
    agentId: agent.id,
    event: "success",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      actionId: resolvedAction.id,
      message: "ScholarBot completed after resume",
    },
  });

  return {
    status: "completed",
    scholarshipsUpdated: scholarships.length,
  };
}

function ensureResolvedAction(actionId: string, action: PendingActionRecord | undefined): PendingActionRecord {
  if (!action) {
    throw new Error(`Pending action not found for ScholarBot resume: ${actionId}`);
  }

  if (action.resolvedAt) {
    return action;
  }

  return resolvePendingAction(actionId, "resume acknowledged");
}
