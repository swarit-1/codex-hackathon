import { mutation } from "./_generated/server";
import { buildAgentScriptResult, buildWorkflowSpecResult } from "./lib/flowforge";
import { insertDoc, queryAll, queryByIndex } from "./lib/db";
import { appendAgentLog } from "./lib/logging";
import { toAgentRecord, toMarketplaceTemplateRecord, toUserProfileRecord } from "./lib/records";
import { demoBootstrapCatalogArgs } from "./lib/validators";
import type {
  AgentRecord,
  ConfigEnvelope,
  CustomWorkflowRecord,
  MarketplaceTemplateRecord,
  PendingActionRecord,
  ScholarshipRecord,
  UserProfileRecord,
} from "./types/contracts";

const NOW = Date.parse("2026-03-11T00:00:00.000Z");

type DemoTemplateSeed = {
  title: string;
  description: string;
  source: MarketplaceTemplateRecord["source"];
  category: string;
  visibility: MarketplaceTemplateRecord["visibility"];
  templateType: MarketplaceTemplateRecord["templateType"];
  installCount: number;
  cadenceLabel: string;
  setupFields: string[];
  outcomes: string[];
  defaultSchedule?: MarketplaceTemplateRecord["templateConfig"]["defaultSchedule"];
  approvedAt?: number;
};

const demoTemplates: DemoTemplateSeed[] = [
  {
    title: "RegBot",
    description:
      "Monitors course seats, watches for conflicts, and carries the fastest registration path when availability opens.",
    source: "dev",
    category: "Registration",
    visibility: "public",
    templateType: "reg",
    installCount: 481,
    cadenceLabel: "Every 10 minutes with retry jitter",
    setupFields: ["EID login", "Course unique numbers", "Preferred semester", "Conflict policy"],
    outcomes: ["Seat monitoring", "Conflict confirmation", "Duo retry handling"],
    defaultSchedule: {
      enabled: true,
      cron: "*/10 * * * *",
      timezone: "America/Chicago",
      jitterMinutes: 2,
    },
    approvedAt: NOW - 1000 * 60 * 60 * 24 * 60,
  },
  {
    title: "ScholarBot",
    description:
      "Finds scholarships across UT sources, scores fit, drafts form progress, and pauses only when a student needs to step in.",
    source: "dev",
    category: "Scholarships",
    visibility: "public",
    templateType: "scholar",
    installCount: 526,
    cadenceLabel: "Nightly scan with deadline escalation",
    setupFields: [
      "Student profile",
      "Scholarship sources",
      "Resume and essay notes",
      "Notification method",
    ],
    outcomes: ["Opportunity matching", "Application checkpointing", "Missing-field handoff"],
    defaultSchedule: {
      enabled: true,
      cron: "30 23 * * *",
      timezone: "America/Chicago",
      jitterMinutes: 15,
    },
    approvedAt: NOW - 1000 * 60 * 60 * 24 * 55,
  },
  {
    title: "Financial Aid Audit",
    description:
      "Tracks aid portal changes, missing documents, and deadline movement for students managing multiple aid workflows.",
    source: "student",
    category: "Campus admin",
    visibility: "public",
    templateType: "custom",
    installCount: 119,
    cadenceLabel: "Daily check-in every weekday",
    setupFields: ["Portal credentials", "Aid checklist targets", "Escalation preference"],
    outcomes: ["Document reminders", "Status snapshots", "Missing-item summary"],
    defaultSchedule: {
      enabled: true,
      cron: "0 8 * * 1-5",
      timezone: "America/Chicago",
    },
    approvedAt: NOW - 1000 * 60 * 60 * 24 * 21,
  },
  {
    title: "Lab Openings Watch",
    description:
      "Checks faculty lab pages and interest forms for openings, then posts a digest of relevant matches for undergrad researchers.",
    source: "student",
    category: "Research",
    visibility: "public",
    templateType: "custom",
    installCount: 74,
    cadenceLabel: "Three scans per week",
    setupFields: ["Research interests", "Department targets", "Faculty list"],
    outcomes: ["Lab opening detection", "Match digest", "Saved faculty notes"],
    defaultSchedule: {
      enabled: true,
      cron: "0 7 * * 1,3,5",
      timezone: "America/Chicago",
    },
    approvedAt: NOW - 1000 * 60 * 60 * 24 * 12,
  },
  {
    title: "Conference Travel Fund Tracker",
    description:
      "Follows college and department travel funding pages, compares windows, and flags submission requirements before deadlines.",
    source: "student",
    category: "Scholarships",
    visibility: "public",
    templateType: "custom",
    installCount: 53,
    cadenceLabel: "Weekly scan",
    setupFields: ["College", "Degree program", "Conference timeline"],
    outcomes: ["Deadline monitoring", "Requirement comparison", "Reminder queue"],
    defaultSchedule: {
      enabled: true,
      cron: "0 9 * * 1",
      timezone: "America/Chicago",
    },
  },
];

