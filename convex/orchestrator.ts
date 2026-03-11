import type { RunType } from "./types/contracts.ts";
import type { RawWebhookPayload } from "../services/agents/shared/eventTypes.ts";
import {
  cancelAgentRun as cancelAgentRunRuntime,
  handleWebhook as handleWebhookRuntime,
  resumeFromPendingAction as resumeFromPendingActionRuntime,
  triggerAgentRun as triggerAgentRunRuntime,
} from "../services/agents/orchestrator.ts";

export async function triggerAgentRun(agentId: string, runType: RunType): Promise<Record<string, unknown>> {
  return triggerAgentRunRuntime(agentId, runType);
}

export async function handleWebhook(eventPayload: RawWebhookPayload): Promise<Record<string, unknown>> {
  return handleWebhookRuntime(eventPayload);
}

export async function resumeFromPendingAction(actionId: string): Promise<Record<string, unknown>> {
  return resumeFromPendingActionRuntime(actionId);
}

export async function cancelAgentRun(
  agentId: string,
  options: { scenarioId?: string; reason?: string } = {},
): Promise<{ attempted: boolean; succeeded: boolean; taskId?: string; state?: string; reason?: string }> {
  return cancelAgentRunRuntime(agentId, options);
}
