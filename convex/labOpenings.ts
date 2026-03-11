import { query } from "./_generated/server";
import { getDoc, queryByIndex } from "./lib/db";
import { notFoundError } from "./lib/errors";
import { paginateItems } from "./lib/pagination";
import { toAgentRecord, toLabOpeningRecord } from "./lib/records";
import { labOpeningListByAgentArgs } from "./lib/validators";
import { assertCanManageAgent, resolveActingUserId } from "./security/authz";
import type { AgentRecord, LabOpeningRecord } from "./types/contracts";

export const listByAgent = query({
  args: labOpeningListByAgentArgs,
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

    const docs = await queryByIndex<Omit<LabOpeningRecord, "id">>(
      ctx,
      "labOpenings",
      "by_agentId",
      [["agentId", args.agentId]]
    );

    const openings = docs
      .map((doc) => toLabOpeningRecord(doc as any))
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(openings, args);
  },
});
