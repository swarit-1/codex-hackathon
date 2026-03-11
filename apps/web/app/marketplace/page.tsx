"use client";

import { AppShell, FilterBar, MarketplaceCard, SectionHeading } from "../../components/shared";
import { useMarketplaceTemplates, useMarketplaceCategories } from "../../lib/hooks";

export default function MarketplacePage() {
  const { templates: devTemplates } = useMarketplaceTemplates("dev");
  const { templates: studentTemplates } = useMarketplaceTemplates("student");
  const categories = useMarketplaceCategories();

  return (
    <AppShell currentPath="/marketplace">
      <section className="page-section intro-section">
        <SectionHeading
          title="Marketplace"
          description="Browse official LonghorNet workflows and reviewed student submissions from one catalog."
        />
        <FilterBar options={categories} />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Official templates"
          description="These are the flagship workflows maintained by the LonghorNet team."
        />
        <div className="card-grid two-up">
          {devTemplates.map((template) => (
            <MarketplaceCard key={template.id} template={template} />
          ))}
        </div>
      </section>

      <section className="page-section">
        <SectionHeading
          title="Student-built workflows"
          description="Community templates appear with moderation state, install traction, and setup expectations."
        />
        <div className="card-grid three-up">
          {studentTemplates.map((template) => (
            <MarketplaceCard key={template.id} template={template} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