function buildTemplateConfig(seed: DemoTemplateSeed): ConfigEnvelope {
  return {
    schemaVersion: "v1",
    inputSchema: {
      fields: seed.setupFields.map((field, index) => ({
        key: `field_${index + 1}`,
        label: field,
        type: index === 0 ? "text" : "textarea",
        required: true,
      })),
    },
    defaultConfig: {
      cadenceLabel: seed.cadenceLabel,
      outcomes: seed.outcomes,
      title: seed.title,
    },
    defaultSchedule: seed.defaultSchedule,
    currentConfig: {
      cadenceLabel: seed.cadenceLabel,
      outcomes: seed.outcomes,
      title: seed.title,
    },
  };
}

async function ensureDemoUser(ctx: any): Promise<UserProfileRecord> {
  const existingUsers = await queryByIndex<Omit<UserProfileRecord, "id">>(ctx, "users", "by_email", [
    ["email", "jordan.longhorn@example.edu"],
  ]);

  if (existingUsers[0]) {
    return toUserProfileRecord(existingUsers[0] as any);
  }

  const id = await insertDoc(ctx, "users", {
    name: "Jordan Lee",
    email: "jordan.longhorn@example.edu",
    eid: "jl49283",
    authMethod: "demo",
    profileData: {
      major: "Computer Science",
      classification: "Junior",
      scholarshipInterests: ["Engineering", "Research", "Travel funding"],
      notifications: "Email and in-app",
    },
    createdAt: NOW - 1000 * 60 * 60 * 24 * 120,
    updatedAt: NOW - 1000 * 60 * 60 * 8,
  });

  return {
    id,
    name: "Jordan Lee",
    email: "jordan.longhorn@example.edu",
    eid: "jl49283",
    authMethod: "demo",
    profileData: {
      major: "Computer Science",
      classification: "Junior",
      scholarshipInterests: ["Engineering", "Research", "Travel funding"],
      notifications: "Email and in-app",
    },
    createdAt: NOW - 1000 * 60 * 60 * 24 * 120,
    updatedAt: NOW - 1000 * 60 * 60 * 8,
  };
}

