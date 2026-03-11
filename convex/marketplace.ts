import { mutation, query } from "./_generated/server";
import {
  getDoc,
  insertDoc,
  patchDoc,
  queryByIndex,
} from "./lib/db";
import { invalidStateError, notFoundError } from "./lib/errors";
import { appendAgentLog } from "./lib/logging";
import {
  buildTemplateDocumentFromDraft,
  deriveAgentOwnerType,
  isTemplateArchived,
  mergeInstalledConfig,
  resolveInstalledSchedule,
} from "./lib/marketplace";
import {
  prepareAgentConfigForStorage,
  syncRegistrationMonitorsForConfig,
} from "./lib/agentConfig";
import { paginateItems } from "./lib/pagination";
import {
  toAgentRecord,
  toMarketplaceTemplateRecord,
  toTemplateSubmissionRecord,
} from "./lib/records";
import { assertValidScheduleConfig } from "./lib/runControl";
import {
  marketplaceGetTemplateArgs,
  marketplaceInstallTemplateArgs,
  marketplaceReviewSubmissionArgs,
  marketplaceSubmitTemplateArgs,
  marketplaceTemplateFilterArgs,
} from "./lib/validators";
import {
  assertCanManageTemplate,
  assertCanReadTemplate,
  assertModerator,
  assertUserOwnsResource,
  resolveActingUserId,
} from "./security/authz";
import type {
  AgentRecord,
  MarketplaceTemplateRecord,
  TemplateInstallResult,
  TemplateReviewResult,
  TemplateSubmissionRecord,
} from "./types/contracts";

