import type { MutationCtx, QueryCtx } from "../_generated/server";
import { insertDoc, patchDoc, queryByIndexRecent } from "./db";
import { toAgentRunRecord } from "./records";
import type {
  AgentRunErrorCategory,
  AgentRunPhase,
  AgentRunRecord,
  AgentRunTrackingStatus,
  JsonObject,
  RuntimeRunType,
} from "../types/contracts";

type ConvexCtx = MutationCtx | QueryCtx;

export async function createAgentRun(
  ctx: MutationCtx,
  args: {
    userId: string;
    agentId: string;
    triggerType: RuntimeRunType;
    status?: AgentRunTrackingStatus;
    phase?: AgentRunPhase;
    summary?: string;
    resultCounts?: JsonObject;
    browserUseTaskId?: string;
    liveUrl?: string;
    error?: string;
    errorCategory?: AgentRunErrorCategory;
  }
): Promise<AgentRunRecord> {
  const timestamp = Date.now();
  const id = await insertDoc(ctx, "agentRuns", {
    userId: args.userId,
    agentId: args.agentId,
    triggerType: args.triggerType,
    status: args.status ?? "queued",
    phase: args.phase ?? "queued",
    startedAt: timestamp,
    updatedAt: timestamp,
    endedAt: undefined,
    browserUseTaskId: args.browserUseTaskId,
    liveUrl: args.liveUrl,
    summary: args.summary,
    resultCounts: args.resultCounts,
    error: args.error,
    errorCategory: args.errorCategory,
  });

  return {
    id,
    userId: args.userId,
    agentId: args.agentId,
    triggerType: args.triggerType,
    status: args.status ?? "queued",
    phase: args.phase ?? "queued",
    startedAt: timestamp,
    updatedAt: timestamp,
    browserUseTaskId: args.browserUseTaskId,
    liveUrl: args.liveUrl,
    summary: args.summary,
    resultCounts: args.resultCounts,
    error: args.error,
    errorCategory: args.errorCategory,
  };
}

export async function patchAgentRun(
  ctx: MutationCtx,
  runId: string,
  patch: Partial<Omit<AgentRunRecord, "id" | "userId" | "agentId" | "triggerType" | "startedAt">>
): Promise<void> {
  await patchDoc(ctx, runId, {
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  });
}

export async function getLatestAgentRun(
  ctx: ConvexCtx,
  agentId: string
): Promise<AgentRunRecord | null> {
  const docs = await queryByIndexRecent<Omit<AgentRunRecord, "id">>(
    ctx,
    "agentRuns",
    "by_agentId_updatedAt",
    [["agentId", agentId]],
    1
  );

  const latest = docs[0];
  return latest ? toAgentRunRecord(latest as any) : null;
}