async function ensureTemplates(
  ctx: any,
  ownerUserId?: string
): Promise<Record<string, MarketplaceTemplateRecord>> {
  const existingTemplates = await queryAll<Omit<MarketplaceTemplateRecord, "id">>(ctx, "marketplaceTemplates");
  const byTitle = new Map(
    existingTemplates.map((template) => [String((template as any).title), toMarketplaceTemplateRecord(template as any)])
  );

  const templates: Record<string, MarketplaceTemplateRecord> = {};

  for (const seed of demoTemplates) {
    const existing = byTitle.get(seed.title);

    if (existing) {
      templates[seed.title] = existing;
      continue;
    }

    const id = await insertDoc(ctx, "marketplaceTemplates", {
      title: seed.title,
      description: seed.description,
      source: seed.source,
      category: seed.category,
      visibility: seed.visibility,
      templateType: seed.templateType,
      installCount: seed.installCount,
      ownerUserId: seed.source === "student" ? ownerUserId : undefined,
      templateConfig: buildTemplateConfig(seed),
      createdAt: NOW - 1000 * 60 * 60 * 24 * 45,
      updatedAt: NOW - 1000 * 60 * 60,
      approvedAt: seed.approvedAt,
      archivedAt: undefined,
    });

    templates[seed.title] = {
      id,
      title: seed.title,
      description: seed.description,
      source: seed.source,
      category: seed.category,
      visibility: seed.visibility,
      templateType: seed.templateType,
      installCount: seed.installCount,
      ownerUserId: seed.source === "student" ? ownerUserId : undefined,
      templateConfig: buildTemplateConfig(seed),
      createdAt: NOW - 1000 * 60 * 60 * 24 * 45,
      updatedAt: NOW - 1000 * 60 * 60,
      approvedAt: seed.approvedAt,
      archivedAt: undefined,
    };
  }

  return templates;
}

async function ensureAgents(
  ctx: any,
  userId: string,
  templates: Record<string, MarketplaceTemplateRecord>
): Promise<Record<string, AgentRecord>> {
  const existingAgents = await queryByIndex<Omit<AgentRecord, "id">>(ctx, "agents", "by_userId", [["userId", userId]]);
  const byTemplateId = new Map(
    existingAgents.map((agent) => [String((agent as any).templateId), toAgentRecord(agent as any)])
  );

  const seeds = [
    {
      templateTitle: "ScholarBot",
      status: "active" as const,
      lastRunStatus: "succeeded" as const,
      lastRunAt: NOW - 1000 * 60 * 18,
      nextRunAt: NOW + 1000 * 60 * 60 * 11,
    },
    {
      templateTitle: "RegBot",
      status: "paused" as const,
      lastRunStatus: "failed" as const,
      lastRunAt: NOW - 1000 * 60 * 60 * 4,
      nextRunAt: undefined,
    },
    {
      templateTitle: "Lab Openings Watch",
      status: "completed" as const,
      lastRunStatus: "succeeded" as const,
      lastRunAt: NOW - 1000 * 60 * 60 * 26,
      nextRunAt: NOW + 1000 * 60 * 60 * 31,
    },
    {
      templateTitle: "Financial Aid Audit",
      status: "error" as const,
      lastRunStatus: "failed" as const,
      lastRunAt: NOW - 1000 * 60 * 60 * 17,
      nextRunAt: NOW + 1000 * 60 * 45,
    },
  ];

  const agents: Record<string, AgentRecord> = {};

  for (const seed of seeds) {
    const template = templates[seed.templateTitle];
    const existing = byTemplateId.get(template.id);

    if (existing) {
      agents[seed.templateTitle] = existing;
      continue;
    }

    const id = await insertDoc(ctx, "agents", {
      userId,
      templateId: template.id,
      ownerType: template.source === "dev" ? "first_party" : "student",
      type: template.templateType,
      status: seed.status,
      config: template.templateConfig,
      schedule:
        template.templateConfig.defaultSchedule ?? {
          enabled: false,
          cron: "",
          timezone: "America/Chicago",
        },
      lastRunStatus: seed.lastRunStatus,
      lastRunAt: seed.lastRunAt,
      nextRunAt: seed.nextRunAt,
      browserUseTaskId: seed.templateTitle === "RegBot" ? "browser-use-regbot" : undefined,
      createdAt: NOW - 1000 * 60 * 60 * 24 * 14,
      updatedAt: NOW - 1000 * 60 * 60,
    });

    agents[seed.templateTitle] = {
      id,
      userId,
      templateId: template.id,
      ownerType: template.source === "dev" ? "first_party" : "student",
      type: template.templateType,
      status: seed.status,
      config: template.templateConfig,
      schedule:
        template.templateConfig.defaultSchedule ?? {
          enabled: false,
          cron: "",
          timezone: "America/Chicago",
        },
      lastRunStatus: seed.lastRunStatus,
      lastRunAt: seed.lastRunAt,
      nextRunAt: seed.nextRunAt,
      browserUseTaskId: seed.templateTitle === "RegBot" ? "browser-use-regbot" : undefined,
      createdAt: NOW - 1000 * 60 * 60 * 24 * 14,
      updatedAt: NOW - 1000 * 60 * 60,
    };
  }

  return agents;
}

