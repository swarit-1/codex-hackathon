import { action } from "./_generated/server";
import {
  buildAgentScriptResult,
  buildWorkflowSpecResultWithOpenAI,
} from "./lib/flowforge";
import { validationError } from "./lib/errors";
import {
  flowforgeGenerateAgentScriptArgs,
  flowforgeGenerateWorkflowSpecArgs,
} from "./lib/validators";
import type {
  FlowforgeAgentScriptResult,
  FlowforgeWorkflowSpecResult,
  JsonValue,
} from "./types/contracts";

export const generateWorkflowSpec = action({
  args: flowforgeGenerateWorkflowSpecArgs,
  handler: async (_ctx, args): Promise<FlowforgeWorkflowSpecResult> => {
    if (!args.nlDescription.trim()) {
      throw validationError("nlDescription is required");
    }

    return buildWorkflowSpecResultWithOpenAI(args.nlDescription);
  },
});

export const generateAgentScript = action({
  args: flowforgeGenerateAgentScriptArgs,
  handler: async (_ctx, args): Promise<FlowforgeAgentScriptResult> => {
    if (args.spec === null || args.spec === undefined) {
      throw validationError("spec is required");
    }

    return buildAgentScriptResult(args.spec as JsonValue);
  },
});
