import type {
  AgentType,
  ConfigEnvelope,
  JsonObject,
} from "../types/contracts";

const SCHOLAR_DEFAULT_START_URL = "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search";
const REG_DEFAULT_START_URL = "https://utdirect.utexas.edu/registration/classlist/nologin/";

export type BrowserUseRuntimeMode = "cloud_v2" | "legacy";

export function resolveBrowserUseRuntimeModeFromEnv(): BrowserUseRuntimeMode {
  const normalized = (process.env.BROWSER_USE_MODE ?? "").trim().toLowerCase();
  if (normalized === "cloud_v2") {
    return "cloud_v2";
  }
  return "legacy";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readCurrentConfig(config: ConfigEnvelope): JsonObject {
  return (config.currentConfig ?? config.defaultConfig) as JsonObject;
}

function appendCredentialsToPrompt(taskPrompt: string): string {
  const eid = (process.env.UT_EID ?? "").trim();
  const password = (process.env.UT_PASSWORD ?? "").trim();
  if (!eid || !password) {
    return taskPrompt;
  }

  return [
    taskPrompt.trim(),
    "",
    "AUTHENTICATION CREDENTIALS:",
    `- UT EID: ${eid}`,
    `- UT Password: ${password}`,
    "- Use these exact credentials only when a login form requests them.",
  ].join("\n");
}

function resolveStartUrl(agentType: AgentType, config: ConfigEnvelope): string | undefined {
  const currentConfig = readCurrentConfig(config);
  const explicitStartUrl = currentConfig.startUrl;
  const targetUrl = currentConfig.targetUrl;

  if (isNonEmptyString(explicitStartUrl)) {
    return explicitStartUrl.trim();
  }
  if (isNonEmptyString(targetUrl)) {
    return targetUrl.trim();
  }

  if (agentType === "scholar") {
    return SCHOLAR_DEFAULT_START_URL;
  }
  if (agentType === "reg") {
    return REG_DEFAULT_START_URL;
  }

  return undefined;
}

function buildLegacyTaskPrompt(agentType: AgentType, config: ConfigEnvelope): string {
  const currentConfig = readCurrentConfig(config);
  const targetUrl = (currentConfig.targetUrl as string) ?? "";

  switch (agentType) {
    case "scholar": {
      const major = ((currentConfig.profile as JsonObject)?.major as string) ?? "Computer Science";
      const startUrl = targetUrl || SCHOLAR_DEFAULT_START_URL;
      return `You are a browser automation agent helping a UT Austin student apply to a scholarship.

GOAL: Navigate to the scholarship search page, find the "CREEES McWilliams Scholarship", \
click its "Apply Now" button, and then fill out the entire scholarship application \
form across all pages — but DO NOT submit at the end.

Step-by-step instructions:

1. You should already be on ${startUrl}. Wait for the page to fully load.

2. Look through the list of scholarships on the page for "CREEES McWilliams Scholarship". \
   You may need to scroll down or paginate through results to find it. \
   Once you find it, click the "Apply Now" button next to it.

3. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID and password if credentials are provided.
   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear (e.g. click "Send Me a Push" \
     or approve via the Duo app — wait for it to complete).
   - After login, you should be redirected back to the scholarship application.

4. Once on the scholarship application form, fill out ALL available fields on \
   each page. Use reasonable values for a UT Austin undergraduate ${major} student. \
   For text fields that ask for essays or explanations, write 2-3 thoughtful sentences.

5. After completing all fields on a page, click "Next", "Continue", or the next \
   step/page button to proceed.

6. Continue filling out ALL pages of the application.

7. On the FINAL page/step, STOP. Do NOT click "Submit", "Finish", or any button \
   that would finalize/submit the application.

8. Report back what fields you found on each page and what values you entered.

CRITICAL RULES:
- DO NOT click any Submit or Finish button that would finalize the application.
- Fill out EVERY field on EVERY page before moving to the next page.
- If a dropdown does not have an exact match, pick the closest available option.
- Take your time and be thorough — fill ALL fields before proceeding.`;
    }

    case "reg": {
      const courseNumber = (currentConfig.courseNumber as string) ?? "";
      const uniqueId = (currentConfig.uniqueId as string) ?? "";
      const semester = (currentConfig.semester as string) ?? "";
      return `You are a class registration monitor for a UT Austin student.

GOAL: Check if a seat is available for ${courseNumber} (Unique ID: ${uniqueId}) for ${semester}.

1. Navigate to ${targetUrl || REG_DEFAULT_START_URL}.
2. Search for course ${courseNumber} with unique ID ${uniqueId}.
3. Check if there are any open seats available.
4. Report the current enrollment status: total seats, seats taken, seats available, and waitlist count if any.`;
    }

    case "custom":
    default: {
      const taskDescription = (currentConfig.taskDescription as string) ?? "";
      if (taskDescription) {
        return taskDescription;
      }
      if (targetUrl) {
        return `Navigate to ${targetUrl} and report what you find on the page.`;
      }
      return "No task configured for this agent.";
    }
  }
}

export function buildTaskPrompt(
  agentType: AgentType,
  config: ConfigEnvelope,
  mode: BrowserUseRuntimeMode = resolveBrowserUseRuntimeModeFromEnv()
): { taskPrompt: string; startUrl?: string } {
  const currentConfig = readCurrentConfig(config);
  const startUrl = resolveStartUrl(agentType, config);
  const browserTaskPrompt = currentConfig.browserTaskPrompt;

  if (mode === "cloud_v2" && isNonEmptyString(browserTaskPrompt)) {
    return {
      taskPrompt: appendCredentialsToPrompt(browserTaskPrompt.trim()),
      startUrl,
    };
  }

  const fallbackPrompt = buildLegacyTaskPrompt(agentType, config);
  return {
    taskPrompt: mode === "cloud_v2" ? appendCredentialsToPrompt(fallbackPrompt) : fallbackPrompt,
    startUrl,
  };
}
