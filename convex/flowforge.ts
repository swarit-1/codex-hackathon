import {
  flowforgeGenerateAgentScriptArgs,
  flowforgeGenerateWorkflowSpecArgs,
} from "./lib/validators";
import { createNotImplementedAction } from "./lib/stubResponses";

export const generateWorkflowSpec = createNotImplementedAction(
  flowforgeGenerateWorkflowSpecArgs,
  "flowforge.generateWorkflowSpec"
);

export const generateAgentScript = createNotImplementedAction(
  flowforgeGenerateAgentScriptArgs,
  "flowforge.generateAgentScript"
);
