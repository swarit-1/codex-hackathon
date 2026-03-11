import type {
  AgentLogRecord,
  AgentRecord,
  LabOpeningRecord,
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
  labOpenings: Map<string, LabOpeningRecord>;
  registrationMonitors: Map<string, RegistrationMonitorRecord>;
  pendingActions: Map<string, PendingActionRecord>;
  agentLogs: Map<string, AgentLogRecord>;
  scheduledTasks: Map<string, ScheduledTaskRecord>;
  idCounters: Map<string, number>;
}

export const DEFAULT_USER_ID = "user_demo";
export const SCHOLARBOT_TEMPLATE_ID = "tpl_dev_scholarbot";
export const REGBOT_TEMPLATE_ID = "tpl_dev_regbot";
export const EUREKABOT_TEMPLATE_ID = "tpl_dev_eurekabot";
export const STUDENT_TEMPLATE_ID = "tpl_student_custom";

const store: RuntimeStore = {
  agents: new Map(),
  marketplaceTemplates: new Map(),
  templateSubmissions: new Map(),
  scholarships: new Map(),
  labOpenings: new Map(),
  registrationMonitors: new Map(),
  pendingActions: new Map(),
  agentLogs: new Map(),
  scheduledTasks: new Map(),
  idCounters: new Map(),
};

function nowIso(): string {
  return new Date().toISOString();
}

function seedTemplates(): void {
  const ts = Date.now();
  const baseTemplates: MarketplaceTemplateRecord[] = [
    {
      id: SCHOLARBOT_TEMPLATE_ID,
      title: "ScholarBot",
      description: "First-party scholarship discovery and application automation.",
      source: "dev",
      visibility: "public",
      category: "scholarships",
      installCount: 0,
      templateConfig: {
        schemaVersion: "v1",
        inputSchema: {
          fields: [
            { key: "sources", label: "Scholarship Sources", type: "multiselect" },
            { key: "profile", label: "Student Profile", type: "object" },
          ],
        },
        defaultConfig: {
          sources: ["UT Scholarships", "FastWeb"],
          requireEssay: true,
          profile: {
            major: "CS",
            classification: "Undergraduate",
          },
        },
        currentConfig: {
          sources: ["UT Scholarships", "FastWeb"],
          requireEssay: true,
          profile: {
            major: "CS",
            classification: "Undergraduate",
          },
        },
        defaultSchedule: {
          enabled: true,
          cron: "0 8 * * *",
          timezone: "America/Chicago",
        },
      },
      templateType: "scholar",
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
        schemaVersion: "v1",
        inputSchema: {
          fields: [
            { key: "semester", label: "Semester", type: "text" },
            { key: "watchList", label: "Watched Sections", type: "array" },
            { key: "autoRegister", label: "Auto-register", type: "boolean" },
          ],
        },
        defaultConfig: {
          semester: "Fall 2026",
          autoRegister: true,
          pollIntervalMinutes: 10,
          duoTimeoutAttempts: 0,
          watchList: [
            {
              courseNumber: "CS 378",
              uniqueId: "12345",
              semester: "Fall 2026",
              autoRegister: true,
              seatAvailableOnAttempt: 1,
            },
          ],
        },
        currentConfig: {
          semester: "Fall 2026",
          autoRegister: true,
          pollIntervalMinutes: 10,
          duoTimeoutAttempts: 0,
          watchList: [
            {
              courseNumber: "CS 378",
              uniqueId: "12345",
              semester: "Fall 2026",
              autoRegister: true,
              seatAvailableOnAttempt: 1,
            },
          ],
        },
        defaultSchedule: {
          enabled: true,
          cron: "*/10 * * * *",
          timezone: "America/Chicago",
          jitterMinutes: 2,
        },
      },
      templateType: "reg",
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: EUREKABOT_TEMPLATE_ID,
      title: "EurekaBot",
      description: "Scan UT Eureka for research lab openings, match to your profile, and draft outreach emails to professors.",
      source: "dev",
      visibility: "public",
      category: "research",
      installCount: 0,
      templateConfig: {
        schemaVersion: "v1",
        inputSchema: {
          fields: [
            { key: "sources", label: "Lab Listing Sources", type: "multiselect" },
            { key: "profile", label: "Student Profile", type: "object" },
          ],
        },
        defaultConfig: {
          sources: ["Eureka", "UT Research Portal"],
          profile: {
            name: "UT Student",
            major: "Computer Science",
            classification: "Undergraduate",
            gpa: "3.8",
            researchInterests: ["machine learning", "systems"],
            relevantCourses: ["CS 429 Computer Organization", "CS 439 Operating Systems", "CS 378 Machine Learning"],
            skills: ["Python", "PyTorch", "C++", "Linux"],
          },
        },
        currentConfig: {
          sources: ["Eureka", "UT Research Portal"],
          profile: {
            name: "UT Student",
            major: "Computer Science",
            classification: "Undergraduate",
            gpa: "3.8",
            researchInterests: ["machine learning", "systems"],
            relevantCourses: ["CS 429 Computer Organization", "CS 439 Operating Systems", "CS 378 Machine Learning"],
            skills: ["Python", "PyTorch", "C++", "Linux"],
          },
        },
        defaultSchedule: {
          enabled: true,
          cron: "0 9 * * 1,3,5",
          timezone: "America/Chicago",
          jitterMinutes: 10,
        },
      },
      templateType: "eureka",
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
        schemaVersion: "v1",
        inputSchema: {
          fields: [],
        },
        defaultConfig: {
          dryRunOnly: true,
        },
        currentConfig: {
          dryRunOnly: true,
        },
        defaultSchedule: {
          enabled: false,
          cron: "",
          timezone: "America/Chicago",
        },
      },
      templateType: "custom",
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  for (const template of baseTemplates) {
    store.marketplaceTemplates.set(template.id, template);
  }
}

export function resetRuntimeStore(): void {
  store.agents.clear();
  store.marketplaceTemplates.clear();
  store.templateSubmissions.clear();
  store.scholarships.clear();
  store.labOpenings.clear();
  store.registrationMonitors.clear();
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
