import { action, mutation, query } from "../_generated/server";
import type { PaginatedResult } from "../types/contracts";
import { phaseNotImplementedError } from "./errors";

export const PHASE_2_NOT_IMPLEMENTED = "PHASE_2_NOT_IMPLEMENTED";

export function throwPhase2NotImplemented(functionName: string): never {
  throw phaseNotImplementedError(functionName, 2);
}

export function emptyPaginatedResult<T>(): PaginatedResult<T> {
  return {
    items: [],
    nextCursor: null,
  };
}

export function createNullQuery<TResult>(
  args: any,
  _functionName: string
) {
  return query({
    args,
    handler: async (): Promise<TResult | null> => null,
  });
}

export function createEmptyListQuery<TItem>(
  args: any,
  _functionName: string
) {
  return query({
    args,
    handler: async () => emptyPaginatedResult<TItem>(),
  });
}

export function createNotImplementedQuery<TResult = never>(
  args: any,
  functionName: string
) {
  return query({
    args,
    handler: async (): Promise<TResult> => throwPhase2NotImplemented(functionName),
  });
}

export function createNotImplementedMutation<TResult = never>(
  args: any,
  functionName: string
) {
  return mutation({
    args,
    handler: async (): Promise<TResult> => throwPhase2NotImplemented(functionName),
  });
}

export function createNotImplementedAction<TResult = never>(
  args: any,
  functionName: string
) {
  return action({
    args,
    handler: async (): Promise<TResult> => throwPhase2NotImplemented(functionName),
  });
}
