import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkflowSpecResultFromCompiled,
  buildWorkflowSpecResultWithOpenAI,
  compileWorkflowSpecWithOpenAI,
} from "../../../convex/lib/flowforge.ts";

function buildMockFetchWithContent(content: unknown): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(content),
            },
          },
        ],
      }),
    }) as Response) as typeof fetch;
}

test("compileWorkflowSpecWithOpenAI parses valid structured response", async () => {
  const compiled = await compileWorkflowSpecWithOpenAI("Find UT research opportunities", {
    apiKey: "test-api-key",
    model: "gpt-test",
    fetchImpl: buildMockFetchWithContent({
      title: "UT Research Finder",
      summary: "Monitor UT pages for new research opportunities.",
      templateType: "custom",
      steps: ["Open UT page", "Collect listings", "Summarize findings"],
      browserTaskPrompt: "Navigate to https://example.com and summarize open opportunities.",
      startUrl: "https://example.com",
      mcpMeta: {
        useContext7: true,
        useSequentialThinking: true,
        context7QueryPlan: "Query official docs before execution.",
        sequentialThinkingPlan: "Plan then execute one step at a time.",
      },
    }),
  });

  assert.equal(compiled.templateType, "custom");
  assert.equal(compiled.startUrl, "https://example.com/");
  assert.equal(compiled.steps.length, 3);
  assert.equal(compiled.mcpMeta.useContext7, true);
  assert.equal(compiled.mcpMeta.useSequentialThinking, true);
  assert.match(compiled.browserTaskPrompt, /MCP REQUIREMENTS \(MANDATORY\)/);
});

test("compileWorkflowSpecWithOpenAI fails on malformed JSON", async () => {
  const malformedFetch = (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "not-json" } }],
      }),
    }) as Response) as typeof fetch;

  await assert.rejects(
    () =>
      compileWorkflowSpecWithOpenAI("Check classes", {
        apiKey: "test-api-key",
        fetchImpl: malformedFetch,
      }),
    /malformed JSON/
  );
});

test("compileWorkflowSpecWithOpenAI fails when required fields are missing", async () => {
  await assert.rejects(
    () =>
      compileWorkflowSpecWithOpenAI("Check classes", {
        apiKey: "test-api-key",
        fetchImpl: buildMockFetchWithContent({
          title: "Missing start URL",
          summary: "Incomplete payload",
          templateType: "custom",
          steps: ["Step 1"],
          browserTaskPrompt: "Do something useful",
          mcpMeta: {
            useContext7: true,
            useSequentialThinking: true,
            context7QueryPlan: "Lookup docs",
            sequentialThinkingPlan: "Plan and execute",
          },
        }),
      }),
    /startUrl/
  );
});

test("compileWorkflowSpecWithOpenAI fails fast when OPENAI_API_KEY is unavailable", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    await assert.rejects(
      () => compileWorkflowSpecWithOpenAI("Check classes"),
      /OPENAI_API_KEY is required/
    );
  } finally {
    if (previousApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousApiKey;
    }
  }
});

test("buildWorkflowSpecResultFromCompiled persists runtime artifacts in spec and config", () => {
  const result = buildWorkflowSpecResultFromCompiled("Monitor UT scholarships", {
    title: "Scholarship Watch",
    summary: "Track and summarize scholarships.",
    templateType: "scholar",
    steps: ["Open scholarship page", "Scan new items", "Report matches"],
    browserTaskPrompt: "Navigate to https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search and scan listings.",
    startUrl: "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search",
    mcpMeta: {
      useContext7: true,
      useSequentialThinking: true,
      context7QueryPlan: "Use docs before extraction.",
      sequentialThinkingPlan: "Plan and execute each step.",
    },
  });

  const specRuntime = (result.spec.runtime ?? {}) as Record<string, unknown>;
  assert.equal(specRuntime.startUrl, "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search");
  assert.equal(typeof specRuntime.browserTaskPrompt, "string");
  assert.equal(typeof specRuntime.mcpMeta, "object");

  const defaultConfig = result.draftPayload.templateConfig.defaultConfig as Record<string, unknown>;
  const currentConfig = result.draftPayload.templateConfig.currentConfig as Record<string, unknown>;
  assert.equal(defaultConfig.startUrl, "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search");
  assert.equal(defaultConfig.targetUrl, "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search");
  assert.equal(typeof defaultConfig.browserTaskPrompt, "string");
  assert.equal(typeof defaultConfig.mcpMeta, "object");
  assert.equal(currentConfig.startUrl, "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search");
});

test("buildWorkflowSpecResultWithOpenAI returns actionable error when compiler call fails", async () => {
  const failingFetch = (async () =>
    ({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }) as Response) as typeof fetch;

  await assert.rejects(
    () =>
      buildWorkflowSpecResultWithOpenAI("Monitor scholarships", {
        apiKey: "bad-key",
        fetchImpl: failingFetch,
      }),
    /OpenAI prompt compiler error/
  );
});
