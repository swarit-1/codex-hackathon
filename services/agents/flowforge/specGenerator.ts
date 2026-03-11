export interface WorkflowSpec {
  title: string;
  steps: string[];
}

export function generateWorkflowSpec(nlDescription: string): WorkflowSpec {
  const description = nlDescription.trim();
  if (!description) {
    throw new Error("nlDescription is required");
  }

  return {
    title: "Generated Workflow",
    steps: description
      .split(/[.!?]/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0),
  };
}
