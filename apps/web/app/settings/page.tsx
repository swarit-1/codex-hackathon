"use client";

import { AppShell, SectionHeading, SettingsGrid } from "../../components/shared";
import { settingsSections } from "../../lib/contracts/mock-data";

export default function SettingsPage() {
  return (
    <AppShell currentPath="/settings">
      <section className="page-section intro-section">
        <SectionHeading
          title="Settings"
          description="Profile context, credentials, and notifications should live in one predictable place."
          actionHref="/my-agents"
          actionLabel="Return to operations"
        />
      </section>
      <section className="page-section">
        <SettingsGrid sections={settingsSections} />
      </section>
    </AppShell>
  );
}
