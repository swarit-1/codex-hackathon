import type { MutationCtx } from "../_generated/server";
import type {
  AgentLogRecord,
  JsonValue,
  LogLevel,
  ScenarioId,
} from "../types/contracts";
import { insertDoc } from "./db";

export async function appendAgentLog(
  ctx: MutationCtx,
  args: {
    agentId: string;
    event: string;
    level?: LogLevel;
    details: JsonValue;
    screenshots?: string[];
    scenarioId?: ScenarioId;
    timestamp?: number;
  }
): Promise<AgentLogRecord> {
  const timestamp = args.timestamp ?? Date.now();
  const id = await insertDoc(ctx, "agentLogs", {
    agentId: args.agentId,
    timestamp,
    event: args.event,
    level: args.level ?? "info",
    details: args.details,
    screenshots: args.screenshots,
    scenarioId: args.scenarioId,
  });

  return {
    id,
    agentId: args.agentId,
    timestamp,
    event: args.event,
    level: args.level ?? "info",
    details: args.details,
    screenshots: args.screenshots,
    scenarioId: args.scenarioId,
  };
}
