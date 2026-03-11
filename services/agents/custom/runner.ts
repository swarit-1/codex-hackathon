import {
    appendLog,
    updateAgentById,
} from "../shared/runtimeAdapters.ts";
import type { AgentRecord, RuntimeRunContext } from "../../../convex/types/contracts.ts";

export interface CustomRunResult {
    [key: string]: unknown;
    status: "completed";
    prompt: string;
}

/**
 * Runner for Studio-generated (custom) agents.
 *
 * The actual browser automation is driven by the task prompt forwarded to
 * Browser Use in the orchestrator. This runner provides the lifecycle
 * wrapper (start → success logs, status updates) that matches the pattern
 * used by ScholarBot and RegBot runners.
 */
export function runCustomAgent(agent: AgentRecord, context: RuntimeRunContext): CustomRunResult {
    const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
    const instructions = typeof configObj.instructions === "string" ? configObj.instructions : "";

    appendLog({
        agentId: agent.id,
        event: "start",
        scenarioId: context.scenarioId,
        details: {
            runId: context.runId,
            message: "Custom agent run started",
            prompt: instructions,
        },
    });

    updateAgentById(agent.id, {
        status: "completed",
        lastRunStatus: "success",
        lastRunAt: new Date().toISOString(),
    });

    appendLog({
        agentId: agent.id,
        event: "success",
        scenarioId: context.scenarioId,
        details: {
            runId: context.runId,
            message: "Custom agent run completed",
        },
    });

    return {
        status: "completed",
        prompt: instructions,
    };
}
