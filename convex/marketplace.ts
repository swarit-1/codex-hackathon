import { append as appendLog } from "./agentLogs.ts";
import { create as createAgent } from "./agents.ts";
import { DEFAULT_USER_ID, getRuntimeStore, nextId } from "./runtimeStore.ts";
import type {
  MarketplaceTemplate,
  TemplateSubmission,
  SubmissionStatus,
} from "./types/contracts.ts";
import {
  MARKETPLACE_INSTALL_DEV_TEMPLATE_SCENARIO,
  instantiateTemplateConfig,
} from "../services/agents/shared/payloadMappers.ts";
import { triggerAgentRun } from "./orchestrator.ts";

export interface ListTemplateFilters {
  source?: "dev" | "student";
  visibility?: "private" | "public";
  category?: string;
}

export function listTemplates(filters: ListTemplateFilters = {}): MarketplaceTemplate[] {
  return [...getRuntimeStore().marketplaceTemplates.values()]
    .filter((template) => {
      if (filters.source && template.source !== filters.source) {
        return false;
      }
      if (filters.visibility && template.visibility !== filters.visibility) {
        return false;
      }
      if (filters.category && template.category !== filters.category) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getTemplate(templateId: string): MarketplaceTemplate {
  const template = getRuntimeStore().marketplaceTemplates.get(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return template;
}

export async function installTemplate(
  templateId: string,
  config: Record<string, unknown>,
  userId: string = DEFAULT_USER_ID,
): Promise<{ template: MarketplaceTemplate; agentId: string; runResult: unknown }> {
  const store = getRuntimeStore();
  const template = getTemplate(templateId);
  const runtimeConfig = instantiateTemplateConfig(template, config);

  const agent = createAgent(template.agentType, runtimeConfig, {
    userId,
    templateId: template.id,
    ownerType: template.source === "dev" ? "first_party" : "student",
    schedule: typeof config.schedule === "string" ? config.schedule : undefined,
  });

  const updatedTemplate: MarketplaceTemplate = {
    ...template,
    installCount: template.installCount + 1,
    updatedAt: new Date().toISOString(),
  };
  store.marketplaceTemplates.set(template.id, updatedTemplate);

  appendLog({
    agentId: agent.id,
    event: "start",
    scenarioId: MARKETPLACE_INSTALL_DEV_TEMPLATE_SCENARIO,
    details: {
      templateId: template.id,
      templateTitle: template.title,
      message: "Template installed and run kickoff requested",
    },
  });

  const runResult = await triggerAgentRun(agent.id, "install");

  return {
    template: updatedTemplate,
    agentId: agent.id,
    runResult,
  };
}

export function submitTemplate(payload: {
  userId?: string;
  templateId?: string;
  draftPayload: Record<string, unknown>;
}): TemplateSubmission {
  const submission: TemplateSubmission = {
    id: nextId("submission"),
    userId: payload.userId ?? DEFAULT_USER_ID,
    templateId: payload.templateId,
    draftPayload: payload.draftPayload,
    status: "pending_review",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  getRuntimeStore().templateSubmissions.set(submission.id, submission);
  return submission;
}

export function reviewSubmission(
  submissionId: string,
  decision: Extract<SubmissionStatus, "approved" | "rejected">,
  reviewerId: string = "moderator_demo",
  reviewNotes?: string,
): TemplateSubmission {
  const store = getRuntimeStore();
  const submission = store.templateSubmissions.get(submissionId);
  if (!submission) {
    throw new Error(`Template submission not found: ${submissionId}`);
  }

  const updated: TemplateSubmission = {
    ...submission,
    status: decision,
    reviewerId,
    reviewNotes,
    updatedAt: new Date().toISOString(),
  };

  store.templateSubmissions.set(submissionId, updated);
  return updated;
}
