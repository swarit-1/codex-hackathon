import assert from "node:assert/strict";
import test from "node:test";

import { listByScenario } from "../../../convex/agentLogs.ts";
import {
  create as createAgent,
  deleteAgent,
  getById as getAgentById,
  getScheduledTaskById,
  runNow,
  updateById,
  updateSchedule,
} from "../../../convex/agents.ts";
import { installTemplate } from "../../../convex/marketplace.ts";
import { REGBOT_TEMPLATE_ID, SCHOLARBOT_TEMPLATE_ID, resetRuntimeStore } from "../../../convex/runtimeStore.ts";
import {
  MY_AGENTS_DELETE_SCENARIO,
  MY_AGENTS_RUN_NOW_SCENARIO,
  MY_AGENTS_SCHEDULE_UPDATE_SCENARIO,
} from "../../agents/shared/payloadMappers.ts";
import { getBrowserUseClient, resetBrowserUseMock } from "../../agents/browserUseClient.ts";

function resetAll(): void {
  process.env.BROWSER_USE_MODE = "mock";
  process.env.BROWSER_USE_FALLBACK_ENABLED = "true";
  resetRuntimeStore();
  resetBrowserUseMock();
}

test("my_agents_run_now triggers manual run from non-running state", async () => {
  resetAll();

  const install = await installTemplate(SCHOLARBOT_TEMPLATE_ID, {
    profile: { major: "CS", classification: "Undergraduate" },
  });

  const result = await runNow(install.agentId);
  assert.equal(result.idempotent, false);
  assert.equal(result.agentId, install.agentId);
  assert.equal(result.scenarioId, MY_AGENTS_RUN_NOW_SCENARIO);
  assert.ok(result.runId, "run-now should return runId");
  assert.ok(result.browserTaskId, "run-now should return browserTaskId");

  const logs = listByScenario(MY_AGENTS_RUN_NOW_SCENARIO);
  assert.ok(logs.length >= 2, "run-now telemetry should emit multiple events");
  assert.ok(logs.some((log) => log.details.message === "Run-now requested"));
});

test("my_agents_run_now idempotent when run already in progress", async () => {
  resetAll();

  const agent = createAgent("reg", { courseNumber: "CS 313E", uniqueId: "11111", semester: "Fall 2026" });
  updateById(agent.id, {
    currentRunId: "run_in_progress",
    currentRunState: "running",
    browserUseTaskId: "browser_task_active",
  });

  const result = await runNow(agent.id);
  assert.equal(result.idempotent, true);
  assert.equal(result.reason, "agent already running");
  assert.equal(result.runId, "run_in_progress");
  assert.equal(result.runState, "running");

  const logs = listByScenario(MY_AGENTS_RUN_NOW_SCENARIO);
  assert.ok(logs.some((log) => String(log.details.message).includes("idempotent")));
});

test("my_agents_schedule_update validates, cancels prior task, and writes new handle", async () => {
  resetAll();

  const install = await installTemplate(REGBOT_TEMPLATE_ID, {
    courseNumber: "CS 331",
    uniqueId: "77880",
    semester: "Fall 2026",
  });

  const first = updateSchedule(install.agentId, "0 9 * * 1");
  const firstTask = getScheduledTaskById(first.scheduledTaskId);
  assert.ok(firstTask, "first schedule task should be stored");
  assert.equal(firstTask?.state, "scheduled");

  const second = updateSchedule(install.agentId, "30 14 * * 3");
  const cancelledFirstTask = getScheduledTaskById(first.scheduledTaskId);
  const secondTask = getScheduledTaskById(second.scheduledTaskId);

  assert.equal(cancelledFirstTask?.state, "cancelled", "previous task should be cancelled");
  assert.equal(secondTask?.state, "scheduled", "new task should be scheduled");

  const updatedAgent = getAgentById(install.agentId);
  assert.equal(updatedAgent?.scheduledTaskId, second.scheduledTaskId);
  assert.equal(updatedAgent?.schedule, "30 14 * * 3");

  const logs = listByScenario(MY_AGENTS_SCHEDULE_UPDATE_SCENARIO);
  assert.ok(logs.length >= 2);
  assert.ok(logs.every((log) => Boolean(log.details.nextRunAt)));
});

test("schedule update rejects invalid cron with validation guidance", async () => {
  resetAll();

  const install = await installTemplate(REGBOT_TEMPLATE_ID, {
    courseNumber: "CS 331",
    uniqueId: "77880",
    semester: "Fall 2026",
  });

  assert.throws(() => {
    updateSchedule(install.agentId, "*/5 * * * *");
  }, /Invalid schedule/);
});

test("delete on active run cancels browser task and tombstones agent", async () => {
  resetAll();

  const install = await installTemplate(REGBOT_TEMPLATE_ID, {
    courseNumber: "CS 331",
    uniqueId: "77880",
    semester: "Fall 2026",
  });

  const schedule = updateSchedule(install.agentId, "0 8 * * 1");

  const client = getBrowserUseClient();
  const task = client.create({
    agentId: install.agentId,
    runId: "run_delete_case",
  });
  client.start(task.taskId);

  updateById(install.agentId, {
    currentRunId: "run_delete_case",
    currentRunState: "running",
    browserUseTaskId: task.taskId,
  });

  const result = await deleteAgent(install.agentId);
  assert.equal(result.scenarioId, MY_AGENTS_DELETE_SCENARIO);
  assert.equal(result.cancellation.attempted, true);
  assert.equal(result.cancellation.succeeded, true);
  assert.equal(result.cancellation.scheduleTaskId, schedule.scheduledTaskId);
  assert.equal(result.cancellation.scheduleCancelled, true);

  const deleted = getAgentById(install.agentId);
  assert.ok(deleted?.deletedAt, "deletedAt should be set");
  assert.equal(deleted?.browserUseTaskId, undefined);
  assert.equal(deleted?.scheduledTaskId, undefined);

  await assert.rejects(async () => runNow(install.agentId));
});
