"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell, MarketplaceHero, MarketplaceTile, SectionHeading } from "../shared";
import {
  useCurrentUser,
  useMarketplaceCategories,
  useMarketplaceInstall,
  useMarketplaceTemplates,
} from "../../lib/hooks";
import { getEditableConfigValues, getErrorMessage } from "../../lib/utils";
import type { MarketplaceTemplate } from "../../lib/contracts/types";

export function MarketplaceView({ currentPath }: { currentPath: string }) {
  const router = useRouter();
  const { sessionToken } = useCurrentUser();
  const { templates, isLoading } = useMarketplaceTemplates();
  const installTemplate = useMarketplaceInstall();
  const categories = useMarketplaceCategories();

  const [activeCategory, setActiveCategory] = useState("all");
  const [installError, setInstallError] = useState<string | null>(null);

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

  const handleInstall = async (
    template: MarketplaceTemplate,
    currentValues = getEditableConfigValues(template.templateConfig)
  ) => {
    setInstallError(null);
    const result = await installTemplate(template, currentValues);

    if (!result && sessionToken) {
      setInstallError("Workflow install failed.");
      return;
    }

    if (!result) {
      router.push(`/login?next=${encodeURIComponent("/marketplace")}`);
      return;
    }

    router.push("/my-agents");
  };

  const handleAccountClick = () => {
    router.push(sessionToken ? "/settings" : "/onboarding");
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
          <button className="utility-button" onClick={handleAccountClick} type="button">
            {sessionToken ? "Account" : "Sign up"}
          </button>
        </div>
      </section>

      {installError ? (
        <section className="page-section">
          <p className="form-message error">{installError}</p>
        </section>
      ) : null}

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
                  <MarketplaceTile
                    key={`featured-${template.id}`}
                    template={template}
                    onInstall={async (selectedTemplate, currentValues) => {
                      try {
                        await handleInstall(selectedTemplate, currentValues);
                      } catch (error) {
                        setInstallError(getErrorMessage(error, "Workflow install failed."));
                      }
                    }}
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
                  <MarketplaceTile
                    key={template.id}
                    template={template}
                    onInstall={async (selectedTemplate, currentValues) => {
                      try {
                        await handleInstall(selectedTemplate, currentValues);
                      } catch (error) {
                        setInstallError(getErrorMessage(error, "Workflow install failed."));
                      }
                    }}
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
