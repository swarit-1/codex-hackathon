import { getRuntimeStore, nextId } from "./runtimeStore.ts";
import type { ScholarshipRecord, ScholarshipStatus } from "./types/contracts.ts";

export interface ScholarshipFilters {
  userId?: string;
  agentId?: string;
  status?: ScholarshipStatus;
}

export interface UpsertScholarshipInput {
  userId: string;
  agentId: string;
  title: string;
  source: string;
  deadline: string;
  eligibility: string;
  matchScore: number;
  status: ScholarshipStatus;
  missingFields?: string[];
}

export function upsertFromRun(payload: UpsertScholarshipInput): ScholarshipRecord {
  const store = getRuntimeStore();
  const existing = [...store.scholarships.values()].find(
    (item) => item.agentId === payload.agentId && item.title === payload.title,
  );

  const updated: ScholarshipRecord = {
    id: existing?.id ?? nextId("scholarship"),
    userId: payload.userId,
    agentId: payload.agentId,
    title: payload.title,
    source: payload.source,
    deadline: payload.deadline,
    eligibility: payload.eligibility,
    matchScore: payload.matchScore,
    status: payload.status,
    missingFields: payload.missingFields ?? existing?.missingFields ?? [],
    updatedAt: new Date().toISOString(),
  };

  store.scholarships.set(updated.id, updated);
  return updated;
}

export function listByUser(filters: ScholarshipFilters = {}): ScholarshipRecord[] {
  return [...getRuntimeStore().scholarships.values()].filter((item) => {
    if (filters.userId && item.userId !== filters.userId) {
      return false;
    }
    if (filters.agentId && item.agentId !== filters.agentId) {
      return false;
    }
    if (filters.status && item.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export function listByAgent(agentId: string): ScholarshipRecord[] {
  return listByUser({ agentId });
}
