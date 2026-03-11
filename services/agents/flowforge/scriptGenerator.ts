import type { WorkflowSpec } from "./specGenerator.ts";

export function generateAgentScript(spec: WorkflowSpec): string {
  if (!spec.steps.length) {
    throw new Error("Workflow spec must include at least one step");
  }

  const serializedSteps = spec.steps.map((step, index) => `// ${index + 1}. ${step}`).join("\n");
  return [
    "export async function runGeneratedWorkflow() {",
    serializedSteps,
    "  return { status: 'ok' };",
    "}",
  ].join("\n");
}
