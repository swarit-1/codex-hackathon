import { query } from "./_generated/server";
import { getDoc, queryByIndex, queryByIndexRecent } from "./lib/db";
import { notFoundError } from "./lib/errors";
import { paginateItems } from "./lib/pagination";
import { toAgentRecord, toAgentRunRecord } from "./lib/records";
import {
  agentRunCurrentByAgentArgs,
  agentRunGetArgs,
  agentRunListByAgentArgs,
  agentRunListCurrentByUserArgs,
} from "./lib/validators";
import {
  assertCanManageAgent,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { AgentRecord, AgentRunRecord } from "./types/contracts";

export const get = query({
  args: agentRunGetArgs,
  handler: async (ctx, args): Promise<AgentRunRecord> => {
    const runDoc = await getDoc<Omit<AgentRunRecord, "id">>(ctx, args.runId);

    if (!runDoc) {
      throw notFoundError("agent run not found", {
        runId: args.runId,
      });
    }

    const run = toAgentRunRecord(runDoc as any);
    const actingUserId = await resolveActingUserId(ctx, run.userId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, run.userId);
    return run;
  },
});

export const getCurrentByAgent = query({
  args: agentRunCurrentByAgentArgs,
  handler: async (ctx, args): Promise<AgentRunRecord | null> => {
    const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agentDoc) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const agent = toAgentRecord(agentDoc as any);
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const docs = await queryByIndexRecent<Omit<AgentRunRecord, "id">>(
      ctx,
      "agentRuns",
      "by_agentId_updatedAt",
      [["agentId", args.agentId]],
      1
    );

    return docs[0] ? toAgentRunRecord(docs[0] as any) : null;
  },
});

export const listByAgent = query({
  args: agentRunListByAgentArgs,
  handler: async (ctx, args) => {
    const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agentDoc) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const agent = toAgentRecord(agentDoc as any);
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const docs = await queryByIndex<Omit<AgentRunRecord, "id">>(
      ctx,
      "agentRuns",
      "by_agentId_startedAt",
      [["agentId", args.agentId]]
    );

    const runs = docs
      .map((doc) => toAgentRunRecord(doc as any))
      .sort((left, right) => right.startedAt - left.startedAt);

    return paginateItems(runs, args);
  },
});

export const listCurrentByUser = query({
  args: agentRunListCurrentByUserArgs,
  handler: async (ctx, args): Promise<AgentRunRecord[]> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const docs = await queryByIndex<Omit<AgentRunRecord, "id">>(
      ctx,
      "agentRuns",
      "by_userId_updatedAt",
      [["userId", args.userId]]
    );

    const latestByAgent = docs
      .map((doc) => toAgentRunRecord(doc as any))
      .reduce<Map<string, AgentRunRecord>>((runsByAgent, run) => {
        const existing = runsByAgent.get(run.agentId);
        if (!existing || run.updatedAt > existing.updatedAt) {
          runsByAgent.set(run.agentId, run);
        }
        return runsByAgent;
      }, new Map<string, AgentRunRecord>());

    return Array.from(latestByAgent.values()).sort(
      (left, right) => right.updatedAt - left.updatedAt
    );
  },
});
