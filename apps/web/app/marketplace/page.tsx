import { AppShell, FilterBar, MarketplaceCard, SectionHeading } from "../../components/shared";
import { marketplaceCategories, marketplaceTemplates } from "../../lib/contracts/mock-data";

const devTemplates = marketplaceTemplates.filter((template) => template.source === "dev");
const studentTemplates = marketplaceTemplates.filter((template) => template.source === "student");

export default function MarketplacePage() {
  return (
    <AppShell currentPath="/marketplace">
      <section className="page-section intro-section">
        <SectionHeading
          title="Marketplace"
          description="Browse official LonghorNet workflows and reviewed student submissions from one catalog."
        />
        <FilterBar options={marketplaceCategories} />
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
