import { createHash } from "node:crypto";
import type {
  AgentType,
  ConfigEnvelope,
  FlowforgeAgentScriptResult,
  FlowforgeWorkflowSpecResult,
  JsonObject,
  JsonValue,
  ScheduleConfig,
  TemplateDraftPayload,
} from "../types/contracts";

const DEFAULT_TIMEZONE = "America/Chicago";

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ");
}

export function inferTemplateType(description: string): AgentType {
  const normalized = description.toLowerCase();

  if (
    /(course|class|seat|registration|register|enroll|waitlist)/.test(normalized)
  ) {
    return "reg";
  }

  if (/(scholarship|grant|fellowship|award|application essay)/.test(normalized)) {
    return "scholar";
  }

  return "custom";
}

function buildDefaultSchedule(templateType: AgentType): ScheduleConfig {
  if (templateType === "custom") {
    return {
      enabled: false,
      cron: "",
      timezone: DEFAULT_TIMEZONE,
    };
  }

  return {
    enabled: true,
    cron: "*/10 * * * *",
    timezone: DEFAULT_TIMEZONE,
    jitterMinutes: 2,
  };
}

function buildCategory(templateType: AgentType): string {
  if (templateType === "reg") {
    return "Course Registration";
  }

  if (templateType === "scholar") {
    return "Scholarships";
  }

  return "Custom Workflows";
}

function buildDefaultConfig(description: string, templateType: AgentType): ConfigEnvelope {
  const normalized = normalizeDescription(description);
  const schedule = buildDefaultSchedule(templateType);

  return {
    schemaVersion: "v1",
    inputSchema: {
      fields: [
        {
          key: "targetUrl",
          label: "Target URL",
          type: "url",
          required: true,
        },
        {
          key: "instructions",
          label: "Task Instructions",
          type: "textarea",
          required: true,
        },
      ],
    },
    defaultConfig: {
      targetUrl: "https://example.com",
      instructions: normalized,
      taskType: templateType,
    },
    defaultSchedule: schedule,
    currentConfig: {
      targetUrl: "https://example.com",
      instructions: normalized,
      taskType: templateType,
    },
  };
}

function buildTitle(description: string, templateType: AgentType): string {
  const normalized = normalizeDescription(description);
  const words = normalized.split(" ").slice(0, 5);
  const prefix = toTitleCase(words.join(" "));

  if (prefix.length > 0) {
    return `${prefix} Workflow`;
  }

  if (templateType === "reg") {
    return "Registration Watcher Workflow";
  }

  if (templateType === "scholar") {
    return "Scholarship Hunter Workflow";
  }

  return "Custom Automation Workflow";
}

function buildSteps(templateType: AgentType, description: string): JsonValue[] {
  const normalized = normalizeDescription(description);

  if (templateType === "reg") {
    return [
      {
        id: "open-target",
        action: "navigate",
        description: "Open the registration page",
      },
      {
        id: "check-seats",
        action: "extract",
        description: "Detect open seats and conflicts",
      },
      {
        id: "attempt-registration",
        action: "submit",
        description: "Attempt enrollment when availability is detected",
      },
    ];
  }

  if (templateType === "scholar") {
    return [
      {
        id: "open-target",
        action: "navigate",
        description: "Open the scholarship source",
      },
      {
        id: "scan-listings",
        action: "extract",
        description: "Capture new opportunities and compare against seen results",
      },
      {
        id: "notify",
        action: "notify",
        description: "Raise a notification when a new match is found",
      },
    ];
  }

  return [
    {
      id: "open-target",
      action: "navigate",
      description: "Open the primary target page",
    },
    {
      id: "evaluate-task",
      action: "evaluate",
      description: normalized,
    },
    {
      id: "complete-task",
      action: "submit",
      description: "Execute the requested automation with guardrails",
    },
  ];
}

function buildSpecObject(description: string, templateType: AgentType): JsonObject {
  const normalized = normalizeDescription(description);

  return {
    version: "v1",
    sourceAlias: "flowforge",
    prompt: normalized,
    templateType,
    category: buildCategory(templateType),
    safeguards: [
      "require structured config before deployment",
      "emit traceable logs for every runtime step",
      "pause on unrecoverable selector or auth failures",
    ],
    steps: buildSteps(templateType, normalized),
  };
}

export function buildWorkflowSpecResult(
  nlDescription: string
): FlowforgeWorkflowSpecResult {
  const templateType = inferTemplateType(nlDescription);
  const title = buildTitle(nlDescription, templateType);
  const spec = buildSpecObject(nlDescription, templateType);
  const draftPayload: TemplateDraftPayload = {
    title,
    description: normalizeDescription(nlDescription),
    category: buildCategory(templateType),
    templateType,
    visibility: "private",
    templateConfig: buildDefaultConfig(nlDescription, templateType),
  };

  return {
    sourceAlias: "flowforge",
    scenarioId: "flowforge_happy_path",
    templateType,
    title,
    summary: "Model-to-Agent Studio generated a workflow spec from natural language",
    spec,
    draftPayload,
  };
}

export function buildAgentScriptResult(spec: JsonValue): FlowforgeAgentScriptResult {
  const checksum = createHash("sha256")
    .update(JSON.stringify(spec))
    .digest("hex")
    .slice(0, 16);
  const script = [
    "// Generated by Model-to-Agent Studio (flowforge alias)",
    "export async function runWorkflow(page, context) {",
    "  const spec = " + JSON.stringify(spec, null, 2) + ";",
    "  context.log?.('studio.workflow.started', { spec });",
    "  return spec;",
    "}",
  ].join("\n");

  return {
    sourceAlias: "flowforge",
    scenarioId: "flowforge_happy_path",
    script,
    entrypoint: "runWorkflow",
    checksum,
    spec,
  };
}
