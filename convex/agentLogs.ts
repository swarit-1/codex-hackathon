import { mutation, query } from "./_generated/server";
import { getDoc, queryByIndex } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import { paginateItems } from "./lib/pagination";
import { toAgentLogRecord, toAgentRecord } from "./lib/records";
import {
  agentLogAppendArgs,
  agentLogListArgs,
  agentLogListByUserArgs,
} from "./lib/validators";
import { notFoundError } from "./lib/errors";
import {
  assertCanManageAgent,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { AgentLogRecord, AgentRecord } from "./types/contracts";

export const append = mutation({
  args: agentLogAppendArgs,
  handler: async (ctx, args): Promise<AgentLogRecord> => {
    const agent = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agent) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const actingUserId = await resolveActingUserId(ctx, String((agent as any).userId));
    await assertCanManageAgent(ctx, toAgentRecord(agent as any), actingUserId ?? String((agent as any).userId));

    return appendAgentLog(ctx, {
      agentId: args.agentId,
      event: args.event,
      level: args.level,
      details: args.details,
      screenshots: args.screenshots,
      scenarioId: args.scenarioId,
    });
  },
});

export const list = query({
  args: agentLogListArgs,
  handler: async (ctx, args) => {
    const agent = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agent) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const actingUserId = await resolveActingUserId(ctx, String((agent as any).userId));
    await assertCanManageAgent(ctx, toAgentRecord(agent as any), actingUserId ?? String((agent as any).userId));

    const logs = await queryByIndex<Omit<AgentLogRecord, "id">>(
      ctx,
      "agentLogs",
      "by_agentId_timestamp",
      [["agentId", args.agentId]]
    );

    const sortedLogs = logs
      .map((log) => toAgentLogRecord(log as any))
      .sort((left, right) => right.timestamp - left.timestamp);

    return paginateItems(sortedLogs, args);
  },
});

export const listByUser = query({
  args: agentLogListByUserArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const agentDocs = await queryByIndex<Omit<AgentRecord, "id">>(
      ctx,
      "agents",
      "by_userId",
      [["userId", args.userId]]
    );

    const logDocs = await Promise.all(
      agentDocs.map((agent) =>
        queryByIndex<Omit<AgentLogRecord, "id">>(ctx, "agentLogs", "by_agentId_timestamp", [
          ["agentId", String((agent as any)._id)],
        ])
      )
    );

    const logs = logDocs
      .flat()
      .map((log) => toAgentLogRecord(log as any))
      .sort((left, right) => right.timestamp - left.timestamp);

    return paginateItems(logs, args);
  },
});
