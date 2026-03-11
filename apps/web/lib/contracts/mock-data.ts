import type {
  Agent,
  AgentEvent,
  ConfigEnvelope,
  FilterOption,
  MarketplaceTemplate,
  SettingsSection,
  StudioDraft,
} from "./types";

function createMockTemplateConfig(
  cadenceLabel: string,
  outcomes: string[],
  setupFields: string[]
): ConfigEnvelope {
  return {
    schemaVersion: "1.0.0",
    inputSchema: {
      fields: setupFields.map((field, index) => ({
        key: `field_${index + 1}`,
        label: field,
        type: "text",
      })),
    } as ConfigEnvelope["inputSchema"],
    defaultConfig: {
      cadenceLabel,
      outcomes,
    },
    currentConfig: {
      cadenceLabel,
      outcomes,
    },
    defaultSchedule: {
      enabled: true,
      cron: "0 9 * * *",
      timezone: "America/Chicago",
    },
  };
}

const semesterOptions = [
  "Fall 2025",
  "Spring 2026",
  "Summer 2026",
  "Fall 2026",
  "Spring 2027",
  "Summer 2027",
  "Fall 2027",
];

function createRegBotTemplateConfig(
  cadenceLabel: string,
  outcomes: string[]
): ConfigEnvelope {
  return {
    schemaVersion: "1.0.0",
    inputSchema: {
      fields: [
        {
          key: "courseNumber",
          label: "Course number",
          type: "text",
          required: true,
        },
        {
          key: "eidLogin",
          label: "EID login",
          type: "text",
          required: true,
        },
        {
          key: "eidPassword",
          label: "UT password",
          type: "password",
          required: false,
          description: "Optional. Leave blank if you only want seat checks that do not require login.",
        },
        {
          key: "uniqueId",
          label: "Course Unique Id",
          type: "text",
          required: true,
          uiWidth: "compact",
        },
        {
          key: "semester",
          label: "Preferred semester",
          type: "select",
          required: true,
          options: semesterOptions.map((option) => ({
            label: option,
            value: option,
          })),
        },
        {
          key: "conflictPolicy",
          label: "Conflict policy",
          type: "textarea",
          required: true,
        },
        {
          key: "watchlistCourses",
          label: "Additional watchlist courses",
          type: "textarea",
          required: false,
          description: "One per line: Course Number | Unique ID | Semester",
        },
      ],
    } as ConfigEnvelope["inputSchema"],
    defaultConfig: {
      cadenceLabel,
      outcomes,
      courseNumber: "",
      eidLogin: "",
      eidPassword: "",
      uniqueId: "",
      semester: "Fall 2026",
      conflictPolicy: "",
      watchlistCourses: "",
    },
    currentConfig: {
      cadenceLabel,
      outcomes,
      courseNumber: "",
      eidLogin: "",
      eidPassword: "",
      uniqueId: "",
      semester: "Fall 2026",
      conflictPolicy: "",
      watchlistCourses: "",
    },
    defaultSchedule: {
      enabled: true,
      cron: "0 9 * * *",
      timezone: "America/Chicago",
    },
  };
}

export const marketplaceCategories: FilterOption[] = [
  { label: "All categories", value: "all" },
  { label: "Registration", value: "registration" },
  { label: "Scholarships", value: "scholarships" },
  { label: "Campus admin", value: "campus-admin" },
  { label: "Research", value: "research" },
  { label: "Campus life", value: "campus-life" },
];

