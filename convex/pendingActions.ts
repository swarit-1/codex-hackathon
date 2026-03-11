import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import { paginateItems } from "./lib/pagination";
import { toPendingActionRecord, toAgentRecord } from "./lib/records";
import {
  pendingActionCreateArgs,
  pendingActionListArgs,
  pendingActionResolveArgs,
} from "./lib/validators";
import { notFoundError } from "./lib/errors";
import {
  assertCanManageAgent,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { AgentRecord, PendingActionRecord } from "./types/contracts";

export const create = mutation({
  args: pendingActionCreateArgs,
  handler: async (ctx, args): Promise<PendingActionRecord> => {
    const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agentDoc) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const agent = toAgentRecord(agentDoc as any);
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? args.userId);

    const timestamp = Date.now();
    const id = await insertDoc(ctx, "pendingActions", {
      userId: args.userId,
      agentId: args.agentId,
      type: args.type,
      prompt: args.prompt,
      response: undefined,
      resolvedAt: undefined,
      createdAt: timestamp,
    });

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "pending_action.created",
      details: {
        pendingActionId: id,
        type: args.type,
      },
    });

    return {
      id,
      userId: args.userId,
      agentId: args.agentId,
      type: args.type,
      prompt: args.prompt,
      createdAt: timestamp,
    };
  },
});

export const resolve = mutation({
  args: pendingActionResolveArgs,
  handler: async (ctx, args): Promise<PendingActionRecord> => {
    const pendingActionDoc = await getDoc<Omit<PendingActionRecord, "id">>(ctx, args.actionId);

    if (!pendingActionDoc) {
      throw notFoundError("pending action not found", {
        actionId: args.actionId,
      });
    }

    const pendingAction = toPendingActionRecord(pendingActionDoc as any);
    const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, pendingAction.agentId);

    if (!agentDoc) {
      throw notFoundError("agent not found", {
        agentId: pendingAction.agentId,
      });
    }

    const agent = toAgentRecord(agentDoc as any);
    const actingUserId = await resolveActingUserId(ctx, pendingAction.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? pendingAction.userId);

    const resolvedAt = Date.now();
    await patchDoc(ctx, args.actionId, {
      response: args.response,
      resolvedAt,
    });

    await appendAgentLog(ctx, {
      agentId: pendingAction.agentId,
      event: "pending_action.resolved",
      details: {
        pendingActionId: args.actionId,
      },
    });

    return {
      ...pendingAction,
      response: args.response,
      resolvedAt,
    };
  },
});

export const listByUser = query({
  args: pendingActionListArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const docs = await queryByIndex<Omit<PendingActionRecord, "id">>(
      ctx,
      "pendingActions",
      "by_userId",
      [["userId", args.userId]]
    );

    const actions = docs
      .map((action) => toPendingActionRecord(action as any))
      .sort((left, right) => right.createdAt - left.createdAt);

    return paginateItems(actions, args);
  },
});
