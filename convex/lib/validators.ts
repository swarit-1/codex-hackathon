import { v } from "convex/values";

export const agentStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("error")
);

export const scholarshipStatusValidator = v.union(
  v.literal("found"),
  v.literal("applying"),
  v.literal("paused"),
  v.literal("submitted"),
  v.literal("expired")
);

export const labOpeningStatusValidator = v.union(
  v.literal("discovered"),
  v.literal("reviewing"),
  v.literal("drafting_email"),
  v.literal("email_ready"),
  v.literal("contacted"),
  v.literal("expired")
);

export const monitorStatusValidator = v.union(
  v.literal("watching"),
  v.literal("registered"),
  v.literal("failed")
);

export const pendingActionTypeValidator = v.union(
  v.literal("essay"),
  v.literal("detail"),
  v.literal("confirmation"),
  v.literal("email_draft")
);

export const templateSourceValidator = v.union(v.literal("dev"), v.literal("student"));

export const submissionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected")
);

export const reviewDecisionValidator = v.union(v.literal("approved"), v.literal("rejected"));
export const backendErrorCodeValidator = v.union(
  v.literal("PHASE_2_NOT_IMPLEMENTED"),
  v.literal("VALIDATION_ERROR"),
  v.literal("INVALID_STATE"),
  v.literal("FORBIDDEN"),
  v.literal("NOT_FOUND"),
  v.literal("RATE_LIMITED")
);

export const templateVisibilityValidator = v.union(v.literal("private"), v.literal("public"));

export const agentOwnerTypeValidator = v.union(
  v.literal("first_party"),
  v.literal("student"),
  v.literal("generated")
);

export const agentTypeValidator = v.union(
  v.literal("scholar"),
  v.literal("reg"),
  v.literal("eureka"),
  v.literal("custom")
);

export const agentRunStatusValidator = v.union(
  v.literal("idle"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("cancelled")
);

export const authMethodValidator = v.union(
  v.literal("email"),
  v.literal("ut_sso"),
  v.literal("demo")
);

export const logLevelValidator = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error")
);

export const workflowSourceAliasValidator = v.union(
  v.literal("model_to_agent_studio"),
  v.literal("flowforge")
);
export const runtimeRunTypeValidator = v.union(
  v.literal("manual"),
  v.literal("scheduled"),
  v.literal("resume")
);
export const runTriggerSourceValidator = v.union(
  v.literal("my_agents"),
  v.literal("scheduler"),
  v.literal("pending_action"),
  v.literal("webhook")
);
export const agentOperationTypeValidator = v.union(
  v.literal("run_now"),
  v.literal("schedule_update"),
  v.literal("delete")
);
export const agentOperationStatusValidator = v.union(
  v.literal("accepted"),
  v.literal("deferred"),
  v.literal("rejected")
);
export const agentDeleteModeValidator = v.union(
  v.literal("archive_only"),
  v.literal("cancel_then_archive")
);
export const scenarioIdValidator = v.union(
  v.literal("scholarbot_happy_path"),
  v.literal("regbot_happy_path"),
  v.literal("eurekabot_happy_path"),
  v.literal("flowforge_happy_path"),
  v.literal("regbot_duo_timeout"),
  v.literal("webhook_retry_path"),
  v.literal("marketplace_install_dev_template"),
  v.literal("marketplace_install_student_template"),
  v.literal("submission_pending_to_approved"),
  v.literal("my_agents_run_now"),
  v.literal("my_agents_schedule_update")
);

export const scheduleConfigValidator = v.object({
  enabled: v.boolean(),
  cron: v.string(),
  timezone: v.string(),
  jitterMinutes: v.optional(v.number()),
});

export const configEnvelopeValidator = v.object({
  schemaVersion: v.string(),
  inputSchema: v.any(),
  defaultConfig: v.any(),
  defaultSchedule: v.optional(scheduleConfigValidator),
  currentConfig: v.optional(v.any()),
});

export const templateDraftPayloadValidator = v.object({
  title: v.string(),
  description: v.string(),
  category: v.string(),
  templateType: agentTypeValidator,
  visibility: v.optional(templateVisibilityValidator),
  templateConfig: configEnvelopeValidator,
});

export const paginationArgs = {
  limit: v.optional(v.number()),
  cursor: v.optional(v.string()),
};

export const sessionTokenValidator = v.string();

export const authSignUpArgs = {
  name: v.string(),
  email: v.string(),
  password: v.string(),
  eid: v.optional(v.string()),
  profileData: v.optional(v.any()),
};

export const authSignInArgs = {
  email: v.string(),
  password: v.string(),
};

export const authSignOutArgs = {
  sessionToken: sessionTokenValidator,
};

export const authGetCurrentUserArgs = {
  sessionToken: sessionTokenValidator,
};

const sessionTokenArg = {
  sessionToken: sessionTokenValidator,
};

export const marketplaceTemplateFilterArgs = {
  source: templateSourceValidator,
  category: v.optional(v.string()),
  visibility: v.optional(templateVisibilityValidator),
  ownerUserId: v.optional(v.id("users")),
  ...paginationArgs,
};

export const agentListFilterArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  status: v.optional(agentStatusValidator),
  ownerType: v.optional(agentOwnerTypeValidator),
  type: v.optional(agentTypeValidator),
  ...paginationArgs,
};

export const agentLogListArgs = {
  ...sessionTokenArg,
  agentId: v.id("agents"),
  ...paginationArgs,
};

