import { generateAgentScript as generateScript } from "../services/agents/flowforge/scriptGenerator.ts";
import { generateWorkflowSpec as generateSpec, type WorkflowSpec } from "../services/agents/flowforge/specGenerator.ts";

export function generateWorkflowSpec(nlDescription: string): WorkflowSpec {
  return generateSpec(nlDescription);
}

export function generateAgentScript(spec: WorkflowSpec): string {
  return generateScript(spec);
}
