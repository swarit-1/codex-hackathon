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
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

const MCP_DIRECTIVE_BLOCK = [
  "MCP REQUIREMENTS (MANDATORY):",
  "1. Use Context7 documentation lookup before executing technical actions; cite key sources in the final report.",
  "2. Use sequential-thinking style planning: produce a short multi-step plan, execute in order, and revise when blockers appear.",
  "3. Keep a concise execution trace of plan -> action -> result for each major step.",
].join("\n");

const ALLOWED_TEMPLATE_TYPES: AgentType[] = ["scholar", "reg", "eureka", "im", "custom"];

type FlowforgeStepAction = "navigate" | "extract" | "evaluate" | "submit" | "notify";

export interface FlowforgeMcpMeta extends JsonObject {
  useContext7: boolean;
  useSequentialThinking: boolean;
  context7QueryPlan: string;
  sequentialThinkingPlan: string;
}

export interface FlowforgeCompiledWorkflow {
  title: string;
  summary: string;
  templateType: AgentType;
  steps: string[];
  browserTaskPrompt: string;
  startUrl: string;
  mcpMeta: FlowforgeMcpMeta;
}

export interface FlowforgeCompileDependencies {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

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

function ensureHttpUrl(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`OpenAI compiler returned empty ${fieldName}.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`OpenAI compiler returned invalid ${fieldName}: ${trimmed}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`OpenAI compiler returned unsupported ${fieldName} protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}

function asRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`OpenAI compiler returned invalid ${fieldName}.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`OpenAI compiler returned invalid ${fieldName}.`);
  }
  return value.trim();
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`OpenAI compiler returned invalid ${fieldName}.`);
  }
  return value;
}

function sanitizeSteps(rawSteps: unknown): string[] {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    throw new Error("OpenAI compiler returned invalid steps.");
  }

  const steps = rawSteps
    .map((step) => (typeof step === "string" ? step.trim() : ""))
    .filter((step) => step.length > 0);

  if (steps.length === 0) {
    throw new Error("OpenAI compiler returned empty steps.");
  }

  return steps.slice(0, 12);
}

function ensureMcpMeta(raw: unknown): FlowforgeMcpMeta {
  const mcpRaw = asRecord(raw, "mcpMeta");
  return {
    useContext7: requireBoolean(mcpRaw.useContext7, "mcpMeta.useContext7"),
    useSequentialThinking: requireBoolean(mcpRaw.useSequentialThinking, "mcpMeta.useSequentialThinking"),
    context7QueryPlan: requireString(mcpRaw.context7QueryPlan, "mcpMeta.context7QueryPlan"),
    sequentialThinkingPlan: requireString(mcpRaw.sequentialThinkingPlan, "mcpMeta.sequentialThinkingPlan"),
  };
}

function normalizeTemplateType(value: unknown): AgentType {
  const templateType = requireString(value, "templateType").toLowerCase() as AgentType;
  if (!ALLOWED_TEMPLATE_TYPES.includes(templateType)) {
    throw new Error(`OpenAI compiler returned unsupported templateType: ${templateType}`);
  }
  return templateType;
}

function extractMessageContent(responsePayload: Record<string, unknown>): string {
  const choices = responsePayload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("OpenAI compiler returned no choices.");
  }

  const firstChoice = asRecord(choices[0], "choices[0]");
  const message = asRecord(firstChoice.message, "choices[0].message");
  const content = message.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }
        const record = part as Record<string, unknown>;
        return typeof record.text === "string" ? record.text : "";
      })
      .join("")
      .trim();

    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("OpenAI compiler returned empty message content.");
}

function parseCompilerOutput(content: string): FlowforgeCompiledWorkflow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI compiler returned malformed JSON.");
  }

  const payload = asRecord(parsed, "compiler payload");
  const templateType = normalizeTemplateType(payload.templateType);
  const browserTaskPrompt = requireString(payload.browserTaskPrompt, "browserTaskPrompt");
  const startUrl = ensureHttpUrl(requireString(payload.startUrl, "startUrl"), "startUrl");
  const mcpMeta = ensureMcpMeta(payload.mcpMeta);

  return {
    title: requireString(payload.title, "title"),
    summary: requireString(payload.summary, "summary"),
    templateType,
    steps: sanitizeSteps(payload.steps),
    browserTaskPrompt: ensurePromptHasMcpDirectives(browserTaskPrompt),
    startUrl,
    mcpMeta: {
      ...mcpMeta,
      useContext7: true,
      useSequentialThinking: true,
    },
  };
}

