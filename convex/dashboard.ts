import { query } from "./_generated/server";
import { queryByIndex } from "./lib/db";
import { toAgentRecord } from "./lib/records";
import { dashboardGetOverviewArgs } from "./lib/validators";
import {
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type {
  AgentRecord,
  PendingActionRecord,
  RegistrationMonitorRecord,
  ScholarshipRecord,
  TemplateSubmissionRecord,
} from "./types/contracts";

export const getOverview = query({
  args: dashboardGetOverviewArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const [agents, scholarships, monitors, pendingActions, submissions] = await Promise.all([
      queryByIndex<Omit<AgentRecord, "id">>(ctx, "agents", "by_userId", [["userId", args.userId]]),
      queryByIndex<Omit<ScholarshipRecord, "id">>(ctx, "scholarships", "by_userId", [["userId", args.userId]]),
      queryByIndex<Omit<RegistrationMonitorRecord, "id">>(
        ctx,
        "registrationMonitors",
        "by_userId",
        [["userId", args.userId]]
      ),
      queryByIndex<Omit<PendingActionRecord, "id">>(
        ctx,
        "pendingActions",
        "by_userId",
        [["userId", args.userId]]
      ),
      queryByIndex<Omit<TemplateSubmissionRecord, "id">>(
        ctx,
        "templateSubmissions",
        "by_userId_status",
        [["userId", args.userId], ["status", "pending_review"]]
      ),
    ]);

    const agentRecords = agents.map((agent) => toAgentRecord(agent as any)).sort((left, right) => right.updatedAt - left.updatedAt);

    return {
      counts: {
        agents: agentRecords.length,
        scholarships: scholarships.length,
        registrationMonitors: monitors.length,
        pendingActions: pendingActions.filter((action) => !action.resolvedAt).length,
        pendingSubmissions: submissions.length,
      },
      agentStatusBreakdown: {
        active: agentRecords.filter((agent) => agent.status === "active").length,
        paused: agentRecords.filter((agent) => agent.status === "paused").length,
        completed: agentRecords.filter((agent) => agent.status === "completed").length,
        error: agentRecords.filter((agent) => agent.status === "error").length,
      },
      recentAgents: agentRecords.slice(0, 5),
    };
  },
});
