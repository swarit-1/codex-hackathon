import { randomUUID } from "node:crypto";

import type {
  AgentRecord,
  AgentType,
  MarketplaceTemplate,
  RunType,
  RuntimeRunContext,
} from "../../../convex/types/contracts.ts";
import { createRunContextEnvelope } from "./eventTypes.ts";

export const MARKETPLACE_INSTALL_DEV_TEMPLATE_SCENARIO = "marketplace_install_dev_template";
export const SCHOLARBOT_HAPPY_PATH_SCENARIO = "scholarbot_happy_path";
export const REGBOT_HAPPY_PATH_SCENARIO = "regbot_happy_path";
export const MY_AGENTS_RUN_NOW_SCENARIO = "my_agents_run_now";
export const MY_AGENTS_SCHEDULE_UPDATE_SCENARIO = "my_agents_schedule_update";
export const MY_AGENTS_DELETE_SCENARIO = "my_agents_delete";

export function instantiateTemplateConfig(
  template: MarketplaceTemplate,
  userConfig: Record<string, unknown>,
): Record<string, unknown> {
  if (template.source !== "dev") {
    throw new Error(`Phase 1 supports only dev templates, received source: ${template.source}`);
  }

  if (template.agentType !== "scholar" && template.agentType !== "reg") {
    throw new Error(`Phase 1 supports only first-party scholar/reg templates, received: ${template.agentType}`);
  }

  if ((template.templateConfig.requiredApproval as boolean | undefined) === true) {
    throw new Error("Template requires approval and cannot be installed in Phase 1 runtime");
  }

  return {
    ...template.templateConfig,
    ...userConfig,
    templateTitle: template.title,
  };
}

export function deriveAgentScenarioId(agentType: AgentType): string {
  if (agentType === "scholar") {
    return SCHOLARBOT_HAPPY_PATH_SCENARIO;
  }
  if (agentType === "reg") {
    return REGBOT_HAPPY_PATH_SCENARIO;
  }
  return "flowforge_happy_path";
}

export function deriveRuntimeScenarioId(runType: RunType, agentType: AgentType): string {
  if (runType === "manual") {
    return MY_AGENTS_RUN_NOW_SCENARIO;
  }
  return deriveAgentScenarioId(agentType);
}

export function deriveInstallScenarioId(runType: RunType): string | undefined {
  if (runType === "install") {
    return MARKETPLACE_INSTALL_DEV_TEMPLATE_SCENARIO;
  }
  return undefined;
}

export function buildRunContext(agent: AgentRecord, runType: RunType): RuntimeRunContext {
  const runId = randomUUID();
  return createRunContextEnvelope({
    agentId: agent.id,
    runId,
    templateId: agent.templateId,
    scenarioId: deriveRuntimeScenarioId(runType, agent.type),
    status: runType === "resume" ? "paused" : agent.status,
    details: { runType },
  });
}

export function toLogDetails(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    normalizedAt: new Date().toISOString(),
  };
}
