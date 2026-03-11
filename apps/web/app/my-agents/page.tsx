"use client";

import { useState } from "react";
import { AgentTable, AppShell, EventList, SectionHeading } from "../../components/shared";
import {
  useAgentActions,
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
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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
      setActionSuccess("Agent launched! Check the activity feed below for updates.");
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
        />
      </section>

      <section className="page-section">
        <SectionHeading
          title="Recent run activity"
          description="Operational logs stay readable and evidence-focused rather than turning into dashboard filler."
          actionHref="/settings"
          actionLabel="Review notifications"
        />
        <EventList events={events} />
      </section>
    </AppShell>
  );
}