async function ensurePendingActions(ctx: any, userId: string, agents: Record<string, AgentRecord>): Promise<void> {
  const existing = await queryByIndex<Omit<PendingActionRecord, "id">>(
    ctx,
    "pendingActions",
    "by_userId",
    [["userId", userId]]
  );

  if (existing.length > 0) {
    return;
  }

  await insertDoc(ctx, "pendingActions", {
    userId,
    agentId: agents["ScholarBot"].id,
    type: "essay",
    prompt: "Review the response draft for Engineering Honors Scholarship.",
    createdAt: NOW - 1000 * 60 * 28,
  });

  await insertDoc(ctx, "pendingActions", {
    userId,
    agentId: agents["ScholarBot"].id,
    type: "essay",
    prompt: "Confirm the travel funding personal statement before submission.",
    createdAt: NOW - 1000 * 60 * 52,
  });

  await insertDoc(ctx, "pendingActions", {
    userId,
    agentId: agents["Financial Aid Audit"].id,
    type: "detail",
    prompt: "Update the aid portal password in the credential vault.",
    createdAt: NOW - 1000 * 60 * 75,
  });
}

async function ensureScholarships(ctx: any, userId: string, agentId: string): Promise<void> {
  const existing = await queryByIndex<Omit<ScholarshipRecord, "id">>(ctx, "scholarships", "by_userId", [["userId", userId]]);

  if (existing.length > 0) {
    return;
  }

  const seeds = [
    {
      title: "Engineering Honors Scholarship",
      source: "UT Engineering",
      deadline: NOW + 1000 * 60 * 60 * 24 * 18,
      matchScore: 0.92,
      status: "found" as const,
    },
    {
      title: "Travel Grant for CS Research",
      source: "UT Research Office",
      deadline: NOW + 1000 * 60 * 60 * 24 * 32,
      matchScore: 0.81,
      status: "applying" as const,
    },
    {
      title: "Longhorn Leadership Award",
      source: "Student Affairs",
      deadline: NOW + 1000 * 60 * 60 * 24 * 6,
      matchScore: 0.75,
      status: "paused" as const,
    },
  ];

  for (const seed of seeds) {
    await insertDoc(ctx, "scholarships", {
      userId,
      agentId,
      title: seed.title,
      source: seed.source,
      deadline: seed.deadline,
      eligibility: {
        major: "Computer Science",
      },
      matchScore: seed.matchScore,
      status: seed.status,
      missingFields: seed.status === "paused" ? ["Personal statement"] : undefined,
      createdAt: NOW - 1000 * 60 * 60 * 24 * 4,
      updatedAt: NOW - 1000 * 60 * 25,
    });
  }
}

async function ensureRegistrationMonitors(ctx: any, userId: string, agentId: string): Promise<void> {
  const existing = await queryByIndex<Record<string, unknown>>(ctx, "registrationMonitors", "by_userId", [["userId", userId]]);

  if (existing.length > 0) {
    return;
  }

  await insertDoc(ctx, "registrationMonitors", {
    userId,
    agentId,
    courseNumber: "CS 429",
    uniqueId: "51230",
    semester: "Fall 2026",
    status: "watching",
    pollInterval: 10,
    createdAt: NOW - 1000 * 60 * 60 * 24 * 3,
    updatedAt: NOW - 1000 * 60 * 20,
  });
}

