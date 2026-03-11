"use client";

import { AppShell, SectionHeading, StudioQueue } from "../../components/shared";
import { useStudioDrafts } from "../../lib/hooks";

export default function StudioPage() {
  const { drafts } = useStudioDrafts();

  return (
    <AppShell currentPath="/studio">
      <section className="studio-layout">
        <div className="studio-panel studio-input">
          <SectionHeading
            title="Model-to-Agent Studio"
            description="Describe the work once, inspect the generated workflow, then deploy it privately or submit it to the marketplace."
          />
          <label className="form-field">
            <span>Describe the workflow</span>
            <textarea
              defaultValue="Watch UT scholarship and department pages for new funding opportunities, compare them to my profile, and prepare a weekly digest with anything that needs human review."
              rows={10}
            />
          </label>
          <div className="card-actions">
            <button type="button">Generate workflow</button>
            <button className="secondary" type="button">
              Load example
            </button>
          </div>
        </div>

        <div className="studio-panel studio-preview">
          <SectionHeading
            title="Generated preview"
            description="The MVP preview should show the workflow spec, expected inputs, and where a dry run is blocked."
          />
          <div className="spec-block">
            <h3>Workflow spec</h3>
            <ul className="plain-list">
              <li>Authenticate into approved UT destinations.</li>
              <li>Collect opportunities or page changes against saved profile context.</li>
              <li>Pause whenever a high-risk confirmation or missing field appears.</li>
              <li>Install privately by default, with optional moderation submission.</li>
            </ul>
          </div>
          <div className="card-actions">
            <button type="button">Deploy privately</button>
            <button className="secondary" type="button">
              Submit to marketplace
            </button>
          </div>
        </div>
      </section>

      <section className="page-section">
        <SectionHeading
          title="Current drafts"
          description="Generated workflows should remain visible after creation so students can refine, deploy, or publish them later."
        />
        <StudioQueue drafts={drafts} />
      </section>
    </AppShell>
  );
}
