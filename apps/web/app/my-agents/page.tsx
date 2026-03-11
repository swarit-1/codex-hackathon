"use client";

import { useEffect, useState } from "react";
import { AgentDetailPanel, AgentTable, AppShell, EventList, SectionHeading } from "../../components/shared";
import {
  useAgentActions,
  useAgentDetails,
  useAgentEvents,
  useConvexEnabled,
  useInstalledAgents,
  useRequireCurrentUser,
} from "../../lib/hooks";
import type { Agent } from "../../lib/contracts/types";
import { getErrorMessage } from "../../lib/utils";

export default function MyAgentsPage() {
  const convexEnabled = useConvexEnabled();
  const { isReady, isLoading, needsOnboarding } = useRequireCurrentUser();
  const { agents } = useInstalledAgents();
  const { events } = useAgentEvents();
  const { runNow, updateStatus, deleteAgent } = useAgentActions();
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"progress" | "results" | "history">("progress");
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const details = useAgentDetails(selectedAgent?.id);

  useEffect(() => {
    if (!agents.length) {
      setSelectedAgentId(undefined);
      return;
    }

    if (!selectedAgentId || !agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  if (convexEnabled && !isReady) {
    return (
      <AppShell currentPath="/my-agents">
        <section className="page-section">
          <p className="empty-state">
            {isLoading || needsOnboarding ? "Loading account..." : "Preparing your agents..."}
          </p>
        </section>
      </AppShell>
    );
  }

  const handleRunNow = async (agentId: string) => {
    setBusyAgentId(agentId);
    setActionError(null);
    setActionSuccess(null);

    try {
      await runNow(agentId);
      setActionSuccess("Run started. Track its live phase and summary below.");
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (error) {
      setActionError(getErrorMessage(error, "Agent run could not be requested."));
    } finally {
      setBusyAgentId(null);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const nextStatus = agent.status === "active" ? "paused" : "active";
    setBusyAgentId(agent.id);
    setActionError(null);

    try {
      await updateStatus(agent.id, nextStatus);
    } catch (error) {
      setActionError(getErrorMessage(error, "Agent status could not be updated."));
    } finally {
      setBusyAgentId(null);
    }
  };

  const handleDelete = async (agentId: string) => {
    setBusyAgentId(agentId);
    setActionError(null);

    try {
      await deleteAgent(agentId);
    } catch (error) {
      setActionError(getErrorMessage(error, "Agent could not be deleted."));
    } finally {
      setBusyAgentId(null);
    }
  };

  return (
    <AppShell currentPath="/my-agents">
      <section className="page-section intro-section">
        <SectionHeading
          title="My Agents"
          description="Operate installed workflows, inspect what happened, and see where human input is still required."
          actionHref="/marketplace"
          actionLabel="Install from marketplace"
        />
      </section>

      {actionSuccess && (
        <section className="page-section">
          <div style={{
            padding: "12px 16px",
            background: "#0f5132",
            color: "#d1e7dd",
            borderRadius: "8px",
            fontSize: "14px",
          }}>
            {actionSuccess}
          </div>
        </section>
      )}

      <section className="page-section">
        <AgentTable
          actionControls={
            convexEnabled
              ? {
                  busyAgentId,
                  error: actionError,
                  onRunNow: handleRunNow,
                  onToggleStatus: handleToggleStatus,
                  onDelete: handleDelete,
                }
              : undefined
          }
          agents={agents}
          onSelectAgent={(agent) => {
            setSelectedAgentId(agent.id);
            setActiveTab("progress");
          }}
          selectedAgentId={selectedAgent?.id}
        />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Agent Detail"
          description="Progress is tracked in-app. Each run shows its current phase, results, and history without depending on the provider cloud page."
        />
        <AgentDetailPanel
          activeTab={activeTab}
          agent={selectedAgent}
          details={details}
          onTabChange={setActiveTab}
        />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Low-level activity"
          description="This is the raw operational trail across agents. Use it for diagnostics after you review the run-centric detail view."
          actionHref="/settings"
          actionLabel="Review notifications"
        />
        <EventList events={events} />
      </section>
    </AppShell>
  );
}
