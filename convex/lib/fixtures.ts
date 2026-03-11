import {
  buildAgentOperationEvent,
  buildRuntimeHandoffPayload,
} from "./runControl";
import type {
  AgentRecord,
  AgentStatus,
  BackendScenarioFixture,
  ConfigEnvelope,
  RuntimeRunType,
  ScheduleConfig,
  ScenarioId,
} from "../types/contracts";

export const FIXTURE_EPOCH_MS = Date.parse("2026-03-11T00:00:00.000Z");

export const SCENARIO_IDS: ScenarioId[] = [
  "scholarbot_happy_path",
  "regbot_happy_path",
  "flowforge_happy_path",
  "regbot_duo_timeout",
  "webhook_retry_path",
  "marketplace_install_dev_template",
  "marketplace_install_student_template",
  "submission_pending_to_approved",
  "my_agents_run_now",
  "my_agents_schedule_update",
];

function buildDefaultSchedule(overrides: Partial<ScheduleConfig> = {}): ScheduleConfig {
  return {
    enabled: true,
    cron: "*/10 * * * *",
    timezone: "America/Chicago",
    jitterMinutes: 2,
    ...overrides,
  };
}

function buildDefaultConfig(overrides: Partial<ConfigEnvelope> = {}): ConfigEnvelope {
  return {
    schemaVersion: "v1",
    inputSchema: {
      fields: ["targetUrl"],
    },
    defaultConfig: {
      targetUrl: "https://example.edu",
    },
    defaultSchedule: buildDefaultSchedule(),
    currentConfig: {
      targetUrl: "https://example.edu",
    },
    ...overrides,
  };
}

function buildAgent(
  id: string,
  status: AgentStatus,
  lastRunStatus: AgentRecord["lastRunStatus"]
): AgentRecord {
  return {
    id,
    userId: "users/demo-user",
    templateId: "marketplaceTemplates/demo-template",
    ownerType: "first_party",
    type: "reg",
    status,
    config: buildDefaultConfig(),
    schedule: buildDefaultSchedule(),
    lastRunStatus,
    lastRunAt: FIXTURE_EPOCH_MS,
    nextRunAt: FIXTURE_EPOCH_MS + 10 * 60 * 1000,
    browserUseTaskId: "browser-use-task-demo",
    createdAt: FIXTURE_EPOCH_MS - 60 * 60 * 1000,
    updatedAt: FIXTURE_EPOCH_MS,
  };
}

function buildRunFixture(
  scenarioId: ScenarioId,
  title: string,
  runType: RuntimeRunType
): BackendScenarioFixture {
  const agent = buildAgent(`agents/${scenarioId}`, "active", "idle");
  const emittedAt = FIXTURE_EPOCH_MS;

  return {
    scenarioId,
    title,
    summary: `${title} deterministic backend fixture`,
    agent,
    operationEvent: buildAgentOperationEvent({
      agentId: agent.id,
      operation: runType === "scheduled" ? "schedule_update" : "run_now",
      status: "accepted",
      source: runType === "scheduled" ? "scheduler" : "my_agents",
      emittedAt,
      scenarioId,
      message:
        runType === "scheduled"
          ? "schedule change accepted for downstream runtime processing"
          : "manual run request accepted for downstream runtime processing",
    }),
    handoffPayload: buildRuntimeHandoffPayload({
      agentId: agent.id,
      runType,
      source: runType === "scheduled" ? "scheduler" : "my_agents",
      requestedAt: emittedAt,
      requestedByUserId: agent.userId,
      scenarioId,
      schedule: agent.schedule,
    }),
    expectedLogs: [
      {
        event: "agent.operation.requested",
        level: "info",
        scenarioId,
        details: {
          title,
          runType,
        },
      },
      {
        event: "agent.runtime.handoff_prepared",
        level: "info",
        scenarioId,
        details: {
          traceable: true,
        },
      },
    ],
  };
}

export function buildBackendScenarioFixtures(): Record<ScenarioId, BackendScenarioFixture> {
  return {
    scholarbot_happy_path: buildRunFixture(
      "scholarbot_happy_path",
      "ScholarBot happy path",
      "manual"
    ),
    regbot_happy_path: buildRunFixture(
      "regbot_happy_path",
      "RegBot happy path",
      "manual"
    ),
    flowforge_happy_path: buildRunFixture(
      "flowforge_happy_path",
      "Model-to-Agent Studio happy path",
      "manual"
    ),
    regbot_duo_timeout: {
      ...buildRunFixture("regbot_duo_timeout", "RegBot Duo timeout", "manual"),
      expectedLogs: [
        {
          event: "agent.operation.requested",
          level: "info",
          scenarioId: "regbot_duo_timeout",
          details: {
            title: "RegBot Duo timeout",
          },
        },
        {
          event: "agent.runtime.retry_scheduled",
          level: "warning",
          scenarioId: "regbot_duo_timeout",
          details: {
            retryPolicy: "exponential_backoff",
          },
        },
      ],
    },
    webhook_retry_path: {
      ...buildRunFixture("webhook_retry_path", "Webhook retry path", "manual"),
      expectedLogs: [
        {
          event: "agent.webhook.received",
          level: "info",
          scenarioId: "webhook_retry_path",
          details: {
            deliveryAttempt: 1,
          },
        },
        {
          event: "agent.webhook.retry_requested",
          level: "warning",
          scenarioId: "webhook_retry_path",
          details: {
            deliveryAttempt: 2,
          },
        },
      ],
    },
    marketplace_install_dev_template: buildRunFixture(
      "marketplace_install_dev_template",
      "Marketplace install dev template",
      "manual"
    ),
    marketplace_install_student_template: buildRunFixture(
      "marketplace_install_student_template",
      "Marketplace install student template",
      "manual"
    ),
    submission_pending_to_approved: {
      ...buildRunFixture(
        "submission_pending_to_approved",
        "Submission pending to approved",
        "manual"
      ),
      expectedLogs: [
        {
          event: "submission.review.requested",
          level: "info",
          scenarioId: "submission_pending_to_approved",
          details: {
            from: "pending_review",
            to: "approved",
          },
        },
      ],
    },
    my_agents_run_now: buildRunFixture(
      "my_agents_run_now",
      "My Agents run now",
      "manual"
    ),
    my_agents_schedule_update: buildRunFixture(
      "my_agents_schedule_update",
      "My Agents schedule update",
      "scheduled"
    ),
    imbot_happy_path: buildRunFixture(
      "imbot_happy_path",
      "IMBot happy path",
      "manual"
    ),
  };
}