export const listTemplates = query({
  args: marketplaceTemplateFilterArgs,
  handler: async (ctx, args) => {
    // Authz check BEFORE data access to prevent unauthorized reads
    if (args.ownerUserId) {
      const actingUserId = await resolveActingUserId(ctx, args.ownerUserId, (args as { sessionToken?: string }).sessionToken);
      await assertUserOwnsResource(ctx, actingUserId, args.ownerUserId);
    }

    let templates = args.ownerUserId
      ? await queryByIndex<Omit<MarketplaceTemplateRecord, "id">>(
          ctx,
          "marketplaceTemplates",
          "by_ownerUserId",
          [["ownerUserId", args.ownerUserId]]
        )
      : args.category
        ? await queryByIndex<Omit<MarketplaceTemplateRecord, "id">>(
            ctx,
            "marketplaceTemplates",
            "by_source_category_visibility",
            [["source", args.source], ["category", args.category], ["visibility", args.visibility ?? "public"]]
          )
        : await queryByIndex<Omit<MarketplaceTemplateRecord, "id">>(
            ctx,
            "marketplaceTemplates",
            "by_source_visibility",
            [["source", args.source], ["visibility", args.visibility ?? "public"]]
          );

    const filteredTemplates = templates
      .map((doc) => toMarketplaceTemplateRecord(doc as any))
      .filter((template) => {
        if (isTemplateArchived(template)) {
          return false;
        }

        if (args.ownerUserId) {
          if (template.ownerUserId !== args.ownerUserId) {
            return false;
          }

          if (args.visibility && template.visibility !== args.visibility) {
            return false;
          }

          return template.source === args.source && (!args.category || template.category === args.category);
        }

        return template.visibility === (args.visibility ?? "public");
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);

    return paginateItems(filteredTemplates, args);
  },
});

export const getTemplate = query({
  args: marketplaceGetTemplateArgs,
  handler: async (ctx, args): Promise<MarketplaceTemplateRecord | null> => {
    const templateDoc = await getDoc<Omit<MarketplaceTemplateRecord, "id">>(ctx, args.templateId);

    if (!templateDoc) {
      return null;
    }

    const template = toMarketplaceTemplateRecord(templateDoc as any);
    const actingUserId = await resolveActingUserId(ctx);
    await assertCanReadTemplate(ctx, template, actingUserId);

    return template;
  },
});

export const installTemplate = mutation({
  args: marketplaceInstallTemplateArgs,
  handler: async (ctx, args): Promise<TemplateInstallResult> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    const templateDoc = await getDoc<Omit<MarketplaceTemplateRecord, "id">>(ctx, args.templateId);

    if (!templateDoc) {
      throw notFoundError("template not found", {
        templateId: args.templateId,
      });
    }

    const template = toMarketplaceTemplateRecord(templateDoc as any);
    await assertCanReadTemplate(ctx, template, actingUserId ?? args.userId);

    if (isTemplateArchived(template)) {
      throw invalidStateError("archived templates cannot be installed", {
        templateId: args.templateId,
      });
    }

    const existingAgents = await queryByIndex<Omit<AgentRecord, "id">>(
      ctx,
      "agents",
      "by_userId",
      [["userId", args.userId]]
    );
    const existingAgentDoc = existingAgents.find((agent) => String((agent as any).templateId) === args.templateId);

    if (existingAgentDoc) {
      return {
        agent: toAgentRecord(existingAgentDoc as any),
        template,
        installed: false,
      };
    }

    const timestamp = Date.now();
    const config = await prepareAgentConfigForStorage(
      mergeInstalledConfig(template.templateConfig, args.config)
    );
    const schedule = assertValidScheduleConfig(
      resolveInstalledSchedule(config, template.templateConfig.defaultSchedule)
    );
    const nextRunAt = schedule.enabled ? timestamp : undefined;

    const agentId = await insertDoc(ctx, "agents", {
      userId: args.userId,
      templateId: args.templateId,
      ownerType: deriveAgentOwnerType(template.source),
      type: template.templateType,
      status: "active",
      config,
      schedule,
      lastRunStatus: "idle",
      lastRunAt: undefined,
      nextRunAt,
      browserUseTaskId: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (template.templateType === "reg") {
      await syncRegistrationMonitorsForConfig(ctx, {
        userId: args.userId,
        agentId,
        config,
        timestamp,
      });
    }

    await patchDoc(ctx, args.templateId, {
      installCount: template.installCount + 1,
      updatedAt: timestamp,
    });

    await appendAgentLog(ctx, {
      agentId,
      event: "agent.installed",
      details: {
        templateId: args.templateId,
        templateSource: template.source,
      },
    });

    return {
      agent: {
        id: agentId,
        userId: args.userId,
        templateId: args.templateId,
        ownerType: deriveAgentOwnerType(template.source),
        type: template.templateType,
        status: "active",
        config,
        schedule,
        lastRunStatus: "idle",
        nextRunAt,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      template: {
        ...template,
        installCount: template.installCount + 1,
        updatedAt: timestamp,
      },
      installed: true,
    };
  },
});

export const submitTemplate = mutation({
  args: marketplaceSubmitTemplateArgs,
  handler: async (ctx, args): Promise<TemplateSubmissionRecord> => {
    const actingUserId = await resolveActingUserId(ctx, args.userId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, args.userId);

    if (args.templateId) {
      const templateDoc = await getDoc<Omit<MarketplaceTemplateRecord, "id">>(ctx, args.templateId);

      if (!templateDoc) {
        throw notFoundError("template not found", {
          templateId: args.templateId,
        });
      }

      await assertCanManageTemplate(
        ctx,
        toMarketplaceTemplateRecord(templateDoc as any),
        actingUserId ?? args.userId
      );
    }

    const pendingSubmissions = await queryByIndex<Omit<TemplateSubmissionRecord, "id">>(
      ctx,
      "templateSubmissions",
      "by_userId_status",
      [["userId", args.userId], ["status", "pending_review"]]
    );

    const existingPendingSubmission = pendingSubmissions.find((submission) => {
      if (args.templateId) {
        return String((submission as any).templateId) === args.templateId;
      }

      return (submission as any).draftPayload?.title === args.draftPayload.title;
    });

    if (existingPendingSubmission) {
      return toTemplateSubmissionRecord(existingPendingSubmission as any);
    }

    const timestamp = Date.now();
    const submissionId = await insertDoc(ctx, "templateSubmissions", {
      userId: args.userId,
      templateId: args.templateId,
      draftPayload: args.draftPayload,
      status: "pending_review",
      reviewerId: undefined,
      reviewNotes: undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      id: submissionId,
      userId: args.userId,
      templateId: args.templateId,
      draftPayload: args.draftPayload,
      status: "pending_review",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  },
});

export const reviewSubmission = mutation({
  args: marketplaceReviewSubmissionArgs,
  handler: async (ctx, args): Promise<TemplateReviewResult> => {
    const actingUserId = await resolveActingUserId(ctx, args.reviewerId, args.sessionToken);
    await assertUserOwnsResource(ctx, actingUserId, args.reviewerId);
    await assertModerator(ctx, args.reviewerId);

    const submissionDoc = await getDoc<Omit<TemplateSubmissionRecord, "id">>(ctx, args.submissionId);

    if (!submissionDoc) {
      throw notFoundError("submission not found", {
        submissionId: args.submissionId,
      });
    }

    const submission = toTemplateSubmissionRecord(submissionDoc as any);

    if (submission.status !== "pending_review") {
      throw invalidStateError("only pending_review submissions can be reviewed", {
        submissionId: args.submissionId,
        currentStatus: submission.status,
      });
    }

    const timestamp = Date.now();
    let template: MarketplaceTemplateRecord | undefined;
    let templateId = submission.templateId;

    if (args.decision === "approved") {
      if (submission.templateId) {
        const existingTemplateDoc = await getDoc<Omit<MarketplaceTemplateRecord, "id">>(
          ctx,
          submission.templateId
        );

        if (!existingTemplateDoc) {
          throw notFoundError("submission references missing template", {
            submissionId: args.submissionId,
            templateId: submission.templateId,
          });
        }

        await patchDoc(ctx, submission.templateId, {
          title: submission.draftPayload.title,
          description: submission.draftPayload.description,
          category: submission.draftPayload.category,
          visibility: submission.draftPayload.visibility ?? "public",
          templateType: submission.draftPayload.templateType,
          templateConfig: submission.draftPayload.templateConfig,
          source: "student",
          ownerUserId: submission.userId,
          approvedAt: timestamp,
          archivedAt: undefined,
          updatedAt: timestamp,
        });

        template = {
          ...toMarketplaceTemplateRecord(existingTemplateDoc as any),
          title: submission.draftPayload.title,
          description: submission.draftPayload.description,
          category: submission.draftPayload.category,
          visibility: submission.draftPayload.visibility ?? "public",
          templateType: submission.draftPayload.templateType,
          templateConfig: submission.draftPayload.templateConfig,
          source: "student",
          ownerUserId: submission.userId,
          approvedAt: timestamp,
          archivedAt: undefined,
          updatedAt: timestamp,
        };
      } else {
        templateId = await insertDoc(
          ctx,
          "marketplaceTemplates",
          buildTemplateDocumentFromDraft(submission.userId, submission.draftPayload, timestamp)
        );

        template = {
          id: templateId,
          ...buildTemplateDocumentFromDraft(submission.userId, submission.draftPayload, timestamp),
        };
      }
    }

    await patchDoc(ctx, args.submissionId, {
      templateId,
      status: args.decision,
      reviewerId: args.reviewerId,
      reviewNotes: args.reviewNotes,
      updatedAt: timestamp,
    });

    return {
      submission: {
        ...submission,
        templateId,
        status: args.decision,
        reviewerId: args.reviewerId,
        reviewNotes: args.reviewNotes,
        updatedAt: timestamp,
      },
      template,
    };
  },
});
