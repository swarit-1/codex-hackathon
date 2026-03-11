import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaskPrompt,
  resolveBrowserUseRuntimeModeFromEnv,
} from "../../../convex/lib/runtimePrompt.ts";
import type { ConfigEnvelope } from "../../../convex/types/contracts.ts";

function createConfig(values: Record<string, unknown>): ConfigEnvelope {
  return {
    schemaVersion: "v1",
    inputSchema: {},
    defaultConfig: values,
  };
}

test("cloud_v2 mode prefers browserTaskPrompt from config", () => {
  const config = createConfig({
    browserTaskPrompt: "Use this compiled prompt.",
    startUrl: "https://example.com",
    targetUrl: "https://example.com",
  });

  const result = buildTaskPrompt("custom", config, "cloud_v2");
  assert.equal(result.startUrl, "https://example.com");
  assert.match(result.taskPrompt, /Use this compiled prompt/);
  assert.doesNotMatch(result.taskPrompt, /No task configured/);
});

test("legacy mode preserves fallback prompt path", () => {
  const config = createConfig({
    browserTaskPrompt: "Compiled prompt should not be used in legacy mode.",
    targetUrl: "https://example.com",
  });

  const result = buildTaskPrompt("custom", config, "legacy");
  assert.equal(result.startUrl, "https://example.com");
  assert.match(result.taskPrompt, /Navigate to https:\/\/example.com/);
});

test("cloud_v2 injects UT credentials when present", () => {
  const prevEid = process.env.UT_EID;
  const prevPassword = process.env.UT_PASSWORD;
  process.env.UT_EID = "test_eid";
  process.env.UT_PASSWORD = "test_password";

  try {
    const result = buildTaskPrompt(
      "custom",
      createConfig({
        browserTaskPrompt: "Run the custom browser workflow.",
        startUrl: "https://example.com",
      }),
      "cloud_v2"
    );

    assert.match(result.taskPrompt, /AUTHENTICATION CREDENTIALS/);
    assert.match(result.taskPrompt, /UT EID: test_eid/);
    assert.match(result.taskPrompt, /UT Password: test_password/);
  } finally {
    if (prevEid === undefined) {
      delete process.env.UT_EID;
    } else {
      process.env.UT_EID = prevEid;
    }
    if (prevPassword === undefined) {
      delete process.env.UT_PASSWORD;
    } else {
      process.env.UT_PASSWORD = prevPassword;
    }
  }
});

test("cloud_v2 does not inject credentials when missing", () => {
  const prevEid = process.env.UT_EID;
  const prevPassword = process.env.UT_PASSWORD;
  delete process.env.UT_EID;
  delete process.env.UT_PASSWORD;

  try {
    const result = buildTaskPrompt(
      "custom",
      createConfig({
        browserTaskPrompt: "Run the custom browser workflow.",
      }),
      "cloud_v2"
    );

    assert.doesNotMatch(result.taskPrompt, /AUTHENTICATION CREDENTIALS/);
  } finally {
    if (prevEid === undefined) {
      delete process.env.UT_EID;
    } else {
      process.env.UT_EID = prevEid;
    }
    if (prevPassword === undefined) {
      delete process.env.UT_PASSWORD;
    } else {
      process.env.UT_PASSWORD = prevPassword;
    }
  }
});

test("resolveBrowserUseRuntimeModeFromEnv maps cloud_v2 flag", () => {
  const previousMode = process.env.BROWSER_USE_MODE;
  process.env.BROWSER_USE_MODE = "cloud_v2";
  assert.equal(resolveBrowserUseRuntimeModeFromEnv(), "cloud_v2");

  process.env.BROWSER_USE_MODE = "local_v1";
  assert.equal(resolveBrowserUseRuntimeModeFromEnv(), "legacy");

  if (previousMode === undefined) {
    delete process.env.BROWSER_USE_MODE;
  } else {
    process.env.BROWSER_USE_MODE = previousMode;
  }
});
