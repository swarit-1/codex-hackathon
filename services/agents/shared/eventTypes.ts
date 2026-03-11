import type { AgentStatus, RuntimeRunContext } from "../../../convex/types/contracts.ts";

export type RuntimeEventType = "start" | "step" | "pause" | "resume" | "retry" | "success" | "failure";

export interface RuntimeEvent {
  agentId: string;
  runId: string;
  templateId?: string;
  scenarioId: string;
  status: AgentStatus;
  timestamp: string;
  type: RuntimeEventType;
  details: Record<string, unknown>;
}

export interface RawWebhookPayload {
  agentId: string;
  runId?: string;
  templateId?: string;
  scenarioId?: string;
  status?: AgentStatus;
  event?: RuntimeEventType;
  timestamp?: string;
  details?: Record<string, unknown>;
}

export function createRunContextEnvelope(input: {
  agentId: string;
  runId: string;
  templateId?: string;
  scenarioId: string;
  status?: AgentStatus;
  details?: Record<string, unknown>;
}): RuntimeRunContext {
  return {
    agentId: input.agentId,
    runId: input.runId,
    templateId: input.templateId,
    scenarioId: input.scenarioId,
    status: input.status ?? "active",
    timestamp: new Date().toISOString(),
    details: input.details ?? {},
  };
}

export function runtimeEventFromContext(
  context: RuntimeRunContext,
  type: RuntimeEventType,
  details: Record<string, unknown> = {},
): RuntimeEvent {
  return {
    agentId: context.agentId,
    runId: context.runId,
    templateId: context.templateId,
    scenarioId: context.scenarioId,
    status: context.status,
    timestamp: new Date().toISOString(),
    type,
    details: {
      runId: context.runId,
      ...details,
    },
  };
}

export function normalizeRuntimeEvent(payload: RawWebhookPayload): RuntimeEvent {
  if (!payload.agentId) {
    throw new Error("Webhook payload must include agentId");
  }

  return {
    agentId: payload.agentId,
    runId: payload.runId ?? "webhook_run",
    templateId: payload.templateId,
    scenarioId: payload.scenarioId ?? "webhook_retry_path",
    status: payload.status ?? "active",
    timestamp: payload.timestamp ?? new Date().toISOString(),
    type: payload.event ?? "step",
    details: payload.details ?? {},
  };
}
