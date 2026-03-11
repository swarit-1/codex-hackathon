export function validateGeneratedScript(script: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!script.includes("runGeneratedWorkflow")) {
    issues.push("Script must expose runGeneratedWorkflow");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
