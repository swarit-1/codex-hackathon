import { mutation, query } from "./_generated/server";
import {
  deleteDoc,
  getDoc,
  insertDoc,
  patchDoc,
  queryByIndex,
} from "./lib/db";
import { invalidStateError, notFoundError } from "./lib/errors";
import { appendAgentLog } from "./lib/logging";
import {
  deriveAgentOwnerType,
  mergeInstalledConfig,
  resolveInstalledSchedule,
} from "./lib/marketplace";
import { paginateItems } from "./lib/pagination";
import { toAgentRecord, toMarketplaceTemplateRecord } from "./lib/records";
import {
  assertDeleteAllowed,
  assertValidScheduleConfig,
  buildAgentOperationEvent,
  buildRuntimeHandoffPayload,
} from "./lib/runControl";
import {
  agentCreateArgs,
  agentDeleteArgs,
  agentListFilterArgs,
  agentRunNowArgs,
  agentUpdateScheduleArgs,
  agentUpdateStatusArgs,
} from "./lib/validators";
import {
  assertUserOwnsResource,
  assertCanManageAgent,
  assertCanReadTemplate,
  resolveActingUserId,
} from "./security/authz";
import type {
  AgentDeleteResult,
  AgentRecord,
  AgentRunNowResult,
  AgentScheduleUpdateResult,
  MarketplaceTemplateRecord,
} from "./types/contracts";

async function getAgentOrThrow(ctx: any, agentId: string): Promise<AgentRecord> {
  const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, agentId);

  if (!agentDoc) {
    throw notFoundError("agent not found", {
      agentId,
    });
  }

  return toAgentRecord(agentDoc as any);
}

async function deleteByAgentId(ctx: any, table: string, agentId: string): Promise<void> {
  const docs = await queryByIndex<Record<string, unknown>>(
    ctx,
    table,
    "by_agentId",
    [["agentId", agentId]]
  );

  await Promise.all(docs.map((doc) => deleteDoc(ctx, doc._id)));
}

