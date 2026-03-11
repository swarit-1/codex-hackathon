import type {
  AgentOwnerType,
  ConfigEnvelope,
  MarketplaceTemplateRecord,
  ScheduleConfig,
  TemplateDraftPayload,
  TemplateVisibility,
} from "../types/contracts";

export function deriveAgentOwnerType(source: MarketplaceTemplateRecord["source"]): AgentOwnerType {
  return source === "dev" ? "first_party" : "student";
}

export function isTemplateArchived(template: Pick<MarketplaceTemplateRecord, "archivedAt">): boolean {
  return template.archivedAt !== undefined;
}

export function resolveTemplateVisibility(
  visibility?: TemplateVisibility
): TemplateVisibility {
  return visibility ?? "public";
}

export function mergeInstalledConfig(
  templateConfig: ConfigEnvelope,
  overrideConfig: ConfigEnvelope
): ConfigEnvelope {
  return {
    schemaVersion: overrideConfig.schemaVersion || templateConfig.schemaVersion,
    inputSchema: templateConfig.inputSchema,
    defaultConfig: templateConfig.defaultConfig,
    defaultSchedule: overrideConfig.defaultSchedule ?? templateConfig.defaultSchedule,
    currentConfig:
      overrideConfig.currentConfig ??
      overrideConfig.defaultConfig ??
      templateConfig.currentConfig ??
      templateConfig.defaultConfig,
  };
}

export function resolveInstalledSchedule(
  config: ConfigEnvelope,
  fallbackSchedule?: ScheduleConfig
): ScheduleConfig {
  return (
    config.defaultSchedule ??
    fallbackSchedule ?? {
      enabled: false,
      cron: "",
      timezone: "America/Chicago",
    }
  );
}

export function buildTemplateDocumentFromDraft(
  ownerUserId: string,
  draft: TemplateDraftPayload,
  timestamp: number
) {
  return {
    title: draft.title,
    description: draft.description,
    source: "student" as const,
    category: draft.category,
    visibility: resolveTemplateVisibility(draft.visibility),
    templateType: draft.templateType,
    installCount: 0,
    ownerUserId,
    templateConfig: draft.templateConfig,
    createdAt: timestamp,
    updatedAt: timestamp,
    approvedAt: timestamp,
    archivedAt: undefined,
  };
}
