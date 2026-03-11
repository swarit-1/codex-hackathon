import { mutation, query } from "./_generated/server";
import { getDoc, insertDoc, patchDoc, queryByIndex } from "./lib/db";
import { notFoundError } from "./lib/errors";
import { paginateItems } from "./lib/pagination";
import { toAgentRecord, toCustomWorkflowRecord } from "./lib/records";
import {
  customWorkflowCreateArgs,
  customWorkflowListArgs,
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

export const listByUser = query({
  args: customWorkflowListArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const workflowDocs = await queryByIndex<Omit<CustomWorkflowRecord, "id">>(
      ctx,
      "customWorkflows",
      "by_userId",
      [["userId", args.userId]]
    );

    const workflows = workflowDocs
      .map((workflow) => toCustomWorkflowRecord(workflow as any))
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(workflows, args);
  },
});

export const update = mutation({
  args: customWorkflowUpdateArgs,
  handler: async (ctx, args): Promise<CustomWorkflowRecord> => {
    const workflowDoc = await getDoc<Omit<CustomWorkflowRecord, "id">>(ctx, args.workflowId);

    if (!workflowDoc) {
      throw notFoundError("workflow not found", {
        workflowId: args.workflowId,
      });
    }

    const workflow = toCustomWorkflowRecord(workflowDoc as any);
    const actingUserId = await resolveActingUserId(ctx, workflow.userId);
    await assertUserOwnsResource(ctx, actingUserId, workflow.userId);

    const patchSource =
      args.patch && typeof args.patch === "object" && !Array.isArray(args.patch)
        ? args.patch
        : {};
    const updatesFromArgs = {
      spec: args.spec,
      generatedScript: args.generatedScript,
      prompt: args.prompt,
      agentId: args.agentId,
      templateSubmissionId: args.templateSubmissionId,
    };
    const patch = {
      ...updatesFromArgs,
      ...(patchSource as {
        spec?: unknown;
        generatedScript?: string;
        prompt?: string;
        agentId?: string;
        templateSubmissionId?: string;
      }),
    };

    if (patch.agentId) {
      const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, patch.agentId);

      if (!agentDoc) {
        throw notFoundError("agent not found", {
          agentId: patch.agentId,
        });
      }

      const agent = toAgentRecord(agentDoc as any);
      await assertCanManageAgent(ctx, agent, actingUserId ?? workflow.userId);
    }

    const updatedAt = Date.now();
    // Build update object from explicit allowed fields only
    const updates: Record<string, unknown> = { updatedAt };
    if (patch.spec !== undefined) updates.spec = patch.spec;
    if (patch.generatedScript !== undefined) updates.generatedScript = patch.generatedScript;
    if (patch.prompt !== undefined) updates.prompt = patch.prompt;
    if (patch.agentId !== undefined) updates.agentId = patch.agentId;
    if (patch.templateSubmissionId !== undefined) updates.templateSubmissionId = patch.templateSubmissionId;

    await patchDoc(ctx, args.workflowId, updates);

    return {
      ...workflow,
      ...updates,
    };
  },
});
