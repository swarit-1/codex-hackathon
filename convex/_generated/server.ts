/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Stub server module for local development.
 * Replaced by `npx convex dev` when connected to a Convex deployment.
 */

export type ValidatorMap = Record<string, any>;

export interface QueryCtx {
  db: any;
  auth: any;
}

export interface MutationCtx extends QueryCtx {
  scheduler: any;
}

export interface ActionCtx extends QueryCtx {
  runQuery: any;
  runMutation: any;
  runAction: any;
  scheduler: any;
}

interface FunctionDefinition<TResult, TCtx> {
  args: ValidatorMap;
  handler: (ctx: TCtx, args: any) => TResult | Promise<TResult>;
}

export function query<TResult>(definition: FunctionDefinition<TResult, QueryCtx>) {
  return definition;
}

export function mutation<TResult>(definition: FunctionDefinition<TResult, MutationCtx>) {
  return definition;
}

export function action<TResult>(definition: FunctionDefinition<TResult, ActionCtx>) {
  return definition;
}

export function internalQuery<TResult>(definition: FunctionDefinition<TResult, QueryCtx>) {
  return definition;
}

export function internalMutation<TResult>(definition: FunctionDefinition<TResult, MutationCtx>) {
  return definition;
}

export function internalAction<TResult>(definition: FunctionDefinition<TResult, ActionCtx>) {
  return definition;
}
