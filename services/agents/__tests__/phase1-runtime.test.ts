import assert from "node:assert/strict";
import test from "node:test";

import { listByScenario } from "../../../convex/agentLogs.ts";
import { getById as getAgentById } from "../../../convex/agents.ts";
import { installTemplate } from "../../../convex/marketplace.ts";
import { listByAgent as listPendingByAgent } from "../../../convex/pendingActions.ts";
import { listByUser as listRegistrationMonitors } from "../../../convex/registrationMonitors.ts";
import { DEFAULT_USER_ID, REGBOT_TEMPLATE_ID, SCHOLARBOT_TEMPLATE_ID, STUDENT_TEMPLATE_ID, resetRuntimeStore } from "../../../convex/runtimeStore.ts";
import { listByAgent as listScholarshipsByAgent } from "../../../convex/scholarships.ts";
import { resumeFromPendingAction } from "../../../convex/orchestrator.ts";
import {
  MARKETPLACE_INSTALL_DEV_TEMPLATE_SCENARIO,
  REGBOT_HAPPY_PATH_SCENARIO,
  SCHOLARBOT_HAPPY_PATH_SCENARIO,
} from "../../agents/shared/payloadMappers.ts";
import { getBrowserUseClient, resetBrowserUseMock } from "../../agents/browserUseClient.ts";

function resetAll(): void {
  process.env.BROWSER_USE_MODE = "mock";
  process.env.BROWSER_USE_FALLBACK_ENABLED = "true";
  resetRuntimeStore();
  resetBrowserUseMock();
}

test("marketplace_install_dev_template creates linked runnable scholar agent", async () => {
  resetAll();

  const install = await installTemplate(SCHOLARBOT_TEMPLATE_ID, {
    profile: { major: "CS", classification: "Undergraduate" },
  });

  const agent = getAgentById(install.agentId);
  assert.ok(agent, "agent must exist");
  assert.equal(agent?.templateId, SCHOLARBOT_TEMPLATE_ID);
  assert.equal(agent?.ownerType, "first_party");
  assert.equal(agent?.type, "scholar");
  assert.equal(agent?.status, "paused");

  const browserTaskId = String(install.runResult?.browserTaskId ?? "");
  const browserTask = browserTaskId ? getBrowserUseClient().snapshot(browserTaskId) : undefined;
  assert.ok(browserTask, "browser task should exist for install run");
  assert.equal(
    browserTask?.startUrl,
    "https://utexas.scholarships.ngwebsolutions.com/ScholarX_StudentLanding.aspx",
    "scholar browser startUrl should target the UT scholarships search page",
  );
  assert.match(
    browserTask?.taskPrompt ?? "",
    /utexas\.scholarships\.ngwebsolutions\.com\/Scholarships\/Search/,
    "scholar browser prompt should target the UT scholarships search page",
  );

  const installLogs = listByScenario(MARKETPLACE_INSTALL_DEV_TEMPLATE_SCENARIO);
  assert.ok(installLogs.length >= 1, "install scenario logs should exist");
  assert.ok(installLogs.every((log) => Boolean(log.scenarioId)), "all install logs should include scenarioId");
});

test("scholarbot_happy_path pauses then resumes to completion", async () => {
  resetAll();

  const install = await installTemplate(SCHOLARBOT_TEMPLATE_ID, {
    profile: { major: "EE", classification: "Graduate" },
  });

  const pending = listPendingByAgent(install.agentId).at(0);
  assert.ok(pending, "scholarbot install run should create pending action");

  await resumeFromPendingAction(pending!.id);

  const scholarships = listScholarshipsByAgent(install.agentId);
  assert.ok(scholarships.length >= 1, "scholarship upserts should exist");
  assert.ok(
    scholarships.some((record) => record.status === "submitted"),
    "at least one scholarship should be submitted after resume",
  );

  const agent = getAgentById(install.agentId);
  assert.equal(agent?.status, "completed");

  const logs = listByScenario(SCHOLARBOT_HAPPY_PATH_SCENARIO);
  const events = logs.map((log) => log.event);
  assert.ok(events.includes("pause"), "scholar logs must include pause");
  assert.ok(events.includes("resume"), "scholar logs must include resume");
  assert.ok(events.includes("success"), "scholar logs must include success");
  assert.ok(logs.every((log) => Boolean(log.details.runId) || log.event === "start"), "logs should retain run metadata");
});

test("regbot_happy_path captures Duo retry and successful registration", async () => {
  resetAll();

  const install = await installTemplate(REGBOT_TEMPLATE_ID, {
    courseNumber: "CS 331",
    uniqueId: "77880",
    semester: "Fall 2026",
    seatAvailableOnAttempt: 1,
    duoTimeoutAttempts: 1,
    maxPollAttempts: 2,
  });

  const agent = getAgentById(install.agentId);
  assert.equal(agent?.status, "completed");

  const monitors = listRegistrationMonitors(DEFAULT_USER_ID).filter((monitor) => monitor.agentId === install.agentId);
  assert.ok(monitors.length >= 1, "registration monitor should be created");
  assert.equal(monitors[0]?.status, "registered");

  const logs = listByScenario(REGBOT_HAPPY_PATH_SCENARIO);
  const events = logs.map((log) => log.event);
  assert.ok(events.includes("retry"), "regbot logs should include retry for Duo timeout");
  assert.ok(events.includes("success"), "regbot logs should include success terminal event");
  assert.ok(logs.every((log) => Boolean(log.scenarioId)), "all regbot logs should include scenarioId");
});

test("install rejects unsupported student template source in phase 1", async () => {
  resetAll();

  await assert.rejects(async () => {
    await installTemplate(STUDENT_TEMPLATE_ID, {
      anyConfig: true,
    });
  });
});
