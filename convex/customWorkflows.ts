import { mutation } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { notFoundError } from "./lib/errors";
import { toAgentRecord, toCustomWorkflowRecord } from "./lib/records";
import {
  customWorkflowCreateArgs,
  customWorkflowUpdateArgs,
} from "./lib/validators";
import {
  assertCanManageAgent,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type { AgentRecord, CustomWorkflowRecord } from "./types/contracts";

export const create = mutation({
  args: customWorkflowCreateArgs,
  handler: async (ctx, args): Promise<CustomWorkflowRecord> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    if (args.agentId) {
      const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

      if (!agentDoc) {
        throw notFoundError("agent not found", {
          agentId: args.agentId,
        });
      }

      const agent = toAgentRecord(agentDoc as any);
      await assertCanManageAgent(ctx, agent, actingUserId ?? args.userId);
    }

    const timestamp = Date.now();
    const id = await insertDoc(ctx, "customWorkflows", {
      userId: args.userId,
      agentId: args.agentId,
      sourceAlias: args.sourceAlias ?? "model_to_agent_studio",
      prompt: args.prompt,
      spec: args.spec,
      generatedScript: args.generatedScript,
      templateSubmissionId: args.templateSubmissionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      id,
      userId: args.userId,
      agentId: args.agentId,
      sourceAlias: args.sourceAlias ?? "model_to_agent_studio",
      prompt: args.prompt,
      spec: args.spec,
      generatedScript: args.generatedScript,
      templateSubmissionId: args.templateSubmissionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const update = mutation({
  args: customWorkflowUpdateArgs,
  handler: async (ctx, args): Promise<CustomWorkflowRecord> => {
    const workflowDocs = await queryByIndex<Omit<CustomWorkflowRecord, "id">>(
      ctx,
      "customWorkflows",
      "by_agentId",
      [["agentId", args.agentId]]
    );
    const latestWorkflow = workflowDocs.sort((left, right) => right.updatedAt - left.updatedAt)[0];

    if (!latestWorkflow) {
      throw notFoundError("workflow not found for agent", {
        agentId: args.agentId,
      });
    }

    const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, args.agentId);

    if (!agentDoc) {
      throw notFoundError("agent not found", {
        agentId: args.agentId,
      });
    }

    const agent = toAgentRecord(agentDoc as any);
    const actingUserId = await resolveActingUserId(ctx, agent.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const updatedAt = Date.now();
    await patchDoc(ctx, latestWorkflow._id, {
      ...args.patch,
      updatedAt,
    });

    return {
      ...toCustomWorkflowRecord(latestWorkflow as any),
      ...args.patch,
      updatedAt,
    };
  },
});