export const userProfileCreateArgs = {
  name: v.string(),
  email: v.string(),
  eid: v.optional(v.string()),
  authMethod: authMethodValidator,
  profileData: v.optional(v.any()),
};

export const userProfileUpdateArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  ...userProfileCreateArgs,
};

export const userProfileUpsertArgs = userProfileUpdateArgs;

export const userProfileGetArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
};

export const agentCreateArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  type: agentTypeValidator,
  config: configEnvelopeValidator,
  templateId: v.optional(v.id("marketplaceTemplates")),
  ownerType: v.optional(agentOwnerTypeValidator),
  schedule: v.optional(scheduleConfigValidator),
};

export const agentUpdateStatusArgs = {
  ...sessionTokenArg,
  agentId: v.id("agents"),
  status: agentStatusValidator,
};

export const agentRunNowArgs = {
  ...sessionTokenArg,
  agentId: v.id("agents"),
};

export const agentUpdateScheduleArgs = {
  ...sessionTokenArg,
  agentId: v.id("agents"),
  schedule: scheduleConfigValidator,
};

export const agentDeleteArgs = {
  ...sessionTokenArg,
  agentId: v.id("agents"),
};

export const marketplaceGetTemplateArgs = {
  templateId: v.id("marketplaceTemplates"),
};

export const marketplaceInstallTemplateArgs = {
  ...sessionTokenArg,
  templateId: v.id("marketplaceTemplates"),
  userId: v.id("users"),
  config: configEnvelopeValidator,
};

export const marketplaceSubmitTemplateArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  draftPayload: templateDraftPayloadValidator,
  templateId: v.optional(v.id("marketplaceTemplates")),
};

export const marketplaceReviewSubmissionArgs = {
  ...sessionTokenArg,
  submissionId: v.id("templateSubmissions"),
  decision: reviewDecisionValidator,
  reviewerId: v.id("users"),
  reviewNotes: v.optional(v.string()),
};

export const scholarshipListArgs = {
  userId: v.id("users"),
  status: v.optional(scholarshipStatusValidator),
  ...paginationArgs,
};

export const scholarshipUpsertFromRunArgs = {
  userId: v.id("users"),
  agentId: v.id("agents"),
  title: v.string(),
  source: v.string(),
  deadline: v.optional(v.number()),
  eligibility: v.optional(v.any()),
  matchScore: v.optional(v.number()),
  status: scholarshipStatusValidator,
  missingFields: v.optional(v.array(v.string())),
};

export const registrationMonitorCreateArgs = {
  userId: v.id("users"),
  agentId: v.id("agents"),
  courseNumber: v.string(),
  uniqueId: v.string(),
  semester: v.string(),
  status: v.optional(monitorStatusValidator),
  pollInterval: v.number(),
};

export const registrationMonitorListArgs = {
  userId: v.id("users"),
  status: v.optional(monitorStatusValidator),
  ...paginationArgs,
};

export const pendingActionCreateArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  agentId: v.id("agents"),
  type: pendingActionTypeValidator,
  prompt: v.string(),
};

export const pendingActionResolveArgs = {
  ...sessionTokenArg,
  actionId: v.id("pendingActions"),
  response: v.any(),
};

export const pendingActionListArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  ...paginationArgs,
};

export const customWorkflowCreateArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  prompt: v.string(),
  sourceAlias: v.optional(workflowSourceAliasValidator),
  spec: v.optional(v.any()),
  generatedScript: v.optional(v.string()),
  agentId: v.optional(v.id("agents")),
  templateSubmissionId: v.optional(v.id("templateSubmissions")),
};

export const customWorkflowListArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  ...paginationArgs,
};

export const customWorkflowUpdateArgs = {
  ...sessionTokenArg,
  workflowId: v.id("customWorkflows"),
  patch: v.optional(v.any()),
  spec: v.optional(v.any()),
  generatedScript: v.optional(v.string()),
  prompt: v.optional(v.string()),
  agentId: v.optional(v.id("agents")),
  templateSubmissionId: v.optional(v.id("templateSubmissions")),
};

export const agentLogAppendArgs = {
  ...sessionTokenArg,
  agentId: v.id("agents"),
  event: v.string(),
  level: v.optional(logLevelValidator),
  details: v.any(),
  screenshots: v.optional(v.array(v.string())),
  scenarioId: v.optional(scenarioIdValidator),
};

export const agentLogListByUserArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
  ...paginationArgs,
};

export const runtimeWebhookPayloadValidator = v.object({
  agentId: v.id("agents"),
  event: v.string(),
  status: agentRunStatusValidator,
  occurredAt: v.number(),
  traceId: v.string(),
  runType: v.optional(runtimeRunTypeValidator),
  scenarioId: v.optional(scenarioIdValidator),
  details: v.optional(v.any()),
});

export const dashboardGetOverviewArgs = {
  ...sessionTokenArg,
  userId: v.id("users"),
};

export const demoBootstrapCatalogArgs = {};

export const flowforgeGenerateWorkflowSpecArgs = {
  nlDescription: v.string(),
};

export const flowforgeGenerateAgentScriptArgs = {
  spec: v.any(),
};

export const orchestratorTriggerAgentRunArgs = {
  agentId: v.id("agents"),
  runType: runtimeRunTypeValidator,
};

export const orchestratorHandleWebhookArgs = {
  eventPayload: runtimeWebhookPayloadValidator,
};

export const orchestratorResumeFromPendingActionArgs = {
  actionId: v.id("pendingActions"),
};
