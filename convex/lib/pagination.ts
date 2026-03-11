import type { PaginatedResult, PaginationArgs } from "../types/contracts";

const DEFAULT_PAGE_SIZE = 25;

export function decodeCursor(cursor?: string): number {
  if (!cursor) {
    return 0;
  }

  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const offset = Number.parseInt(decoded, 10);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64");
}

export function paginateItems<T>(
  items: T[],
  pagination: PaginationArgs
): PaginatedResult<T> {
  const offset = decodeCursor(pagination.cursor);
  const limit = pagination.limit && pagination.limit > 0 ? pagination.limit : DEFAULT_PAGE_SIZE;
  const pagedItems = items.slice(offset, offset + limit);
  const nextOffset = offset + pagedItems.length;

  return {
    items: pagedItems,
    nextCursor: nextOffset < items.length ? encodeCursor(nextOffset) : null,
  };
}
