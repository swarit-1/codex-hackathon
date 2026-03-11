import { AgentTable, AppShell, EventList, SectionHeading } from "../../components/shared";
import { agentEvents, installedAgents } from "../../lib/contracts/mock-data";

export default function MyAgentsPage() {
  return (
    <AppShell currentPath="/my-agents">
      <section className="page-section intro-section">
        <SectionHeading
          title="My Agents"
          description="Operate installed workflows, inspect what happened, and see where human input is still required."
        />
      </section>

      <section className="page-section">
        <AgentTable agents={installedAgents} />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Recent run activity"
          description="Operational logs stay readable and evidence-focused rather than turning into dashboard filler."
        />
        <EventList events={agentEvents} />
      </section>
    </AppShell>
  );
}
