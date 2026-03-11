"use client";

import { useMemo, useState } from "react";
import { AppShell, FilterBar, MarketplaceCard, SectionHeading } from "../../components/shared";
import { useMarketplaceTemplates, useMarketplaceCategories } from "../../lib/hooks";

export default function MarketplacePage() {
  const { templates: devTemplates } = useMarketplaceTemplates("dev");
  const { templates: studentTemplates } = useMarketplaceTemplates("student");
  const categories = useMarketplaceCategories();
  const [activeCategory, setActiveCategory] = useState("all");
  const filteredDevTemplates = useMemo(
    () =>
      devTemplates.filter((template) =>
        activeCategory === "all"
          ? true
          : template.category.toLowerCase().replace(/\s+/g, "-") === activeCategory
      ),
    [activeCategory, devTemplates]
  );
  const filteredStudentTemplates = useMemo(
    () =>
      studentTemplates.filter((template) =>
        activeCategory === "all"
          ? true
          : template.category.toLowerCase().replace(/\s+/g, "-") === activeCategory
      ),
    [activeCategory, studentTemplates]
  );

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
              <MarketplaceCard key={template.id} template={template} />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No official templates match this category yet.
          </p>
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
              <MarketplaceCard key={template.id} template={template} />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No student-built workflows match this category yet.
          </p>
        )}
      </section>
    </AppShell>
  );
}