function inferActionFromStep(description: string): FlowforgeStepAction {
  const normalized = description.toLowerCase();

  if (/(open|navigate|visit|go to)/.test(normalized)) {
    return "navigate";
  }
  if (/(extract|collect|scan|read|check|analy|inspect)/.test(normalized)) {
    return "extract";
  }
  if (/(submit|apply|register|confirm|click)/.test(normalized)) {
    return "submit";
  }
  if (/(report|notify|send|summarize|output)/.test(normalized)) {
    return "notify";
  }
  return "evaluate";
}

function ensurePromptHasMcpDirectives(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.includes("MCP REQUIREMENTS (MANDATORY):")) {
    return trimmed;
  }
  return `${trimmed}\n\n${MCP_DIRECTIVE_BLOCK}`;
}

function buildStructuredSteps(stepDescriptions: string[]): JsonValue[] {
  return stepDescriptions.map((description, index) => ({
    id: `step-${index + 1}`,
    action: inferActionFromStep(description),
    description,
  }));
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

  if (templateType === "eureka") {
    return "Research Opportunities";
  }

  if (templateType === "im") {
    return "Intramural Sports";
  }

  return "Custom Workflows";
}

function buildDefaultConfig(
  description: string,
  templateType: AgentType,
  runtime: Pick<FlowforgeCompiledWorkflow, "browserTaskPrompt" | "startUrl" | "mcpMeta">
): ConfigEnvelope {
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
      targetUrl: runtime.startUrl,
      startUrl: runtime.startUrl,
      instructions: runtime.browserTaskPrompt,
      browserTaskPrompt: runtime.browserTaskPrompt,
      mcpMeta: runtime.mcpMeta,
      taskType: templateType,
      taskDescription: runtime.browserTaskPrompt,
      sourcePrompt: normalized,
    },
    defaultSchedule: schedule,
    currentConfig: {
      targetUrl: runtime.startUrl,
      startUrl: runtime.startUrl,
      instructions: runtime.browserTaskPrompt,
      browserTaskPrompt: runtime.browserTaskPrompt,
      mcpMeta: runtime.mcpMeta,
      taskType: templateType,
      taskDescription: runtime.browserTaskPrompt,
      sourcePrompt: normalized,
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

function buildSpecObject(
  description: string,
  templateType: AgentType,
  runtime: Pick<FlowforgeCompiledWorkflow, "browserTaskPrompt" | "startUrl" | "mcpMeta">,
  steps: string[]
): JsonObject {
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
    steps: buildStructuredSteps(steps.length > 0 ? steps : ["Open target page", "Evaluate task", "Report results"]),
    runtime: {
      browserTaskPrompt: runtime.browserTaskPrompt,
      startUrl: runtime.startUrl,
      mcpMeta: runtime.mcpMeta,
    },
  };
}

function buildHeuristicCompiledWorkflow(nlDescription: string): FlowforgeCompiledWorkflow {
  const templateType = inferTemplateType(nlDescription);
  const normalized = normalizeDescription(nlDescription);
  const title = buildTitle(normalized, templateType);
  const steps = buildSteps(templateType, normalized).map((step) => {
    const record = step as Record<string, unknown>;
    return typeof record.description === "string" ? record.description : "Complete workflow step";
  });

  return {
    title,
    summary: "Model-to-Agent Studio generated a workflow spec from natural language",
    templateType,
    steps,
    browserTaskPrompt: ensurePromptHasMcpDirectives(
      `Navigate to https://example.com and execute this workflow: ${normalized}`
    ),
    startUrl: "https://example.com",
    mcpMeta: {
      useContext7: true,
      useSequentialThinking: true,
      context7QueryPlan: "Collect official documentation relevant to the workflow before execution.",
      sequentialThinkingPlan: "Create a short step-by-step execution plan and revise after each major action.",
    },
  };
}

