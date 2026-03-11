import { action, mutation, query, type ValidatorMap } from "../_generated/server";
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

export function createNullQuery<TResult, TArgs = Record<string, unknown>>(
  args: ValidatorMap,
  _functionName: string
) {
  return query<TArgs, TResult | null>({
    args,
    handler: async () => null,
  });
}

export function createEmptyListQuery<TItem, TArgs = Record<string, unknown>>(
  args: ValidatorMap,
  _functionName: string
) {
  return query<TArgs, PaginatedResult<TItem>>({
    args,
    handler: async () => emptyPaginatedResult<TItem>(),
  });
}

export function createNotImplementedQuery<TResult = never, TArgs = Record<string, unknown>>(
  args: ValidatorMap,
  functionName: string
) {
  return query<TArgs, TResult>({
    args,
    handler: async () => throwPhase2NotImplemented(functionName),
  });
}

export function createNotImplementedMutation<TResult = never, TArgs = Record<string, unknown>>(
  args: ValidatorMap,
  functionName: string
) {
  return mutation<TArgs, TResult>({
    args,
    handler: async () => throwPhase2NotImplemented(functionName),
  });
}

export function createNotImplementedAction<TResult = never, TArgs = Record<string, unknown>>(
  args: ValidatorMap,
  functionName: string
) {
  return action<TArgs, TResult>({
    args,
    handler: async () => throwPhase2NotImplemented(functionName),
  });
}
