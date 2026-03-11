import { getRuntimeStore, nextId } from "./runtimeStore.ts";
import type { PendingActionRecord, PendingActionType } from "./types/contracts.ts";

export interface CreatePendingActionInput {
  userId: string;
  agentId: string;
  type: PendingActionType;
  prompt: string;
}

export function create(payload: CreatePendingActionInput): PendingActionRecord {
  const store = getRuntimeStore();
  const action: PendingActionRecord = {
    id: nextId("pending_action"),
    userId: payload.userId,
    agentId: payload.agentId,
    type: payload.type,
    prompt: payload.prompt,
    createdAt: new Date().toISOString(),
  };

  store.pendingActions.set(action.id, action);
  return action;
}

export function resolve(actionId: string, response: string): PendingActionRecord {
  const store = getRuntimeStore();
  const action = store.pendingActions.get(actionId);
  if (!action) {
    throw new Error(`Pending action not found: ${actionId}`);
  }

  const updated: PendingActionRecord = {
    ...action,
    response,
    resolvedAt: new Date().toISOString(),
  };

  store.pendingActions.set(actionId, updated);
  return updated;
}

export function getById(actionId: string): PendingActionRecord | undefined {
  return getRuntimeStore().pendingActions.get(actionId);
}

export function listByAgent(agentId: string): PendingActionRecord[] {
  return [...getRuntimeStore().pendingActions.values()].filter((action) => action.agentId === agentId);
}
