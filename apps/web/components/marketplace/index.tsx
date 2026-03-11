"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell, MarketplaceCard, MarketplaceHero, SectionHeading } from "../shared";
import {
  useConvexEnabled,
  useInstalledAgents,
  useMarketplaceCategories,
  useMarketplaceInstall,
  useMarketplaceTemplates,
  useRequireCurrentUser,
} from "../../lib/hooks";
import { getErrorMessage } from "../../lib/utils";

export function MarketplaceView({ currentPath }: { currentPath: string }) {
  const router = useRouter();
  const convexEnabled = useConvexEnabled();
  const { isReady, isLoading: isUserLoading, needsOnboarding } = useRequireCurrentUser();
  const { templates, isLoading } = useMarketplaceTemplates();
  const { agents } = useInstalledAgents();
  const installTemplate = useMarketplaceInstall();
  const categories = useMarketplaceCategories();
  const [activeCategory, setActiveCategory] = useState("all");
  const [installingTemplateId, setInstallingTemplateId] = useState<string | null>(null);
  const [installErrorByTemplate, setInstallErrorByTemplate] = useState<Record<string, string | null>>({});

  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) =>
        activeCategory === "all"
          ? true
          : template.category.toLowerCase().replace(/\s+/g, "-") === activeCategory
      ),
    [activeCategory, templates]
  );

  const featuredTemplates = filteredTemplates.filter((template) => template.source === "dev").slice(0, 3);
  const communityTemplates = filteredTemplates.filter((template) => template.source === "student");
  const catalogTemplates = [...featuredTemplates, ...communityTemplates];
  const installedTemplateIds = useMemo(
    () => new Set(agents.map((agent) => agent.templateId).filter(Boolean)),
    [agents]
  );

  if (convexEnabled && !isReady) {
    return (
      <AppShell currentPath={currentPath}>
        <section className="page-section">
          <p className="empty-state">
            {isUserLoading || needsOnboarding ? "Loading account..." : "Preparing marketplace..."}
          </p>
        </section>
      </AppShell>
    );
  }

  const handleInstall = async (
    template: (typeof templates)[number],
    currentValues: Record<string, string | boolean>
  ) => {
    setInstallingTemplateId(template.id);
    setInstallErrorByTemplate((current) => ({
      ...current,
      [template.id]: null,
    }));

    try {
      const result = await installTemplate(template, currentValues);

      if (!result) {
        throw new Error("Install is unavailable until you are signed in.");
      }

      router.push("/my-agents");
    } catch (error) {
      setInstallErrorByTemplate((current) => ({
        ...current,
        [template.id]: getErrorMessage(error, "Template install failed."),
      }));
    } finally {
      setInstallingTemplateId(null);
    }
  };

  return (
    <AppShell currentPath={currentPath}>
      <section className="market-topbar">
        <div className="market-controls">
          <div className="market-search-shell">
            <span className="market-search-icon" aria-hidden="true">
              Search
            </span>
            <input
              aria-label="Search workflows"
              className="market-search"
              placeholder="Search workflows"
              type="search"
            />
          </div>
          <label className="market-filter-shell">
            <span className="market-filter-label">Category</span>
            <select
              aria-label="Filter workflows by category"
              className="market-select"
              onChange={(event) => setActiveCategory(event.target.value)}
              value={activeCategory}
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="market-actions">
          <button className="utility-button" type="button">
            Grid
          </button>
          <button className="utility-button" type="button">
            Account
          </button>
        </div>
      </section>

      <div className="market-layout">
        <div className="market-main">
          <MarketplaceHero />

          <section className="market-section">
            <SectionHeading
              title="Official picks"
              actionHref="/my-agents"
              actionLabel="My Agents"
            />
            {isLoading ? (
              <p className="empty-state">Loading official workflows...</p>
            ) : featuredTemplates.length > 0 ? (
              <div className="store-grid featured">
                {featuredTemplates.map((template) => (
                  <MarketplaceCard
                    key={`featured-${template.id}`}
                    template={template}
                    installControls={
                      convexEnabled
                        ? {
                            enabled: true,
                            isInstalling: installingTemplateId === template.id,
                            isInstalled: installedTemplateIds.has(template.id),
                            error: installErrorByTemplate[template.id] ?? null,
                            onInstall: handleInstall,
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="empty-state">No official workflows match this category yet.</p>
            )}
          </section>

          <section className="market-section">
            <SectionHeading
              title="Browse workflows"
              actionHref="/studio"
              actionLabel="Publish"
            />
            {isLoading ? (
              <p className="empty-state">Loading marketplace catalog...</p>
            ) : catalogTemplates.length > 0 ? (
              <div className="store-grid catalog">
                {catalogTemplates.map((template) => (
                  <MarketplaceCard
                    key={template.id}
                    template={template}
                    installControls={
                      convexEnabled
                        ? {
                            enabled: true,
                            isInstalling: installingTemplateId === template.id,
                            isInstalled: installedTemplateIds.has(template.id),
                            error: installErrorByTemplate[template.id] ?? null,
                            onInstall: handleInstall,
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="empty-state">No workflows match this category yet.</p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
