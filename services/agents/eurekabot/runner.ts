import {
  appendLog,
  updateAgentById,
  createPendingAction,
  getPendingActionById as getPendingAction,
  resolvePendingAction,
  listLabOpeningsByAgent,
  upsertLabOpeningFromRun,
} from "../shared/runtimeAdapters.ts";
import type { AgentRecord, PendingActionRecord, RuntimeRunContext } from "../../../convex/types/contracts.ts";
import { matchLabOpenings } from "./matcher.ts";
import { draftProfessorEmail } from "./emailDrafter.ts";
import { nextLabOpeningStatus } from "./stateMachine.ts";

export interface EurekaRunResult {
  [key: string]: unknown;
  status: "paused" | "completed";
  pendingActionId?: string;
  labOpeningsFound: number;
  topMatch?: {
    labName: string;
    professorName: string;
    matchScore: number;
  };
}

export function runEurekaBot(agent: AgentRecord, context: RuntimeRunContext): EurekaRunResult {
  appendLog({
    agentId: agent.id,
    event: "start",
    scenarioId: context.scenarioId,
    details: { runId: context.runId, message: "EurekaBot run started - scanning for lab openings" },
  });

  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  const sources = Array.isArray(configObj.sources) ? (configObj.sources as string[]) : [];
  const profile = (configObj.profile as Record<string, unknown>) ?? {};
  const studentName = typeof profile.name === "string" ? profile.name : "UT Student";
  const major = typeof profile.major === "string" ? profile.major : "Computer Science";
  const classification = typeof profile.classification === "string" ? profile.classification : "Undergraduate";
  const gpa = typeof profile.gpa === "string" ? profile.gpa : undefined;
  const researchInterests = Array.isArray(profile.researchInterests)
    ? (profile.researchInterests as string[])
    : [];
  const relevantCourses = Array.isArray(profile.relevantCourses)
    ? (profile.relevantCourses as string[])
    : [];
  const skills = Array.isArray(profile.skills) ? (profile.skills as string[]) : [];

  // Phase 1: Scan Eureka for lab openings
  const matches = matchLabOpenings(
    { major, classification, researchInterests, gpa },
    sources,
  );

  appendLog({
    agentId: agent.id,
    event: "step",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      message: `Found ${matches.length} lab openings matching profile`,
      matchCount: matches.length,
    },
  });

  // Phase 2: Store all discovered openings
  for (const match of matches) {
    upsertLabOpeningFromRun({
      userId: agent.userId,
      agentId: agent.id,
      labName: match.labName,
      professorName: match.professorName,
      professorEmail: match.professorEmail,
      department: match.department,
      researchArea: match.researchArea,
      source: match.source,
      postedDate: match.postedDate ? new Date(match.postedDate).getTime() : undefined,
      deadline: match.deadline ? new Date(match.deadline).getTime() : undefined,
      requirements: match.requirements,
      matchScore: match.matchScore,
      status: "discovered",
    });
  }

  // Phase 3: Draft an email for the top match and pause for human review
  const [topMatch] = matches;
  if (!topMatch) {
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
        message: "EurekaBot completed - no matching lab openings found",
      },
    });

    return { status: "completed", labOpeningsFound: 0 };
  }

  // Generate the email draft
  const emailDraft = draftProfessorEmail(topMatch, {
    name: studentName,
    major,
    classification,
    gpa,
    researchInterests,
    relevantCourses,
    skills,
  });

  // Update top match to drafting_email -> email_ready
  upsertLabOpeningFromRun({
    userId: agent.userId,
    agentId: agent.id,
    labName: topMatch.labName,
    professorName: topMatch.professorName,
    professorEmail: topMatch.professorEmail,
    department: topMatch.department,
    researchArea: topMatch.researchArea,
    source: topMatch.source,
    postedDate: topMatch.postedDate ? new Date(topMatch.postedDate).getTime() : undefined,
    deadline: topMatch.deadline ? new Date(topMatch.deadline).getTime() : undefined,
    requirements: topMatch.requirements,
    matchScore: topMatch.matchScore,
    status: nextLabOpeningStatus("discovered", "draft_email"),
    emailDraft,
  });

  upsertLabOpeningFromRun({
    userId: agent.userId,
    agentId: agent.id,
    labName: topMatch.labName,
    professorName: topMatch.professorName,
    professorEmail: topMatch.professorEmail,
    department: topMatch.department,
    researchArea: topMatch.researchArea,
    source: topMatch.source,
    postedDate: topMatch.postedDate ? new Date(topMatch.postedDate).getTime() : undefined,
    deadline: topMatch.deadline ? new Date(topMatch.deadline).getTime() : undefined,
    requirements: topMatch.requirements,
    matchScore: topMatch.matchScore,
    status: nextLabOpeningStatus("drafting_email", "email_drafted"),
    emailDraft,
  });

  // Create pending action for user to review/edit the email draft
  const pendingAction = createPendingAction({
    userId: agent.userId,
    agentId: agent.id,
    type: "email_draft",
    prompt: [
      `EurekaBot found ${matches.length} lab opening(s). Top match:`,
      ``,
      `Lab: ${topMatch.labName}`,
      `Professor: ${topMatch.professorName} (${topMatch.professorEmail})`,
      `Department: ${topMatch.department}`,
      `Research: ${topMatch.researchArea}`,
      `Match Score: ${(topMatch.matchScore * 100).toFixed(0)}%`,
      ``,
      `A draft email has been generated. Please review, edit if needed, and confirm to send:`,
      ``,
      emailDraft,
    ].join("\n"),
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
      labName: topMatch.labName,
      professorName: topMatch.professorName,
      matchScore: topMatch.matchScore,
      message: "EurekaBot paused - email draft ready for human review",
    },
  });

  return {
    status: "paused",
    pendingActionId: pendingAction.id,
    labOpeningsFound: matches.length,
    topMatch: {
      labName: topMatch.labName,
      professorName: topMatch.professorName,
      matchScore: topMatch.matchScore,
    },
  };
}

