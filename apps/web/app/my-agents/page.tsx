"use client";

import { AgentTable, AppShell, EventList, SectionHeading } from "../../components/shared";
import { useInstalledAgents, useAgentEvents } from "../../lib/hooks";

export default function MyAgentsPage() {
  const { agents } = useInstalledAgents();
  const { events } = useAgentEvents();

  return (
    <AppShell currentPath="/my-agents">
      <section className="page-section intro-section">
        <SectionHeading
          title="My Agents"
          description="Operate installed workflows, inspect what happened, and see where human input is still required."
        />
      </section>

      <section className="page-section">
        <AgentTable agents={agents} />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Recent run activity"
          description="Operational logs stay readable and evidence-focused rather than turning into dashboard filler."
        />
        <EventList events={events} />
      </section>
    </AppShell>
  );
}
