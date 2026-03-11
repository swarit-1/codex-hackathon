import type {
  AgentLogRecord,
  AgentRecord,
  IntramuralSignupRecord,
  MarketplaceTemplateRecord,
  PendingActionRecord,
  RegistrationMonitorRecord,
  ScholarshipRecord,
  ScheduledTaskRecord,
  TemplateSubmissionRecord,
} from "./types/contracts.ts";

interface RuntimeStore {
  agents: Map<string, AgentRecord>;
  marketplaceTemplates: Map<string, MarketplaceTemplateRecord>;
  templateSubmissions: Map<string, TemplateSubmissionRecord>;
  scholarships: Map<string, ScholarshipRecord>;
  registrationMonitors: Map<string, RegistrationMonitorRecord>;
  intramuralSignups: Map<string, IntramuralSignupRecord>;
  pendingActions: Map<string, PendingActionRecord>;
  agentLogs: Map<string, AgentLogRecord>;
  scheduledTasks: Map<string, ScheduledTaskRecord>;
  idCounters: Map<string, number>;
}

export const DEFAULT_USER_ID = "user_demo";
export const SCHOLARBOT_TEMPLATE_ID = "tpl_dev_scholarbot";
export const REGBOT_TEMPLATE_ID = "tpl_dev_regbot";
export const IMBOT_TEMPLATE_ID = "tpl_dev_imbot";
export const STUDENT_TEMPLATE_ID = "tpl_student_custom";

const store: RuntimeStore = {
  agents: new Map(),
  marketplaceTemplates: new Map(),
  templateSubmissions: new Map(),
  scholarships: new Map(),
  registrationMonitors: new Map(),
  intramuralSignups: new Map(),
  pendingActions: new Map(),
  agentLogs: new Map(),
  scheduledTasks: new Map(),
  idCounters: new Map(),
};

function nowIso(): string {
  return new Date().toISOString();
}

function seedTemplates(): void {
  const ts = nowIso();
  const baseTemplates: Record<string, unknown>[] = [
    {
      id: SCHOLARBOT_TEMPLATE_ID,
      title: "ScholarBot",
      description: "First-party scholarship discovery and application automation.",
      source: "dev",
      visibility: "public",
      category: "scholarships",
      installCount: 0,
      templateConfig: {
        sources: ["UT Scholarships", "FastWeb"],
        requireEssay: true,
        profile: {
          major: "CS",
          classification: "Undergraduate",
        },
      },
      agentType: "scholar",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: REGBOT_TEMPLATE_ID,
      title: "RegBot",
      description: "First-party class registration monitor and seat claim automation.",
      source: "dev",
      visibility: "public",
      category: "registration",
      installCount: 0,
      templateConfig: {
        semester: "Fall 2026",
        courseNumber: "CS 378",
        uniqueId: "12345",
        pollIntervalMinutes: 10,
        seatAvailableOnAttempt: 1,
        duoTimeoutAttempts: 0,
      },
      agentType: "reg",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: IMBOT_TEMPLATE_ID,
      title: "IMBot",
      description: "First-party intramural sports tracker and registration automation via IMLeagues.",
      source: "dev",
      visibility: "public",
      category: "intramurals",
      installCount: 0,
      templateConfig: {
        sports: ["Basketball", "Flag Football", "Soccer"],
        division: "C",
        role: "free_agent",
        preferredDays: ["Sunday", "Tuesday", "Thursday"],
        preferredTime: "evening",
      },
      agentType: "im",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: STUDENT_TEMPLATE_ID,
      title: "Student Workflow Example",
      description: "Student submitted template used to validate source restrictions.",
      source: "student",
      visibility: "public",
      category: "custom",
      installCount: 0,
      templateConfig: {
        dryRunOnly: true,
      },
      agentType: "custom",
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  for (const template of baseTemplates) {
    store.marketplaceTemplates.set(template.id as string, template as unknown as MarketplaceTemplateRecord);
  }
}

export function resetRuntimeStore(): void {
  store.agents.clear();
  store.marketplaceTemplates.clear();
  store.templateSubmissions.clear();
  store.scholarships.clear();
  store.registrationMonitors.clear();
  store.intramuralSignups.clear();
  store.pendingActions.clear();
  store.agentLogs.clear();
  store.scheduledTasks.clear();
  store.idCounters.clear();
  seedTemplates();
}

export function nextId(prefix: string): string {
  const current = store.idCounters.get(prefix) ?? 0;
  const next = current + 1;
  store.idCounters.set(prefix, next);
  return `${prefix}_${String(next).padStart(4, "0")}`;
}

export function getRuntimeStore(): RuntimeStore {
  return store;
}

resetRuntimeStore();
