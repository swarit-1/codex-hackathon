import type { RawWebhookPayload } from "./shared/eventTypes.ts";
import { handleWebhook } from "./orchestrator.ts";

export async function processWebhook(payload: RawWebhookPayload): Promise<Record<string, unknown>> {
  return handleWebhook(payload);
}
