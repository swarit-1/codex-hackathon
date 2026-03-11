"use client";

import { useMemo } from "react";
import {
  marketplaceTemplates as mockTemplates,
  marketplaceCategories,
} from "../contracts/mock-data";
import type {
  FilterOption,
  MarketplaceTemplate,
  TemplateSource,
} from "../contracts/types";

/**
 * Returns marketplace templates, optionally filtered by source.
 *
 * Uses mock data by default. When Convex is configured, swap to:
 *   const result = useQuery(api.marketplace.listTemplates, { source });
 *   return { templates: result?.items.map(toMarketplaceTemplate) ?? [], isLoading: !result };
 */
export function useMarketplaceTemplates(source?: TemplateSource): {
  templates: MarketplaceTemplate[];
  isLoading: boolean;
} {
  const templates = useMemo(
    () =>
      source
        ? mockTemplates.filter((t) => t.source === source)
        : mockTemplates,
    [source]
  );

  return { templates, isLoading: false };
}

export function useMarketplaceCategories(): FilterOption[] {
  return marketplaceCategories;
}
