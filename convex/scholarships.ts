import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { notFoundError } from "./lib/errors";
import { paginateItems } from "./lib/pagination";
import { toScholarshipRecord, toAgentRecord } from "./lib/records";
import {
  scholarshipListByAgentArgs,
  scholarshipListArgs,
  scholarshipUpsertFromRunArgs,
} from "./lib/validators";
import {
  assertCanManageAgent,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { AgentRecord, ScholarshipRecord } from "./types/contracts";

export const listByUser = query({
  args: scholarshipListArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const scholarships = await queryByIndex<Omit<ScholarshipRecord, "id">>(
      ctx,
      "scholarships",
      "by_userId",
      [["userId", args.userId]]
    );

    const filtered = scholarships
      .map((scholarship) => toScholarshipRecord(scholarship as any))
      .filter((scholarship) => !args.status || scholarship.status === args.status)
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(filtered, args);
  },
});

export const listByAgent = query({
  args: scholarshipListByAgentArgs,
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

    const scholarships = await queryByIndex<Omit<ScholarshipRecord, "id">>(
      ctx,
      "scholarships",
      "by_agentId",
      [["agentId", args.agentId]]
    );

    const sorted = scholarships
      .map((scholarship) => toScholarshipRecord(scholarship as any))
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(sorted, args);
  },
});

export const upsertFromRun = mutation({
  args: scholarshipUpsertFromRunArgs,
  handler: async (ctx, args): Promise<ScholarshipRecord> => {
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
      await queryByIndex<Omit<ScholarshipRecord, "id">>(ctx, "scholarships", "by_agentId", [["agentId", args.agentId]])
    ).find(
      (scholarship) =>
        scholarship.title === args.title && scholarship.source === args.source
    );

    const timestamp = Date.now();

    if (existing) {
      await patchDoc(ctx, existing._id, {
        deadline: args.deadline,
        eligibility: args.eligibility,
        matchScore: args.matchScore,
        status: args.status,
        missingFields: args.missingFields,
        updatedAt: timestamp,
      });

      return {
        ...toScholarshipRecord(existing as any),
        deadline: args.deadline,
        eligibility: args.eligibility,
        matchScore: args.matchScore,
        status: args.status,
        missingFields: args.missingFields,
        updatedAt: timestamp,
      };
    }

    const id = await insertDoc(ctx, "scholarships", {
      userId: args.userId,
      agentId: args.agentId,
      title: args.title,
      source: args.source,
      deadline: args.deadline,
      eligibility: args.eligibility,
      matchScore: args.matchScore,
      status: args.status,
      missingFields: args.missingFields,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      id,
      userId: args.userId,
      agentId: args.agentId,
      title: args.title,
      source: args.source,
      deadline: args.deadline,
      eligibility: args.eligibility,
      matchScore: args.matchScore,
      status: args.status,
      missingFields: args.missingFields,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});
