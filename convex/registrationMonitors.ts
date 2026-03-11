import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { notFoundError } from "./lib/errors";
import { paginateItems } from "./lib/pagination";
import { toAgentRecord, toRegistrationMonitorRecord } from "./lib/records";
import {
  registrationMonitorCreateArgs,
  registrationMonitorListArgs,
} from "./lib/validators";
import {
  assertCanManageAgent,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { AgentRecord, RegistrationMonitorRecord } from "./types/contracts";

export const create = mutation({
  args: registrationMonitorCreateArgs,
  handler: async (ctx, args): Promise<RegistrationMonitorRecord> => {
    const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agentDoc) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const agent = toAgentRecord(agentDoc as any);
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? args.userId);

    const existing = (
      await queryByIndex<Omit<RegistrationMonitorRecord, "id">>(
        ctx,
        "registrationMonitors",
        "by_agentId",
        [["agentId", args.agentId]]
      )
    ).find(
      (monitor) =>
        monitor.uniqueId === args.uniqueId && monitor.semester === args.semester
    );

    const timestamp = Date.now();
    const status = args.status ?? "watching";

    if (existing) {
      await patchDoc(ctx, existing._id, {
        courseNumber: args.courseNumber,
        uniqueId: args.uniqueId,
        semester: args.semester,
        status,
        pollInterval: args.pollInterval,
        updatedAt: timestamp,
      });

      return {
        ...toRegistrationMonitorRecord(existing as any),
        courseNumber: args.courseNumber,
        uniqueId: args.uniqueId,
        semester: args.semester,
        status,
        pollInterval: args.pollInterval,
        updatedAt: timestamp,
      };
    }

    const id = await insertDoc(ctx, "registrationMonitors", {
      userId: args.userId,
      agentId: args.agentId,
      courseNumber: args.courseNumber,
      uniqueId: args.uniqueId,
      semester: args.semester,
      status,
      pollInterval: args.pollInterval,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      id,
      userId: args.userId,
      agentId: args.agentId,
      courseNumber: args.courseNumber,
      uniqueId: args.uniqueId,
      semester: args.semester,
      status,
      pollInterval: args.pollInterval,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const listByUser = query({
  args: registrationMonitorListArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const monitors = await queryByIndex<Omit<RegistrationMonitorRecord, "id">>(
      ctx,
      "registrationMonitors",
      "by_userId",
      [["userId", args.userId]]
    );

    const filtered = monitors
      .map((monitor) => toRegistrationMonitorRecord(monitor as any))
      .filter((monitor) => !args.status || monitor.status === args.status)
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(filtered, args);
  },
});
