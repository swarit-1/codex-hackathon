import type { ActionCtx, MutationCtx } from "../_generated/server";
import type {
  AgentLogRecord,
  AgentRunPhase,
  JsonValue,
  LogLevel,
  ScenarioId,
} from "../types/contracts";
import { insertDoc } from "./db";

export async function appendAgentLog(
  ctx: MutationCtx | ActionCtx,
  args: {
    agentId: string;
    runId?: string;
    event: string;
    level?: LogLevel;
    details: any;
    screenshots?: string[];
    scenarioId?: ScenarioId;
    phase?: AgentRunPhase;
    timestamp?: number;
  }
): Promise<AgentLogRecord> {
  const timestamp = args.timestamp ?? Date.now();
  const id = await insertDoc(ctx, "agentLogs", {
    agentId: args.agentId,
    runId: args.runId,
    timestamp,
    event: args.event,
    level: args.level ?? "info",
    details: args.details,
    screenshots: args.screenshots,
    scenarioId: args.scenarioId,
    phase: args.phase,
  });

  return {
    id,
    agentId: args.agentId,
    runId: args.runId,
    timestamp,
    event: args.event,
    level: args.level ?? "info",
    details: args.details,
    screenshots: args.screenshots,
    scenarioId: args.scenarioId,
    phase: args.phase,
  };
}
