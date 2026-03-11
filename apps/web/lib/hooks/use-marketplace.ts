"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { marketplaceTemplates as mockTemplates, marketplaceCategories } from "../contracts/mock-data";
import type {
  FilterOption,
  MarketplaceTemplate,
  TemplateSource,
} from "../contracts/types";
import { toMarketplaceTemplate } from "../mappers";
import { buildConfigEnvelope, buildMarketplaceCategories, type EditableConfigValue } from "../utils";
import { useConvexEnabled } from "./use-convex-enabled";
import { useCurrentUser } from "./use-demo-user";

let didRequestCatalogBootstrap = false;

function useCatalogBootstrap(devTemplateCount?: number) {
  const convexEnabled = useConvexEnabled();
  const bootstrapCatalog = useMutation(api.demo.bootstrapCatalog);

  useEffect(() => {
    if (!convexEnabled || devTemplateCount === undefined || devTemplateCount > 0 || didRequestCatalogBootstrap) {
      return;
    }

    didRequestCatalogBootstrap = true;
    void bootstrapCatalog({}).catch(() => {
      didRequestCatalogBootstrap = false;
    });
  }, [bootstrapCatalog, convexEnabled, devTemplateCount]);
}

export function useMarketplaceTemplates(source?: TemplateSource): {
  templates: MarketplaceTemplate[];
  isLoading: boolean;
} {
  const convexEnabled = useConvexEnabled();
  const devResult = useQuery(
    api.marketplace.listTemplates,
    convexEnabled && (!source || source === "dev")
      ? {
          source: "dev",
          visibility: "public",
        }
      : "skip"
  );
  const studentResult = useQuery(
    api.marketplace.listTemplates,
    convexEnabled && (!source || source === "student")
      ? {
          source: "student",
          visibility: "public",
        }
      : "skip"
  );

  useCatalogBootstrap(devResult?.items.length);

  const templates = useMemo(() => {
    if (!convexEnabled) {
      return source ? mockTemplates.filter((template) => template.source === source) : mockTemplates;
    }

    const items =
      source === "dev"
        ? devResult?.items ?? []
        : source === "student"
          ? studentResult?.items ?? []
          : [...(devResult?.items ?? []), ...(studentResult?.items ?? [])];

    return items
      .map((record) => toMarketplaceTemplate(record as never))
      .sort((left, right) => right.installs - left.installs);
  }, [convexEnabled, devResult?.items, source, studentResult?.items]);

  return {
    templates,
    isLoading:
      convexEnabled &&
      ((source === "dev" && !devResult) ||
        (source === "student" && !studentResult) ||
        (!source && (!devResult || !studentResult))),
  };
}

export function useMarketplaceCategories(): FilterOption[] {
  const convexEnabled = useConvexEnabled();
  const { templates } = useMarketplaceTemplates();

  if (!convexEnabled) {
    return marketplaceCategories;
  }

  return buildMarketplaceCategories(templates);
}

export function useMarketplaceInstall() {
  const convexEnabled = useConvexEnabled();
  const { sessionToken, userId } = useCurrentUser();
  const installTemplateMutation = useMutation(api.marketplace.installTemplate);

  return async (
    template: MarketplaceTemplate,
    currentValues: Record<string, EditableConfigValue>
  ) => {
    if (!convexEnabled || !sessionToken || !userId) {
      return null;
    }

    return installTemplateMutation({
      sessionToken,
      templateId: template.id as Id<"marketplaceTemplates">,
      userId: userId as Id<"users">,
      config: buildConfigEnvelope(template.templateConfig, currentValues),
    });
  };
}
