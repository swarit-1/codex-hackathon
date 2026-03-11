export const schema = {
  users: {
    id: "string",
    email: "string",
  },
  marketplaceTemplates: {
    id: "string",
    source: "dev|student",
    visibility: "private|public",
    agentType: "scholar|reg|custom",
  },
  agents: {
    id: "string",
    templateId: "string?",
    ownerType: "first_party|student|generated",
    type: "scholar|reg|custom",
    status: "active|paused|completed|error",
    currentRunState: "idle|running|paused|completed|failed|cancelled",
    currentRunId: "string?",
    schedule: "string?",
    scheduledTaskId: "string?",
    lastControlAction: "run_now|update_schedule|delete|cancel_run?",
    lastRunStatus: "success|paused|failed?",
  },
  scheduledTasks: {
    id: "string",
    agentId: "string",
    schedule: "string",
    nextRunAt: "string",
    state: "scheduled|cancelled",
  },
  scholarships: {
    id: "string",
    agentId: "string",
    status: "found|applying|paused|submitted|expired",
  },
  registrationMonitors: {
    id: "string",
    agentId: "string",
    status: "watching|registered|failed",
  },
  pendingActions: {
    id: "string",
    agentId: "string",
    type: "essay|detail|confirmation",
  },
  agentLogs: {
    id: "string",
    agentId: "string",
    event: "start|step|pause|resume|retry|success|failure",
    scenarioId: "string?",
  },
} as const;