async function ensureWorkflows(ctx: any, userId: string): Promise<Array<CustomWorkflowRecord>> {
  const existing = await queryByIndex<Omit<CustomWorkflowRecord, "id">>(
    ctx,
    "customWorkflows",
    "by_userId",
    [["userId", userId]]
  );

  if (existing.length > 0) {
    return existing.map((workflow) => ({
      id: String((workflow as any)._id),
      ...workflow,
    })) as Array<CustomWorkflowRecord>;
  }

  const prompts = [
    "Watch UT scholarship and department pages for new funding opportunities, compare them to my profile, and prepare a weekly digest with anything that needs human review.",
    "Check UT advising and department sites for newly released appointment windows, summarize the openings, and draft the booking steps I need to take next.",
  ];

  const workflows: Array<CustomWorkflowRecord> = [];

  for (const prompt of prompts) {
    const specResult = buildWorkflowSpecResult(prompt);
    const scriptResult = buildAgentScriptResult(specResult.spec);
    const id = await insertDoc(ctx, "customWorkflows", {
      userId,
      sourceAlias: "flowforge",
      prompt,
      spec: specResult as any,
      generatedScript: scriptResult.script,
      createdAt: NOW - 1000 * 60 * 60 * 6,
      updatedAt: NOW - 1000 * 60 * 40,
    });

    workflows.push({
      id,
      userId,
      sourceAlias: "flowforge",
      prompt,
      spec: specResult as any,
      generatedScript: scriptResult.script,
      createdAt: NOW - 1000 * 60 * 60 * 6,
      updatedAt: NOW - 1000 * 60 * 40,
    });
  }

  return workflows;
}

async function ensureAgentLogs(ctx: any, agents: Record<string, AgentRecord>): Promise<void> {
  const existingLogs = await queryAll<Record<string, unknown>>(ctx, "agentLogs");

  if (existingLogs.length > 0) {
    return;
  }

  await appendAgentLog(ctx, {
    agentId: agents["ScholarBot"].id,
    event: "scholarship.match.found",
    details: {
      title: "Matched new opportunity",
      detail: "Found Engineering Honors Scholarship and saved the deadline packet.",
    },
    timestamp: NOW - 1000 * 60 * 18,
  });

  await appendAgentLog(ctx, {
    agentId: agents["RegBot"].id,
    event: "registration.duo.timeout",
    level: "warning",
    details: {
      title: "Paused on Duo retry",
      detail: "Registration attempt stopped after authentication timed out. Resume keeps current monitor state.",
    },
    scenarioId: "regbot_duo_timeout",
    timestamp: NOW - 1000 * 60 * 60 * 4,
  });

  await appendAgentLog(ctx, {
    agentId: agents["Financial Aid Audit"].id,
    event: "agent.selector.changed",
    level: "error",
    details: {
      title: "Layout changed",
      detail: "Aid checklist selector no longer matched. Screenshot captured for review.",
    },
    timestamp: NOW - 1000 * 60 * 60 * 17,
  });
}

export const bootstrapCatalog = mutation({
  args: demoBootstrapCatalogArgs,
  handler: async (ctx) => {
    const templates = await ensureTemplates(ctx);

    return {
      templateCount: Object.keys(templates).length,
    };
  },
});

export const bootstrapWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ensureDemoUser(ctx);
    const templates = await ensureTemplates(ctx, user.id);
    const agents = await ensureAgents(ctx, user.id, templates);

    await Promise.all([
      ensurePendingActions(ctx, user.id, agents),
      ensureScholarships(ctx, user.id, agents["ScholarBot"].id),
      ensureRegistrationMonitors(ctx, user.id, agents["RegBot"].id),
      ensureWorkflows(ctx, user.id),
      ensureAgentLogs(ctx, agents),
    ]);

    return {
      user,
      counts: {
        templates: Object.keys(templates).length,
        agents: Object.keys(agents).length,
      },
    };
  },
});