export const marketplaceTemplates: MarketplaceTemplate[] = [
  {
    id: "regbot",
    title: "RegBot",
    description:
      "Monitors course seats, watches for conflicts, and carries the fastest registration path when availability opens.",
    source: "dev",
    category: "Registration",
    installs: 481,
    trustLabel: "LonghorNet official",
    visibility: "public",
    status: "ready",
    scheduleDefault: "Every 10 minutes with retry jitter",
    setupFields: [
      "Course number",
      "EID login",
      "UT password",
      "Course Unique Id",
      "Preferred semester",
      "Conflict policy",
      "Additional watchlist courses",
    ],
    outcomes: ["Seat monitoring", "Conflict confirmation", "Duo retry handling"],
    templateConfig: createRegBotTemplateConfig(
      "Every 10 minutes with retry jitter",
      ["Seat monitoring", "Conflict confirmation", "Duo retry handling"]
    ),
    imageSrc: "/workflows/regbot.svg",
    iconKey: "registration",
    iconGlyph: "RG",
  },
  {
    id: "scholarbot",
    title: "ScholarBot",
    description:
      "Finds scholarships across UT sources, scores fit, drafts form progress, and pauses only when a student needs to step in.",
    source: "dev",
    category: "Scholarships",
    installs: 526,
    trustLabel: "LonghorNet official",
    visibility: "public",
    status: "ready",
    scheduleDefault: "Nightly scan with deadline escalation",
    setupFields: ["Student profile", "Scholarship sources", "Resume and essay notes", "Notification method"],
    outcomes: ["Opportunity matching", "Application checkpointing", "Missing-field handoff"],
    templateConfig: createMockTemplateConfig(
      "Nightly scan with deadline escalation",
      ["Opportunity matching", "Application checkpointing", "Missing-field handoff"],
      ["Student profile", "Scholarship sources", "Resume and essay notes", "Notification method"]
    ),
    imageSrc: "/workflows/scholarbot.svg",
    iconKey: "scholarship",
    iconGlyph: "SC",
  },
  {
    id: "financial-aid-audit",
    title: "Financial Aid Audit",
    description:
      "Tracks aid portal changes, missing documents, and deadline movement for students managing multiple aid workflows.",
    source: "student",
    category: "Campus admin",
    installs: 119,
    trustLabel: "Reviewed student workflow",
    visibility: "public",
    status: "approved",
    scheduleDefault: "Daily check-in every weekday",
    setupFields: ["Portal credentials", "Aid checklist targets", "Escalation preference"],
    outcomes: ["Document reminders", "Status snapshots", "Missing-item summary"],
    templateConfig: createMockTemplateConfig(
      "Daily check-in every weekday",
      ["Document reminders", "Status snapshots", "Missing-item summary"],
      ["Portal credentials", "Aid checklist targets", "Escalation preference"]
    ),
    imageSrc: "/workflows/financial-aid-audit.svg",
    iconKey: "admin",
    iconGlyph: "AD",
  },
  {
    id: "lab-openings",
    title: "Lab Openings Watch",
    description:
      "Checks faculty lab pages and interest forms for openings, then posts a digest of relevant matches for undergrad researchers.",
    source: "student",
    category: "Research",
    installs: 74,
    trustLabel: "Reviewed student workflow",
    visibility: "public",
    status: "approved",
    scheduleDefault: "Three scans per week",
    setupFields: ["Research interests", "Department targets", "Faculty list"],
    outcomes: ["Lab opening detection", "Match digest", "Saved faculty notes"],
    templateConfig: createMockTemplateConfig(
      "Three scans per week",
      ["Lab opening detection", "Match digest", "Saved faculty notes"],
      ["Research interests", "Department targets", "Faculty list"]
    ),
    imageSrc: "/workflows/lab-openings-watch.svg",
    iconKey: "research",
    iconGlyph: "LB",
  },
  {
    id: "travel-fund",
    title: "Conference Travel Fund Tracker",
    description:
      "Follows college and department travel funding pages, compares windows, and flags submission requirements before deadlines.",
    source: "student",
    category: "Scholarships",
    installs: 53,
    trustLabel: "Pending moderation update",
    visibility: "public",
    status: "pending_review",
    scheduleDefault: "Weekly scan",
    setupFields: ["College", "Degree program", "Conference timeline"],
    outcomes: ["Deadline monitoring", "Requirement comparison", "Reminder queue"],
    templateConfig: createMockTemplateConfig(
      "Weekly scan",
      ["Deadline monitoring", "Requirement comparison", "Reminder queue"],
      ["College", "Degree program", "Conference timeline"]
    ),
    imageSrc: "/workflows/conference-travel-fund-tracker.svg",
    iconKey: "funding",
    iconGlyph: "TR",
  },
  {
    id: "study-abroad-bot",
    title: "Study Abroad Bot",
    description:
      "Tracks program deadlines, required forms, and country-specific steps so students can stay ahead of study abroad planning.",
    source: "student",
    category: "Campus life",
    installs: 41,
    trustLabel: "Reviewed student workflow",
    visibility: "public",
    status: "approved",
    scheduleDefault: "Twice weekly check-in",
    setupFields: ["Target region", "Program interests", "Deadline reminders"],
    outcomes: ["Program tracking", "Form reminders", "Timeline digest"],
    templateConfig: createMockTemplateConfig(
      "Twice weekly check-in",
      ["Program tracking", "Form reminders", "Timeline digest"],
      ["Target region", "Program interests", "Deadline reminders"]
    ),
    imageSrc: "/workflows/study-abroad-bot.svg",
    iconKey: "official",
    iconGlyph: "SA",
  },
  {
    id: "intramural-sports-bot",
    title: "Intramural Sports Bot",
    description:
      "Watches intramural registration windows, roster deadlines, and open league spots for students joining campus sports.",
    source: "student",
    category: "Campus life",
    installs: 33,
    trustLabel: "Pending moderation update",
    visibility: "public",
    status: "pending_review",
    scheduleDefault: "Daily during registration season",
    setupFields: ["Sports interests", "League level", "Preferred reminders"],
    outcomes: ["Registration tracking", "Roster reminders", "Open spot alerts"],
    templateConfig: createMockTemplateConfig(
      "Daily during registration season",
      ["Registration tracking", "Roster reminders", "Open spot alerts"],
      ["Sports interests", "League level", "Preferred reminders"]
    ),
    imageSrc: "/workflows/intramural-sports-bot.svg",
    iconKey: "student",
    iconGlyph: "IM",
  },
];

