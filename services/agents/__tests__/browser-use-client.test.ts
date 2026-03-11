import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  getBrowserUseClient,
  isBrowserUseFallbackEnabled,
  resolveBrowserUseModeFromEnv,
  resolveLocalRunnerConfigFromEnv,
  resetBrowserUseMock,
} from "../../agents/browserUseClient.ts";

function restoreEnvVar(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function resetClient(): void {
  resetBrowserUseMock();
}

test("mode routing uses mock when configured", () => {
  process.env.BROWSER_USE_MODE = "mock";
  process.env.BROWSER_USE_FALLBACK_ENABLED = "true";
  resetClient();

  assert.equal(resolveBrowserUseModeFromEnv(), "mock");

  const client = getBrowserUseClient();
  const created = client.create({
    agentId: "agent_1",
    runId: "run_1",
  });

  assert.equal(created.modeUsed, "mock");

  const started = client.start(created.taskId);
  assert.equal(started.state, "running");

  const status = client.status(created.taskId);
  assert.equal(status.state, "succeeded");
});

test("local_v1 falls back to mock when python interpreter is unavailable", () => {
  const previousMode = process.env.BROWSER_USE_MODE;
  const previousFallback = process.env.BROWSER_USE_FALLBACK_ENABLED;
  const previousPythonBin = process.env.BROWSER_USE_PYTHON_BIN;

  process.env.BROWSER_USE_MODE = "local_v1";
  process.env.BROWSER_USE_FALLBACK_ENABLED = "true";
  process.env.BROWSER_USE_PYTHON_BIN = "python_bin_that_should_not_exist_123";
  resetClient();

  const client = getBrowserUseClient();
  const created = client.create({
    agentId: "agent_2",
    runId: "run_2",
    mode: "deterministic-slow-success",
  });

  assert.equal(created.modeUsed, "local_v1");

  const started = client.start(created.taskId);
  assert.equal(started.modeUsed, "mock");
  assert.equal(started.state, "running");
  assert.match(started.lastError ?? "", /local_v1 unavailable/);

  const status1 = client.status(created.taskId);
  assert.equal(status1.state, "running");

  const status2 = client.status(created.taskId);
  assert.equal(status2.state, "succeeded");

  restoreEnvVar("BROWSER_USE_MODE", previousMode);
  restoreEnvVar("BROWSER_USE_FALLBACK_ENABLED", previousFallback);
  restoreEnvVar("BROWSER_USE_PYTHON_BIN", previousPythonBin);
});

test("cancel transitions running mock task to cancelled", () => {
  process.env.BROWSER_USE_MODE = "mock";
  process.env.BROWSER_USE_FALLBACK_ENABLED = "true";
  resetClient();

  const client = getBrowserUseClient();
  const created = client.create({
    agentId: "agent_3",
    runId: "run_3",
    mode: "deterministic-slow-success",
  });

  client.start(created.taskId);

  const cancelled = client.cancel(created.taskId);
  assert.equal(cancelled.state, "cancelled");

  const statusAfterCancel = client.status(created.taskId);
  assert.equal(statusAfterCancel.state, "cancelled");
});

test("config resolver returns chrome profile defaults and fallback default true", () => {
  const previousMode = process.env.BROWSER_USE_MODE;
  const previousExecutable = process.env.BROWSER_USE_CHROME_EXECUTABLE;
  const previousUserDataDir = process.env.BROWSER_USE_USER_DATA_DIR;
  const previousProfileDir = process.env.BROWSER_USE_PROFILE_DIRECTORY;
  const previousHeadless = process.env.BROWSER_USE_HEADLESS;
  const previousPythonBin = process.env.BROWSER_USE_PYTHON_BIN;
  const previousFallback = process.env.BROWSER_USE_FALLBACK_ENABLED;

  process.env.BROWSER_USE_MODE = "local_v1";
  delete process.env.BROWSER_USE_CHROME_EXECUTABLE;
  delete process.env.BROWSER_USE_USER_DATA_DIR;
  delete process.env.BROWSER_USE_PROFILE_DIRECTORY;
  delete process.env.BROWSER_USE_HEADLESS;
  delete process.env.BROWSER_USE_PYTHON_BIN;
  delete process.env.BROWSER_USE_FALLBACK_ENABLED;

  const config = resolveLocalRunnerConfigFromEnv();
  const projectVenvPython = resolve(process.cwd(), ".venv/bin/python");
  const expectedPython = existsSync(projectVenvPython) ? projectVenvPython : "python3";
  assert.equal(config.pythonBin, expectedPython);
  assert.equal(config.profileDirectory, "Default");
  assert.equal(config.headless, false);
  assert.equal(isBrowserUseFallbackEnabled(), true);

  restoreEnvVar("BROWSER_USE_MODE", previousMode);
  restoreEnvVar("BROWSER_USE_CHROME_EXECUTABLE", previousExecutable);
  restoreEnvVar("BROWSER_USE_USER_DATA_DIR", previousUserDataDir);
  restoreEnvVar("BROWSER_USE_PROFILE_DIRECTORY", previousProfileDir);
  restoreEnvVar("BROWSER_USE_HEADLESS", previousHeadless);
  restoreEnvVar("BROWSER_USE_PYTHON_BIN", previousPythonBin);
  restoreEnvVar("BROWSER_USE_FALLBACK_ENABLED", previousFallback);
});

test("local_v1 smoke (optional): start and cancel local process", async (t) => {
  if (process.env.RUN_BROWSER_USE_LOCAL_SMOKE !== "1") {
    t.skip("Set RUN_BROWSER_USE_LOCAL_SMOKE=1 to enable local Browser Use smoke test.");
    return;
  }

  process.env.BROWSER_USE_MODE = "local_v1";
  process.env.BROWSER_USE_FALLBACK_ENABLED = "false";

  const pythonBin = resolveLocalRunnerConfigFromEnv().pythonBin;
  const importCheck = spawnSync(pythonBin, ["-c", "import browser_use"], { encoding: "utf-8" });
  if (importCheck.status !== 0) {
    t.skip("browser_use package is not available in selected Python interpreter.");
    return;
  }

  resetClient();

  const client = getBrowserUseClient();
  const created = client.create({
    agentId: "agent_smoke",
    runId: "run_smoke",
  });

  const started = client.start(created.taskId);
  assert.equal(started.modeUsed, "local_v1");

  if (started.state === "running") {
    const cancelled = client.cancel(created.taskId);
    assert.equal(cancelled.state, "cancelled");
  }
});
