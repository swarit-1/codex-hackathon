import Link from "next/link";
import { AppShell, FilterBar, MarketplaceCard, SectionHeading } from "../components/shared";
import { marketplaceCategories, marketplaceTemplates } from "../lib/contracts/mock-data";

const featuredTemplates = marketplaceTemplates.filter((template) => template.source === "dev");
const communityTemplates = marketplaceTemplates.filter((template) => template.source === "student");

export default function HomePage() {
  return (
    <AppShell currentPath="/">
      <section className="landing-grid">
        <div className="landing-copy">
          <p className="kicker">UT workflow marketplace</p>
          <h1>Install the agents students need. Publish the ones they invent.</h1>
          <p className="lede">
            LonghorNet is a shared front door for registration monitors, scholarship assistants,
            and student-built browser workflows that save time across campus.
          </p>
          <div className="card-actions">
            <Link className="button-link" href="/marketplace">
              Browse workflows
            </Link>
            <Link className="button-link secondary" href="/studio">
              Build in Studio
            </Link>
          </div>
        </div>
        <div className="landing-panel">
          <h2>What the product actually is</h2>
          <ul className="plain-list">
            <li>Official agents for scholarship discovery and registration speed.</li>
            <li>Community workflows that students can install, review, and reuse.</li>
            <li>An operational workspace for pause, resume, scheduling, and logs.</li>
            <li>A Studio flow that turns natural language into a deployable browser agent.</li>
          </ul>
        </div>
      </section>

      <section className="page-section">
        <SectionHeading
          title="Featured official workflows"
          description="First-party templates anchor the marketplace and set the reliability bar for community submissions."
          actionHref="/marketplace"
          actionLabel="Open marketplace"
        />
        <div className="card-grid two-up">
          {featuredTemplates.map((template) => (
            <MarketplaceCard key={template.id} template={template} />
          ))}
        </div>
      </section>

      <section className="page-section">
        <SectionHeading
          title="Community workflows"
          description="Student-built automations live beside official templates, but with clear provenance and moderation states."
          actionHref="/studio"
          actionLabel="Publish a workflow"
        />
        <FilterBar options={marketplaceCategories} />
        <div className="card-grid three-up">
          {communityTemplates.map((template) => (
            <MarketplaceCard key={template.id} template={template} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