export const installedAgents: Agent[] = [
  {
    id: "agent-scholarbot",
    name: "ScholarBot",
    templateId: "scholarbot",
    source: "dev",
    type: "scholar",
    status: "active",
    pendingActionCount: 2,
    latestSummary: "14 scholarship matches found, 2 need essays.",
    nextStepLabel: "2 actions pending",
    currentRun: {
      id: "run-scholarbot",
      triggerType: "scheduled",
      status: "succeeded",
      phase: "completed",
      statusLabel: "Succeeded",
      phaseLabel: "Completed",
      startedAt: Date.now() - 25 * 60_000,
      updatedAt: Date.now() - 18 * 60_000,
      endedAt: Date.now() - 18 * 60_000,
      updatedLabel: "18m ago",
      startedLabel: "Today, 10:52 AM",
      endedLabel: "Today, 10:59 AM",
      summary: "14 scholarship matches found, 2 high priority.",
      resultCounts: {
        matches: 14,
        highPriority: 2,
        needsAttention: 2,
      },
    },
    lastRunLabel: "Matched 14 scholarships 18 minutes ago",
    nextRunLabel: "Tonight at 11:30 PM",
    pendingActionLabel: "2 essays need review",
    scheduleLabel: "Nightly with deadline escalation",
  },
  {
    id: "agent-regbot",
    name: "RegBot",
    templateId: "regbot",
    source: "dev",
    type: "reg",
    status: "paused",
    pendingActionCount: 1,
    latestSummary: "Waiting on you to complete Duo before RegBot can continue.",
    nextStepLabel: "Needs your input",
    currentRun: {
      id: "run-regbot",
      triggerType: "manual",
      status: "waiting_for_input",
      phase: "authenticating",
      statusLabel: "Waiting on you",
      phaseLabel: "Authenticating",
      startedAt: Date.now() - 18 * 60_000,
      updatedAt: Date.now() - 12 * 60_000,
      updatedLabel: "12m ago",
      startedLabel: "Today, 10:58 AM",
      summary: "Waiting on you to complete Duo before RegBot can continue.",
      errorCategory: "authentication",
    },
    lastRunLabel: "Paused after Duo timeout at 8:12 AM",
    nextRunLabel: "Resume to continue monitoring",
    pendingActionLabel: "Awaiting resume",
    scheduleLabel: "Every 10 minutes",
  },
  {
    id: "agent-lab-openings",
    name: "Lab Openings Watch",
    templateId: "lab-openings",
    source: "student",
    type: "custom",
    status: "completed",
    pendingActionCount: 0,
    latestSummary: "4 lab openings found, 2 outreach drafts ready.",
    nextStepLabel: "No action needed",
    currentRun: {
      id: "run-lab-openings",
      triggerType: "scheduled",
      status: "succeeded",
      phase: "completed",
      statusLabel: "Succeeded",
      phaseLabel: "Completed",
      startedAt: Date.now() - 28 * 60 * 60_000,
      updatedAt: Date.now() - 26 * 60 * 60_000,
      endedAt: Date.now() - 26 * 60 * 60_000,
      updatedLabel: "1d ago",
      startedLabel: "Yesterday, 7:00 AM",
      endedLabel: "Yesterday, 7:12 AM",
      summary: "4 lab openings found, 2 outreach drafts ready.",
      resultCounts: {
        openings: 4,
        draftsReady: 2,
      },
    },
    lastRunLabel: "Digest sent yesterday",
    nextRunLabel: "Thursday at 7:00 AM",
    pendingActionLabel: "No pending action",
    scheduleLabel: "Three scans per week",
  },
  {
    id: "agent-finaid",
    name: "Financial Aid Audit",
    templateId: "financial-aid-audit",
    source: "student",
    type: "custom",
    status: "error",
    pendingActionCount: 0,
    latestSummary: "Financial aid portal layout changed and needs review.",
    nextStepLabel: "Review failure",
    currentRun: {
      id: "run-finaid",
      triggerType: "scheduled",
      status: "failed",
      phase: "failed",
      statusLabel: "Failed",
      phaseLabel: "Failed",
      startedAt: Date.now() - 6 * 60_000,
      updatedAt: Date.now() - 4 * 60_000,
      endedAt: Date.now() - 4 * 60_000,
      updatedLabel: "4m ago",
      startedLabel: "Today, 11:44 AM",
      endedLabel: "Today, 11:46 AM",
      summary: "Financial aid portal layout changed and needs review.",
      error: "Portal selector failed at the checklist step.",
      errorCategory: "site_changed",
    },
    lastRunLabel: "Portal selector failed at 6:42 AM",
    nextRunLabel: "Retry scheduled in 45 minutes",
    pendingActionLabel: "Credential check recommended",
    scheduleLabel: "Weekday mornings",
  },
];