export const create = mutation({
  args: agentCreateArgs,
  handler: async (ctx, args): Promise<AgentRecord> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const timestamp = Date.now();
    let ownerType = args.ownerType ?? "generated";
    let type = args.type;
    let config = args.config;
    let schedule = args.schedule ?? resolveInstalledSchedule(args.config);

    if (args.templateId) {
      const templateDoc = await getDoc<Omit<MarketplaceTemplateRecord, "id">>(ctx, args.templateId);

      if (!templateDoc) {
        throw notFoundError("template not found", {
          templateId: args.templateId,
        });
      }

      const template = toMarketplaceTemplateRecord(templateDoc as any);
      await assertCanReadTemplate(ctx, template, actingUserId ?? args.userId);

      ownerType = args.ownerType ?? deriveAgentOwnerType(template.source);
      type = template.templateType;
      config = mergeInstalledConfig(template.templateConfig, args.config);
      schedule = args.schedule ?? resolveInstalledSchedule(config, template.templateConfig.defaultSchedule);
    }

    const validatedSchedule = assertValidScheduleConfig(schedule);
    const nextRunAt = validatedSchedule.enabled ? timestamp : undefined;

    const agentId = await insertDoc(ctx, "agents", {
      userId: args.userId,
      templateId: args.templateId,
      ownerType,
      type,
      status: "active",
      config,
      schedule: validatedSchedule,
      lastRunStatus: "idle",
      lastRunAt: undefined,
      nextRunAt,
      browserUseTaskId: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await appendAgentLog(ctx, {
      agentId,
      event: "agent.created",
      details: {
        ownerType,
        type,
        templateId: args.templateId,
      },
    });

    return {
      id: agentId,
      userId: args.userId,
      templateId: args.templateId,
      ownerType,
      type,
      status: "active",
      config,
      schedule: validatedSchedule,
      lastRunStatus: "idle",
      nextRunAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const updateStatus = mutation({
  args: agentUpdateStatusArgs,
  handler: async (ctx, args): Promise<AgentRecord> => {
    const agent = await getAgentOrThrow(ctx, args.agentId);
    const actingUserId = await resolveActingUserId(ctx, agent.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const timestamp = Date.now();
    await patchDoc(ctx, args.agentId, {
      status: args.status,
      updatedAt: timestamp,
    });

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.status.updated",
      details: {
        status: args.status,
      },
    });

    return {
      ...agent,
      status: args.status,
      updatedAt: timestamp,
    };
  },
});

export const listByUser = query({
  args: agentListFilterArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const agents = await queryByIndex<Omit<AgentRecord, "id">>(
      ctx,
      "agents",
      "by_userId",
      [["userId", args.userId]]
    );

    const filteredAgents = agents
      .map((agent) => toAgentRecord(agent as any))
      .filter((agent) => {
        if (args.status && agent.status !== args.status) {
          return false;
        }

        if (args.ownerType && agent.ownerType !== args.ownerType) {
          return false;
        }

        if (args.type && agent.type !== args.type) {
          return false;
        }

        return true;
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(filteredAgents, args);
  },
});

export const runNow = mutation({
  args: agentRunNowArgs,
  handler: async (ctx, args): Promise<AgentRunNowResult> => {
    const agent = await getAgentOrThrow(ctx, args.agentId);
    const actingUserId = await resolveActingUserId(ctx, agent.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const timestamp = Date.now();
    const alreadyRunning = agent.lastRunStatus === "running";
    const operationEvent = buildAgentOperationEvent({
      agentId: agent.id,
      operation: "run_now",
      status: alreadyRunning ? "deferred" : "accepted",
      source: "my_agents",
      emittedAt: timestamp,
      message: alreadyRunning
        ? "run request ignored because agent is already running"
        : "manual run request accepted for downstream runtime processing",
    });
    const handoffPayload = buildRuntimeHandoffPayload({
      agentId: agent.id,
      runType: "manual",
      source: "my_agents",
      requestedAt: timestamp,
      requestedByUserId: actingUserId ?? agent.userId,
      schedule: agent.schedule,
    });

    if (!alreadyRunning) {
      await patchDoc(ctx, args.agentId, {
        status: "active",
        lastRunStatus: "running",
        lastRunAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.run_now.requested",
      details: operationEvent,
    });

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.runtime.handoff_prepared",
      details: handoffPayload,
    });

    return {
      agent: {
        ...agent,
        status: "active",
        lastRunStatus: alreadyRunning ? agent.lastRunStatus : "running",
        lastRunAt: alreadyRunning ? agent.lastRunAt : timestamp,
        updatedAt: alreadyRunning ? agent.updatedAt : timestamp,
      },
      operationEvent,
      handoffPayload,
      alreadyRunning,
    };
  },
});

export const updateSchedule = mutation({
  args: agentUpdateScheduleArgs,
  handler: async (ctx, args): Promise<AgentScheduleUpdateResult> => {
    const agent = await getAgentOrThrow(ctx, args.agentId);
    const actingUserId = await resolveActingUserId(ctx, agent.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const timestamp = Date.now();
    const schedule = assertValidScheduleConfig(args.schedule);
    const nextRunAt = schedule.enabled ? timestamp : undefined;

    await patchDoc(ctx, args.agentId, {
      schedule,
      nextRunAt,
      updatedAt: timestamp,
    });

    const operationEvent = buildAgentOperationEvent({
      agentId: agent.id,
      operation: "schedule_update",
      status: "accepted",
      source: "my_agents",
      emittedAt: timestamp,
      message: "schedule updated successfully",
      metadata: {
        schedule,
      },
    });

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.schedule.updated",
      details: operationEvent,
    });

    return {
      agent: {
        ...agent,
        schedule,
        nextRunAt,
        updatedAt: timestamp,
      },
      operationEvent,
    };
  },
});

export const deleteAgent = mutation({
  args: agentDeleteArgs,
  handler: async (ctx, args): Promise<AgentDeleteResult> => {
    const agent = await getAgentOrThrow(ctx, args.agentId);
    const actingUserId = await resolveActingUserId(ctx, agent.userId);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const deleteMode = assertDeleteAllowed(agent);

    if (deleteMode === "cancel_then_archive") {
      throw invalidStateError("running agents cannot be deleted until runtime cancellation is wired", {
        agentId: args.agentId,
      });
    }

    const timestamp = Date.now();
    const operationEvent = buildAgentOperationEvent({
      agentId: agent.id,
      operation: "delete",
      status: "accepted",
      source: "my_agents",
      emittedAt: timestamp,
      message: "agent deleted successfully",
    });

    await Promise.all([
      deleteByAgentId(ctx, "agentLogs", args.agentId),
      deleteByAgentId(ctx, "scholarships", args.agentId),
      deleteByAgentId(ctx, "registrationMonitors", args.agentId),
      deleteByAgentId(ctx, "pendingActions", args.agentId),
      deleteByAgentId(ctx, "customWorkflows", args.agentId),
    ]);

    await deleteDoc(ctx, args.agentId);

    return {
      deletedAgentId: args.agentId,
      deleteMode,
      operationEvent,
    };
  },
});

export { deleteAgent as delete };
