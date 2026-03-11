import { deleteDoc, getDoc, queryByIndex } from "./db";
import { notFoundError } from "./errors";
import { toAgentRecord } from "./records";
import type { AgentRecord } from "../types/contracts";

/**
 * Shared helper to fetch an agent by ID or throw NOT_FOUND.
 * Used by agents.ts, orchestrator.ts, and other handlers.
 */
export async function getAgentOrThrow(
  ctx: any,
  agentId: string
): Promise<AgentRecord> {
  const agentDoc = await getDoc<Omit<AgentRecord, "id">>(ctx, agentId);

  if (!agentDoc) {
    throw notFoundError("agent not found", { agentId });
  }

  return toAgentRecord(agentDoc as any);
}

/**
 * Cascade-delete all records in `table` linked to the given agentId
 * via a `by_agentId` index.
 */
export async function deleteByAgentId(
  ctx: any,
  table: string,
  agentId: string
): Promise<void> {
  const docs = await queryByIndex<Record<string, unknown>>(
    ctx,
    table,
    "by_agentId",
    [["agentId", agentId]]
  );

  await Promise.all(docs.map((doc) => deleteDoc(ctx, doc._id)));
}
