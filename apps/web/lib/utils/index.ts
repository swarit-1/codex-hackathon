import type { ConfigEnvelope, JsonObject } from "@convex/types/contracts";
import type {
  CurrentUserProfile,
  FilterOption,
  MarketplaceTemplate,
  ProfileFormValues,
} from "../contracts/types";

export type EditableConfigValue = string | boolean;

export type ConfigFieldOption = {
  label: string;
  value: string;
};

export type ConfigFieldDefinition = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  options?: ConfigFieldOption[];
  uiWidth?: "compact" | "default";
};

export const noop = () => undefined;

export function slugifyCategory(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}

export function buildMarketplaceCategories(templates: MarketplaceTemplate[]): FilterOption[] {
  const categories = Array.from(new Set(templates.map((template) => template.category))).sort(
    (left, right) => left.localeCompare(right)
  );

  return [
    { label: "All categories", value: "all" },
    ...categories.map((category) => ({
      label: category,
      value: slugifyCategory(category),
    })),
  ];
}

function normalizeFieldOption(option: unknown): ConfigFieldOption | null {
  if (typeof option === "string") {
    return {
      label: option,
      value: option,
    };
  }

  if (!option || typeof option !== "object") {
    return null;
  }

  const label =
    typeof (option as Record<string, unknown>).label === "string"
      ? String((option as Record<string, unknown>).label)
      : undefined;
  const value =
    typeof (option as Record<string, unknown>).value === "string"
      ? String((option as Record<string, unknown>).value)
      : undefined;

  if (!label || !value) {
    return null;
  }

  return { label, value };
}

function normalizeFieldDefinition(field: unknown): ConfigFieldDefinition | null {
  if (!field || typeof field !== "object") {
    return null;
  }

  const record = field as Record<string, unknown>;
  const key = typeof record.key === "string" ? record.key : undefined;
  const label = typeof record.label === "string" ? record.label : key;
  const type = typeof record.type === "string" ? record.type : "text";

  if (!key || !label) {
    return null;
  }

  return {
    key,
    label,
    type,
    required: record.required === true,
    description: typeof record.description === "string" ? record.description : undefined,
    uiWidth: record.uiWidth === "compact" ? "compact" : "default",
    options: Array.isArray(record.options)
      ? record.options
          .map((option) => normalizeFieldOption(option))
          .filter((option): option is ConfigFieldOption => option !== null)
      : undefined,
  };
}

export function extractConfigFields(inputSchema: unknown): {
  supportedFields: ConfigFieldDefinition[];
  unsupportedFields: ConfigFieldDefinition[];
} {
  const rawFields = (inputSchema as { fields?: unknown[] } | undefined)?.fields;

  if (!Array.isArray(rawFields)) {
    return {
      supportedFields: [],
      unsupportedFields: [],
    };
  }

  const supportedFields: ConfigFieldDefinition[] = [];
  const unsupportedFields: ConfigFieldDefinition[] = [];

  for (const rawField of rawFields) {
    const field = normalizeFieldDefinition(rawField);

    if (!field) {
      continue;
    }

    if (["text", "textarea", "select", "boolean", "checkbox", "url", "email"].includes(field.type)) {
      supportedFields.push(field);
      continue;
    }

    unsupportedFields.push(field);
  }

  return {
    supportedFields,
    unsupportedFields,
  };
}

export function getEditableConfigValues(config: ConfigEnvelope): Record<string, EditableConfigValue> {
  const baseConfig = {
    ...(config.defaultConfig as Record<string, EditableConfigValue> | undefined),
    ...(config.currentConfig as Record<string, EditableConfigValue> | undefined),
  };
  const { supportedFields } = extractConfigFields(config.inputSchema);

  return supportedFields.reduce<Record<string, EditableConfigValue>>((values, field) => {
    const rawValue = baseConfig[field.key];

    if (typeof rawValue === "boolean") {
      values[field.key] = rawValue;
      return values;
    }

    values[field.key] = typeof rawValue === "string" ? rawValue : field.type === "boolean" || field.type === "checkbox" ? false : "";
    return values;
  }, {});
}

export function buildConfigEnvelope(
  config: ConfigEnvelope,
  currentValues: Record<string, EditableConfigValue>
): ConfigEnvelope {
  return {
    schemaVersion: config.schemaVersion,
    inputSchema: config.inputSchema,
    defaultConfig: config.defaultConfig,
    defaultSchedule: config.defaultSchedule,
    currentConfig: {
      ...(config.defaultConfig as Record<string, EditableConfigValue> | undefined),
      ...(config.currentConfig as Record<string, EditableConfigValue> | undefined),
      ...currentValues,
    },
  };
}

export function profileToFormValues(profile?: CurrentUserProfile | null): ProfileFormValues {
  const profileData = (profile?.profileData as Record<string, unknown> | undefined) ?? {};

  return {
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    eid: profile?.eid ?? "",
    major: typeof profileData.major === "string" ? profileData.major : "",
    classification:
      typeof profileData.classification === "string" ? profileData.classification : "",
    scholarshipInterests: Array.isArray(profileData.scholarshipInterests)
      ? profileData.scholarshipInterests.join(", ")
      : typeof profileData.scholarshipInterests === "string"
        ? profileData.scholarshipInterests
        : "",
    notifications:
      typeof profileData.notifications === "string" ? profileData.notifications : "",
  };
}

export function profileFormValuesToProfileData(values: ProfileFormValues): JsonObject {
  return {
    major: values.major.trim(),
    classification: values.classification.trim(),
    scholarshipInterests: values.scholarshipInterests
      .split(",")
      .map((interest) => interest.trim())
      .filter(Boolean),
    notifications: values.notifications.trim(),
  };
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
