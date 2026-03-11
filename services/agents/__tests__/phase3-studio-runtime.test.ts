import assert from "node:assert/strict";
import test from "node:test";

import { listLogsByScenario, getAgentById } from "../shared/runtimeAdapters.ts";
import { DEFAULT_USER_ID, resetRuntimeStore, getRuntimeStore, nextId } from "../../../convex/runtimeStore.ts";
import { getBrowserUseClient, resetBrowserUseMock } from "../../agents/browserUseClient.ts";
import { triggerAgentRun } from "../../agents/orchestrator.ts";

function createAgent(type: string, config: Record<string, unknown>) {
    const agentId = nextId("agent");
    const agent: any = {
        id: agentId,
        userId: DEFAULT_USER_ID,
        templateId: "tpl_mock",
        ownerType: "first_party",
        type,
        status: "active",
        config: {
            schemaVersion: "1.0",
            inputSchema: {},
            defaultConfig: config,
        },
        schedule: { enabled: false, cron: "", timezone: "America/Chicago" },
        lastRunStatus: "idle",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    getRuntimeStore().agents.set(agentId, agent);
    return agent;
}

function resetAll(): void {
    process.env.BROWSER_USE_MODE = "mock";
    process.env.BROWSER_USE_FALLBACK_ENABLED = "true";
    resetRuntimeStore();
    resetBrowserUseMock();
}

const CUSTOM_NL_PROMPT =
    "Go to the UT library website and check the availability of study rooms for this week.";
const CUSTOM_TARGET_URL = "https://www.lib.utexas.edu/study-rooms";

test("flowforge_happy_path: custom agent runs with NL prompt forwarded to browser task", async () => {
    resetAll();

    const agent = createAgent("custom", {
        targetUrl: CUSTOM_TARGET_URL,
        instructions: CUSTOM_NL_PROMPT,
        taskType: "custom",
    });

    assert.ok(agent, "agent must exist");
    assert.equal(agent.type, "custom");

    const result = await triggerAgentRun(agent.id, "manual");

    assert.ok(result.browserTaskId, "run should return browserTaskId");

    const browserTask = getBrowserUseClient().snapshot(String(result.browserTaskId));
    assert.ok(browserTask, "browser task should exist for custom run");

    // Verify the NL prompt was forwarded to the browser task
    assert.ok(
        browserTask?.taskPrompt?.includes(CUSTOM_NL_PROMPT),
        `browser task prompt should contain the NL instructions. Got: ${browserTask?.taskPrompt?.slice(0, 200)}`,
    );

    // Verify the target URL was set
    assert.equal(
        browserTask?.startUrl,
        CUSTOM_TARGET_URL,
        "browser task startUrl should be the custom target URL",
    );

    // Verify scenario logs
    const logs = listLogsByScenario("flowforge_happy_path");
    assert.ok(logs.length >= 2, "flowforge_happy_path logs should have start + success events");
    const events = logs.map((log) => log.event);
    assert.ok(events.includes("start"), "custom agent logs must include start");
    assert.ok(events.includes("success"), "custom agent logs must include success");
    assert.ok(logs.every((log) => Boolean(log.scenarioId)), "all custom logs should include scenarioId");

    // Agent should reach completed status
    const finalAgent = getAgentById(agent.id);
    assert.equal(finalAgent?.status, "completed");
});

test("custom agent without instructions uses default prompt", async () => {
    resetAll();

    const agent = createAgent("custom", {
        targetUrl: CUSTOM_TARGET_URL,
        taskType: "custom",
    });

    const result = await triggerAgentRun(agent.id, "manual");
    const browserTask = getBrowserUseClient().snapshot(String(result.browserTaskId));
    assert.ok(browserTask, "browser task should exist");

    // Without instructions, should fall back to default prompt
    assert.ok(
        browserTask?.taskPrompt,
        "browser task should have a prompt even without explicit instructions",
    );
});

test("custom agent without target URL still runs", async () => {
    resetAll();

    const agent = createAgent("custom", {
        instructions: CUSTOM_NL_PROMPT,
        taskType: "custom",
    });

    const result = await triggerAgentRun(agent.id, "manual");
    const browserTask = getBrowserUseClient().snapshot(String(result.browserTaskId));
    assert.ok(browserTask, "browser task should exist");

    assert.ok(
        browserTask?.taskPrompt?.includes(CUSTOM_NL_PROMPT),
        "prompt should contain instructions even without targetUrl",
    );
    assert.equal(browserTask?.startUrl, undefined, "startUrl should be undefined when no targetUrl configured");
});
