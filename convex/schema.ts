import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentOwnerTypeValidator,
  agentRunStatusValidator,
  agentStatusValidator,
  agentTypeValidator,
  authMethodValidator,
  configEnvelopeValidator,
  logLevelValidator,
  monitorStatusValidator,
  pendingActionTypeValidator,
  scholarshipStatusValidator,
  scheduleConfigValidator,
  scenarioIdValidator,
  submissionStatusValidator,
  templateDraftPayloadValidator,
  templateSourceValidator,
  templateVisibilityValidator,
  workflowSourceAliasValidator,
} from "./lib/validators";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    eid: v.optional(v.string()),
    authMethod: authMethodValidator,
    profileData: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_eid", ["eid"])
    .index("by_createdAt", ["createdAt"]),

  userCredentials: defineTable({
    userId: v.id("users"),
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"]),

  authSessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  marketplaceTemplates: defineTable({
    title: v.string(),
    description: v.string(),
    source: templateSourceValidator,
    category: v.string(),
    visibility: templateVisibilityValidator,
    templateType: agentTypeValidator,
    installCount: v.number(),
    ownerUserId: v.optional(v.id("users")),
    templateConfig: configEnvelopeValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    approvedAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_source_visibility", ["source", "visibility"])
    .index("by_source_category_visibility", ["source", "category", "visibility"])
    .index("by_ownerUserId", ["ownerUserId"])
    .index("by_createdAt", ["createdAt"]),

  templateSubmissions: defineTable({
    userId: v.id("users"),
    templateId: v.optional(v.id("marketplaceTemplates")),
    draftPayload: templateDraftPayloadValidator,
    status: submissionStatusValidator,
    reviewerId: v.optional(v.id("users")),
    reviewNotes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_templateId", ["templateId"]),

  agents: defineTable({
    userId: v.id("users"),
    templateId: v.optional(v.id("marketplaceTemplates")),
    ownerType: agentOwnerTypeValidator,
    type: agentTypeValidator,
    status: agentStatusValidator,
    config: configEnvelopeValidator,
    schedule: scheduleConfigValidator,
    lastRunStatus: agentRunStatusValidator,
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    browserUseTaskId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_ownerType", ["userId", "ownerType"])
    .index("by_templateId", ["templateId"])
    .index("by_status_nextRunAt", ["status", "nextRunAt"]),

  scholarships: defineTable({
    userId: v.id("users"),
    agentId: v.id("agents"),
    title: v.string(),
    source: v.string(),
    deadline: v.optional(v.number()),
    eligibility: v.optional(v.any()),
    matchScore: v.optional(v.number()),
    status: scholarshipStatusValidator,
    missingFields: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_agentId", ["agentId"])
    .index("by_userId_status", ["userId", "status"]),

  registrationMonitors: defineTable({
    userId: v.id("users"),
    agentId: v.id("agents"),
    courseNumber: v.string(),
    uniqueId: v.string(),
    semester: v.string(),
    status: monitorStatusValidator,
    pollInterval: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_agentId", ["agentId"])
    .index("by_userId_status", ["userId", "status"]),

  pendingActions: defineTable({
    userId: v.id("users"),
    agentId: v.id("agents"),
    type: pendingActionTypeValidator,
    prompt: v.string(),
    response: v.optional(v.any()),
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_agentId", ["agentId"])
    .index("by_userId_resolvedAt", ["userId", "resolvedAt"]),

  customWorkflows: defineTable({
    userId: v.id("users"),
    agentId: v.optional(v.id("agents")),
    sourceAlias: workflowSourceAliasValidator,
    prompt: v.string(),
    spec: v.optional(v.any()),
    generatedScript: v.optional(v.string()),
    templateSubmissionId: v.optional(v.id("templateSubmissions")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_agentId", ["agentId"])
    .index("by_templateSubmissionId", ["templateSubmissionId"]),

  agentLogs: defineTable({
    agentId: v.id("agents"),
    timestamp: v.number(),
    event: v.string(),
    level: logLevelValidator,
    details: v.any(),
    screenshots: v.optional(v.array(v.string())),
    scenarioId: v.optional(scenarioIdValidator),
  }).index("by_agentId_timestamp", ["agentId", "timestamp"]),
});
