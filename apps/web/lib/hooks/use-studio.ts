"use client";

import { studioDrafts as mockDrafts } from "../contracts/mock-data";
import type { StudioDraft } from "../contracts/types";

/**
 * Returns the user's studio workflow drafts.
 *
 * Uses mock data by default. When Convex is configured, swap to:
 *   const result = useQuery(api.customWorkflows.listByUser, { userId });
 *   return { drafts: result?.items.map(r => toStudioDraft(r)) ?? [], isLoading: !result };
 */
export function useStudioDrafts(): {
  drafts: StudioDraft[];
  isLoading: boolean;
} {
  return { drafts: mockDrafts, isLoading: false };
}
