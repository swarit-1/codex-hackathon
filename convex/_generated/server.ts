export type ValidatorMap = Record<string, unknown>;

export interface QueryCtx {
  db: unknown;
  auth: unknown;
}

export interface MutationCtx extends QueryCtx {
  scheduler: unknown;
}

export interface ActionCtx extends QueryCtx {
  runQuery: unknown;
  runMutation: unknown;
  runAction: unknown;
  scheduler: unknown;
}

interface FunctionDefinition<TArgs, TResult, TCtx> {
  args: ValidatorMap;
  handler: (ctx: TCtx, args: TArgs) => TResult | Promise<TResult>;
}

export function query<TArgs, TResult>(definition: FunctionDefinition<TArgs, TResult, QueryCtx>) {
  return definition;
}

export function mutation<TArgs, TResult>(
  definition: FunctionDefinition<TArgs, TResult, MutationCtx>
) {
  return definition;
}

export function action<TArgs, TResult>(definition: FunctionDefinition<TArgs, TResult, ActionCtx>) {
  return definition;
}

export function internalQuery<TArgs, TResult>(
  definition: FunctionDefinition<TArgs, TResult, QueryCtx>
) {
  return definition;
}

export function internalMutation<TArgs, TResult>(
  definition: FunctionDefinition<TArgs, TResult, MutationCtx>
) {
  return definition;
}

export function internalAction<TArgs, TResult>(
  definition: FunctionDefinition<TArgs, TResult, ActionCtx>
) {
  return definition;
}