export function resumeEurekaBot(agent: AgentRecord, context: RuntimeRunContext, actionId: string): EurekaRunResult {
  const action = getPendingAction(actionId);
  const resolvedAction = ensureResolvedAction(actionId, action);

  appendLog({
    agentId: agent.id,
    event: "resume",
    scenarioId: context.scenarioId,
    details: {
      runId: context.runId,
      actionId: resolvedAction.id,
      message: "EurekaBot resumed - processing email send confirmation",
    },
  });

  const labOpenings = listLabOpeningsByAgent(agent.id);
  for (const opening of labOpenings) {
    if (opening.status !== "email_ready") {
      continue;
    }

    // Mark as contacted (email "sent")
    upsertLabOpeningFromRun({
      userId: opening.userId,
      agentId: opening.agentId,
      labName: opening.labName,
      professorName: opening.professorName,
      professorEmail: opening.professorEmail,
      department: opening.department,
      researchArea: opening.researchArea,
      source: opening.source,
      postedDate: opening.postedDate,
      deadline: opening.deadline,
      requirements: opening.requirements,
      matchScore: opening.matchScore,
      status: nextLabOpeningStatus("email_ready", "send_email"),
      emailDraft: opening.emailDraft,
      emailSentAt: Date.now(),
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
      message: "EurekaBot completed - email sent to professor",
    },
  });

  return {
    status: "completed",
    labOpeningsFound: labOpenings.length,
  };
}

function ensureResolvedAction(actionId: string, action: PendingActionRecord | undefined): PendingActionRecord {
  if (!action) {
    throw new Error(`Pending action not found for EurekaBot resume: ${actionId}`);
  }

  if (action.resolvedAt) {
    return action;
  }

  return resolvePendingAction(actionId, "email send confirmed");
}