export async function compileWorkflowSpecWithOpenAI(
  nlDescription: string,
  deps: FlowforgeCompileDependencies = {}
): Promise<FlowforgeCompiledWorkflow> {
  const description = normalizeDescription(nlDescription);
  if (!description) {
    throw new Error("nlDescription is required");
  }

  const apiKey = (deps.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Studio workflow generation.");
  }

  const model = (deps.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL).trim();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: [
            "You are the Model-to-Agent Studio prompt compiler.",
            "Convert user intent into a deterministic Browser Use task payload.",
            "Always produce valid JSON that matches the provided schema.",
            "Do not include credentials in browserTaskPrompt.",
            "browserTaskPrompt must include explicit safety guardrails to avoid irreversible submission actions unless explicitly requested.",
          ].join(" "),
        },
        {
          role: "user",
          content: description,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "studio_workflow_prompt_compiler",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "summary",
              "templateType",
              "steps",
              "browserTaskPrompt",
              "startUrl",
              "mcpMeta",
            ],
            properties: {
              title: { type: "string", minLength: 3 },
              summary: { type: "string", minLength: 10 },
              templateType: {
                type: "string",
                enum: ALLOWED_TEMPLATE_TYPES,
              },
              steps: {
                type: "array",
                minItems: 1,
                maxItems: 12,
                items: { type: "string", minLength: 3 },
              },
              browserTaskPrompt: { type: "string", minLength: 20 },
              startUrl: { type: "string", minLength: 8 },
              mcpMeta: {
                type: "object",
                additionalProperties: false,
                required: [
                  "useContext7",
                  "useSequentialThinking",
                  "context7QueryPlan",
                  "sequentialThinkingPlan",
                ],
                properties: {
                  useContext7: { type: "boolean" },
                  useSequentialThinking: { type: "boolean" },
                  context7QueryPlan: { type: "string", minLength: 8 },
                  sequentialThinkingPlan: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI prompt compiler error (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const messageContent = extractMessageContent(payload);
  return parseCompilerOutput(messageContent);
}

export function buildWorkflowSpecResultFromCompiled(
  nlDescription: string,
  compiled: FlowforgeCompiledWorkflow
): FlowforgeWorkflowSpecResult {
  const normalizedDescription = normalizeDescription(nlDescription);
  const templateType = compiled.templateType;
  const title = compiled.title.trim();
  const runtime = {
    browserTaskPrompt: ensurePromptHasMcpDirectives(compiled.browserTaskPrompt),
    startUrl: ensureHttpUrl(compiled.startUrl, "startUrl"),
    mcpMeta: {
      ...compiled.mcpMeta,
      useContext7: true,
      useSequentialThinking: true,
    },
  };
  const spec = buildSpecObject(normalizedDescription, templateType, runtime, compiled.steps);
  const draftPayload: TemplateDraftPayload = {
    title,
    description: normalizedDescription,
    category: buildCategory(templateType),
    templateType,
    visibility: "private",
    templateConfig: buildDefaultConfig(normalizedDescription, templateType, runtime),
  };

  return {
    sourceAlias: "flowforge",
    scenarioId: "flowforge_happy_path",
    templateType,
    title,
    summary: compiled.summary.trim(),
    spec,
    draftPayload,
  };
}

export function buildWorkflowSpecResult(nlDescription: string): FlowforgeWorkflowSpecResult {
  return buildWorkflowSpecResultFromCompiled(
    nlDescription,
    buildHeuristicCompiledWorkflow(nlDescription)
  );
}

export async function buildWorkflowSpecResultWithOpenAI(
  nlDescription: string,
  deps: FlowforgeCompileDependencies = {}
): Promise<FlowforgeWorkflowSpecResult> {
  const compiled = await compileWorkflowSpecWithOpenAI(nlDescription, deps);
  return buildWorkflowSpecResultFromCompiled(nlDescription, compiled);
}

export function buildAgentScriptResult(spec: JsonValue): FlowforgeAgentScriptResult {
  // Simple FNV-1a-style hash (no Node.js crypto needed in Convex runtime)
  const raw = JSON.stringify(spec);
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const checksum = (h >>> 0).toString(16).padStart(8, "0").repeat(2).slice(0, 16);
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
