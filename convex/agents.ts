import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  deleteDoc,
  getDoc,
  insertDoc,
  patchDoc,
  queryByIndex,
} from "./lib/db";
import { notFoundError, rateLimitError } from "./lib/errors";
import { getAgentOrThrow, deleteByAgentId } from "./lib/agentUtils";
import { appendAgentLog } from "./lib/logging";
import {
  deriveAgentOwnerType,
  mergeInstalledConfig,
  resolveInstalledSchedule,
} from "./lib/marketplace";
import {
  prepareAgentConfigForStorage,
  syncRegistrationMonitorsForConfig,
} from "./lib/agentConfig";
import { paginateItems } from "./lib/pagination";
import { toAgentRecord, toMarketplaceTemplateRecord } from "./lib/records";
import {
  assertDeleteAllowed,
  assertValidScheduleConfig,
  buildAgentOperationEvent,
  buildRuntimeHandoffPayload,
} from "./lib/runControl";
import { createAgentRun } from "./lib/agentRuns";
import {
  agentCreateArgs,
  agentDeleteArgs,
  agentListFilterArgs,
  agentRunNowArgs,
  agentUpdateConfigArgs,
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

export const create = mutation({
  args: agentCreateArgs,
  handler: async (ctx, args): Promise<AgentRecord> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const timestamp = Date.now();
    let ownerType = args.ownerType ?? "generated";
    let type = args.type;
    let config = await prepareAgentConfigForStorage(args.config);
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
      config = await prepareAgentConfigForStorage(
        mergeInstalledConfig(template.templateConfig, args.config)
      );
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

    if (type === "reg") {
      await syncRegistrationMonitorsForConfig(ctx, {
        userId: args.userId,
        agentId,
        config,
        timestamp,
      });
    }

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
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
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

export const updateConfig = mutation({
  args: agentUpdateConfigArgs,
  handler: async (ctx, args): Promise<AgentRecord> => {
    const agent = await getAgentOrThrow(ctx, args.agentId);
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    let nextConfig = args.config;

    if (agent.templateId) {
      const templateDoc = await getDoc<Omit<MarketplaceTemplateRecord, "id">>(ctx, agent.templateId);

      if (templateDoc) {
        nextConfig = mergeInstalledConfig(
          toMarketplaceTemplateRecord(templateDoc as any).templateConfig,
          args.config
        );
      }
    }

    nextConfig = await prepareAgentConfigForStorage(nextConfig, agent.config);

    const timestamp = Date.now();
    await patchDoc(ctx, args.agentId, {
      config: nextConfig,
      updatedAt: timestamp,
    });

    if (agent.type === "reg") {
      await syncRegistrationMonitorsForConfig(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        config: nextConfig,
        timestamp,
      });
    }

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      event: "agent.config.updated",
      details: {
        title: "Agent details updated",
        detail: "Configuration changes were saved and will be used for future runs.",
      },
    });

    return {
      ...agent,
      config: nextConfig,
      updatedAt: timestamp,
    };
  },
});

export const listByUser = query({
  args: agentListFilterArgs,
  handler: async (ctx, args) => {
    const actingUserId = await resolveActingUserId(ctx, args.userId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    // Use the most selective index based on provided filters
    let agents;
    if (args.status) {
      agents = await queryByIndex<Omit<AgentRecord, "id">>(
        ctx, "agents", "by_userId_status",
        [["userId", args.userId], ["status", args.status]]
      );
    } else if (args.ownerType) {
      agents = await queryByIndex<Omit<AgentRecord, "id">>(
        ctx, "agents", "by_userId_ownerType",
        [["userId", args.userId], ["ownerType", args.ownerType]]
      );
    } else {
      agents = await queryByIndex<Omit<AgentRecord, "id">>(
        ctx, "agents", "by_userId",
        [["userId", args.userId]]
      );
    }

    const filteredAgents = agents
      .map((agent) => toAgentRecord(agent as any))
      .filter((agent) => {
        // ownerType may still need filtering when status index was used
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
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const RUN_NOW_COOLDOWN_MS = 30_000;
    const timestamp = Date.now();

    if (agent.lastRunAt && timestamp - agent.lastRunAt < RUN_NOW_COOLDOWN_MS) {
      throw rateLimitError("run requests are rate-limited to once every 30 seconds", {
        agentId: args.agentId,
        lastRunAt: agent.lastRunAt,
        cooldownMs: RUN_NOW_COOLDOWN_MS,
      });
    }

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
    let run: Awaited<ReturnType<typeof createAgentRun>> | undefined;

    if (!alreadyRunning) {
      run = await createAgentRun(ctx, {
        userId: agent.userId,
        agentId: agent.id,
        triggerType: "manual",
        status: "queued",
        phase: "queued",
        summary: "Run requested and queued for launch.",
      });

      await patchDoc(ctx, args.agentId, {
        status: "active",
        lastRunStatus: "running",
        lastRunAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: run?.id,
      event: "agent.run_now.requested",
      phase: "queued",
      details: operationEvent,
    });

    await appendAgentLog(ctx, {
      agentId: args.agentId,
      runId: run?.id,
      event: "agent.runtime.handoff_prepared",
      phase: "queued",
      details: handoffPayload,
    });

    // Schedule the actual Browser Use runtime execution
    if (!alreadyRunning) {
      await ctx.scheduler.runAfter(0, internal.runtime.launchBrowserTask, {
        agentId: agent.id,
        runId: run!.id,
        agentType: agent.type,
        config: agent.config,
      });
    }

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
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
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
        schedule: schedule as any,
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
    const actingUserId = await resolveActingUserId(ctx, agent.userId, args.sessionToken);
    await assertCanManageAgent(ctx, agent, actingUserId ?? agent.userId);

    const deleteMode = assertDeleteAllowed(agent);
    const timestamp = Date.now();

    if (deleteMode === "cancel_then_archive") {
      // Cancel the running agent before proceeding with deletion
      await patchDoc(ctx, args.agentId, {
        status: "paused",
        lastRunStatus: "cancelled",
        updatedAt: timestamp,
      });

      await appendAgentLog(ctx, {
        agentId: args.agentId,
        event: "agent.run.cancelled_for_delete",
        details: {
          reason: "agent deletion requested while running",
          previousStatus: agent.lastRunStatus,
        },
      });
    }
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
      deleteByAgentId(ctx, "agentRuns", args.agentId),
      deleteByAgentId(ctx, "scholarships", args.agentId),
      deleteByAgentId(ctx, "labOpenings", args.agentId),
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