export const agentEvents: AgentEvent[] = [
  {
    id: "event-1",
    time: "11:12 AM",
    agentName: "ScholarBot",
    title: "Matched new opportunity",
    detail: "Found Engineering Honors Scholarship and saved the deadline packet.",
    kind: "success",
  },
  {
    id: "event-2",
    time: "8:12 AM",
    agentName: "RegBot",
    title: "Paused on Duo retry",
    detail: "Registration attempt stopped after authentication timed out. Resume keeps current monitor state.",
    kind: "warning",
  },
  {
    id: "event-3",
    time: "6:42 AM",
    agentName: "Financial Aid Audit",
    title: "Layout changed",
    detail: "Aid checklist selector no longer matched. Screenshot captured for review.",
    kind: "error",
  },
];

export const studioDrafts: StudioDraft[] = [
  {
    id: "draft-1",
    title: "Department deadline tracker",
    state: "Spec ready",
    summary: "Scans department pages, pulls upcoming application windows, and posts reminders to email.",
    prompt: "Track department deadlines and send reminders.",
  },
  {
    id: "draft-2",
    title: "Advising appointment opener",
    state: "Dry run blocked",
    summary: "Detected a login step that needs a clearer session handoff before deployment.",
    prompt: "Monitor advising appointment openings and notify me when a slot appears.",
  },
];

export const settingsSections: SettingsSection[] = [
  {
    title: "Profile",
    description: "Store major, classification, scholarship interests, and academic preferences for template personalization.",
  },
  {
    title: "Credentials",
    description: "Manage UT login handoff, saved workflow credentials, and runtime vault access.",
  },
  {
    title: "Notifications",
    description: "Control email or in-app alerts for openings, pending actions, and workflow failures.",
  },
];
