import {
  orchestratorHandleWebhookArgs,
  orchestratorResumeFromPendingActionArgs,
  orchestratorTriggerAgentRunArgs,
} from "./lib/validators";
import { createNotImplementedAction } from "./lib/stubResponses";

export const triggerAgentRun = createNotImplementedAction(
  orchestratorTriggerAgentRunArgs,
  "orchestrator.triggerAgentRun"
);

export const handleWebhook = createNotImplementedAction(
  orchestratorHandleWebhookArgs,
  "orchestrator.handleWebhook"
);

export const resumeFromPendingAction = createNotImplementedAction(
  orchestratorResumeFromPendingActionArgs,
  "orchestrator.resumeFromPendingAction"
);
