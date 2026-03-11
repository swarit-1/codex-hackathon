"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, FilterBar, MarketplaceCard, SectionHeading } from "../../components/shared";
import {
  useConvexEnabled,
  useMarketplaceCategories,
  useMarketplaceInstall,
  useMarketplaceTemplates,
  useRequireCurrentUser,
} from "../../lib/hooks";
import { getErrorMessage, slugifyCategory, type EditableConfigValue } from "../../lib/utils";
import type { MarketplaceTemplate } from "../../lib/contracts/types";

export default function MarketplacePage() {
  const router = useRouter();
  const convexEnabled = useConvexEnabled();
  const { isReady, isLoading, needsOnboarding } = useRequireCurrentUser();
  const { templates: devTemplates } = useMarketplaceTemplates("dev");
  const { templates: studentTemplates } = useMarketplaceTemplates("student");
  const categories = useMarketplaceCategories();
  const installTemplate = useMarketplaceInstall();
  const [activeCategory, setActiveCategory] = useState("all");
  const [installingTemplateId, setInstallingTemplateId] = useState<string | null>(null);
  const [installErrorByTemplate, setInstallErrorByTemplate] = useState<Record<string, string | null>>(
    {}
  );

  const filteredDevTemplates = useMemo(
    () =>
      devTemplates.filter((template) =>
        activeCategory === "all" ? true : slugifyCategory(template.category) === activeCategory
      ),
    [activeCategory, devTemplates]
  );
  const filteredStudentTemplates = useMemo(
    () =>
      studentTemplates.filter((template) =>
        activeCategory === "all" ? true : slugifyCategory(template.category) === activeCategory
      ),
    [activeCategory, studentTemplates]
  );

  if (convexEnabled && !isReady) {
    return (
      <AppShell currentPath="/marketplace">
        <section className="page-section">
          <p className="empty-state">
            {isLoading || needsOnboarding ? "Loading account..." : "Preparing marketplace..."}
          </p>
        </section>
      </AppShell>
    );
  }

  const handleInstall = async (
    template: MarketplaceTemplate,
    currentValues: Record<string, EditableConfigValue>
  ) => {
    setInstallingTemplateId(template.id);
    setInstallErrorByTemplate((currentErrors) => ({
      ...currentErrors,
      [template.id]: null,
    }));

    try {
      const result = await installTemplate(template, currentValues);

      if (!result) {
        return;
      }

      router.push("/my-agents");
    } catch (error) {
      setInstallErrorByTemplate((currentErrors) => ({
        ...currentErrors,
        [template.id]: getErrorMessage(error, "Template installation failed."),
      }));
    } finally {
      setInstallingTemplateId(null);
    }
  };

  return (
    <AppShell currentPath="/marketplace">
      <section className="page-section intro-section">
        <SectionHeading
          title="Marketplace"
          description="Browse official LonghorNet workflows and reviewed student submissions from one catalog."
          actionHref="/my-agents"
          actionLabel="Go to My Agents"
        />
        <FilterBar activeValue={activeCategory} onChange={setActiveCategory} options={categories} />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Official templates"
          description="These are the flagship workflows maintained by the LonghorNet team."
        />
        {filteredDevTemplates.length > 0 ? (
          <div className="card-grid two-up">
            {filteredDevTemplates.map((template) => (
              <MarketplaceCard
                installControls={
                  convexEnabled
                    ? {
                        enabled: true,
                        isInstalling: installingTemplateId === template.id,
                        error: installErrorByTemplate[template.id] ?? null,
                        onInstall: handleInstall,
                      }
                    : undefined
                }
                key={template.id}
                template={template}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">No official templates match this category yet.</p>
        )}
      </section>

      <section className="page-section">
        <SectionHeading
          title="Student-built workflows"
          description="Community templates appear with moderation state, install traction, and setup expectations."
          actionHref="/studio"
          actionLabel="Build a workflow"
        />
        {filteredStudentTemplates.length > 0 ? (
          <div className="card-grid three-up">
            {filteredStudentTemplates.map((template) => (
              <MarketplaceCard
                installControls={
                  convexEnabled
                    ? {
                        enabled: true,
                        isInstalling: installingTemplateId === template.id,
                        error: installErrorByTemplate[template.id] ?? null,
                        onInstall: handleInstall,
                      }
                    : undefined
                }
                key={template.id}
                template={template}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">No student-built workflows match this category yet.</p>
        )}
      </section>
    </AppShell>
  );
}
