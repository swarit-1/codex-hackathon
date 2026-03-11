import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";

type ConvexCtx = QueryCtx | MutationCtx | ActionCtx;

export type ConvexDoc<T extends Record<string, unknown>> = T & {
  _id: string;
  _creationTime?: number;
};

type IndexConstraint = [field: string, value: unknown];

function getDb(ctx: ConvexCtx): any {
  return (ctx as any).db;
}

export async function getDoc<T extends Record<string, unknown>>(
  ctx: ConvexCtx,
  id: string
): Promise<ConvexDoc<T> | null> {
  return (await getDb(ctx).get(id)) as ConvexDoc<T> | null;
}

export async function insertDoc<T extends Record<string, unknown>>(
  ctx: ConvexCtx,
  table: string,
  value: T
): Promise<string> {
  return (await getDb(ctx).insert(table, value)) as string;
}

export async function patchDoc<T extends Record<string, unknown>>(
  ctx: ConvexCtx,
  id: string,
  value: Partial<T>
): Promise<void> {
  await getDb(ctx).patch(id, value);
}

export async function deleteDoc(ctx: ConvexCtx, id: string): Promise<void> {
  await getDb(ctx).delete(id);
}

export async function queryAll<T extends Record<string, unknown>>(
  ctx: ConvexCtx,
  table: string
): Promise<Array<ConvexDoc<T>>> {
  return ((await getDb(ctx).query(table).collect()) ?? []) as Array<ConvexDoc<T>>;
}

export async function queryByIndex<T extends Record<string, unknown>>(
  ctx: ConvexCtx,
  table: string,
  indexName: string,
  constraints: IndexConstraint[] = []
): Promise<Array<ConvexDoc<T>>> {
  const db = getDb(ctx);
  const baseQuery = db.query(table);

  if (typeof baseQuery.withIndex === "function") {
    const indexedQuery = baseQuery.withIndex(indexName, (builder: any) =>
      constraints.reduce((accumulator, [field, value]) => accumulator.eq(field, value), builder)
    );
    return ((await indexedQuery.collect()) ?? []) as Array<ConvexDoc<T>>;
  }

  const docs = await queryAll<T>(ctx, table);
  return docs.filter((doc) => constraints.every(([field, value]) => doc[field] === value));
}
