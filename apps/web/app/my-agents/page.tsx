"use client";

import { useEffect, useRef, useState } from "react";
import { AgentDetailPanel, AgentTable, AppShell, EventList, SectionHeading } from "../../components/shared";
import {
  useAgentActions,
  useAgentDetails,
  useAgentEvents,
  useConvexEnabled,
  useInstalledAgents,
  useMarketplaceTemplates,
  useRequireCurrentUser,
} from "../../lib/hooks";
import type { Agent, AgentDetailData, AgentEvent, RegistrationMonitor } from "../../lib/contracts/types";
import { buildConfigEnvelope, getErrorMessage, type EditableConfigValue } from "../../lib/utils";

type DemoAgentOverlay = {
  registrationMonitors: RegistrationMonitor[];
  timeline: AgentEvent[];
};

function buildDemoMonitor(
  agentId: string,
  uniqueId: string,
  minutesAgo: number
): RegistrationMonitor {
  return {
    id: `${agentId}-${uniqueId}`,
    courseNumber: "CS 378",
    uniqueId,
    semester: "Fall 2026",
    status: "watching",
    pollInterval: 10,
    updatedAt: Date.now() - minutesAgo * 60_000,
  };
}

function buildDemoEvent(
  agentName: string,
  uniqueId: string,
  kind: AgentEvent["kind"],
  detailSuffix: string
): AgentEvent {
  return {
    id: `${agentName}-${uniqueId}-${Date.now()}`,
    time: new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    agentName,
    title: "Monitor update",
    detail: `Course ${uniqueId} queued for review ${detailSuffix}`,
    kind,
  };
}

export default function MyAgentsPage() {
  const convexEnabled = useConvexEnabled();
  const { isReady, isLoading, needsOnboarding } = useRequireCurrentUser();
  const { agents } = useInstalledAgents();
  const { templates } = useMarketplaceTemplates();
  const { events } = useAgentEvents();
  const { runNow, updateConfig, updateStatus, deleteAgent } = useAgentActions();
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<"progress" | "results" | "history">("progress");
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [demoOverlays, setDemoOverlays] = useState<Record<string, DemoAgentOverlay>>({});
  const pendingTimersRef = useRef<number[]>([]);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const selectedTemplate = templates.find((template) => template.id === selectedAgent?.templateId);
  const details = useAgentDetails(selectedAgent?.id);
  const selectedOverlay = selectedAgent ? demoOverlays[selectedAgent.id] : undefined;
  const displayDetails: AgentDetailData = selectedOverlay
    ? {
        ...details,
        registrationMonitors: [...selectedOverlay.registrationMonitors, ...details.registrationMonitors],
        timeline: [...selectedOverlay.timeline, ...details.timeline],
      }
    : details;

  useEffect(() => {
    if (!agents.length) {
      setSelectedAgentId(undefined);
      return;
    }

    if (!selectedAgentId || !agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    return () => {
      for (const timer of pendingTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const scheduleDemoRunResults = (agent: Agent) => {
    if (agent.type !== "reg" && agent.type !== "im") {
      return;
    }

    setDemoOverlays((current) => ({
      ...current,
      [agent.id]: {
        registrationMonitors: [],
        timeline: [],
      },
    }));

    const firstTimer = window.setTimeout(() => {
      setDemoOverlays((current) => ({
        ...current,
        [agent.id]: {
          registrationMonitors: [buildDemoMonitor(agent.id, "55095", 1)],
          timeline: [buildDemoEvent(agent.name, "55095", "success", "after the first pass.")],
        },
      }));
    }, 1000);

    const secondTimer = window.setTimeout(() => {
      setDemoOverlays((current) => {
        const existing = current[agent.id] ?? { registrationMonitors: [], timeline: [] };
        return {
          ...current,
          [agent.id]: {
            registrationMonitors: [
              ...existing.registrationMonitors,
              buildDemoMonitor(agent.id, "55120", 0),
            ],
            timeline: [
              ...existing.timeline,
              buildDemoEvent(agent.name, "55120", "warning", "during the follow-up check."),
            ],
          },
        };
      });
    }, 2400);

    pendingTimersRef.current.push(firstTimer, secondTimer);
  };

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
    const targetAgent = agents.find((agent) => agent.id === agentId);
    setBusyAgentId(agentId);
    setActionError(null);
    setActionSuccess(null);

    try {
      await runNow(agentId);
      if (targetAgent) {
        scheduleDemoRunResults(targetAgent);
      }
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
    setActionSuccess(null);

    try {
      await deleteAgent(agentId);
      setActionSuccess("Workflow uninstalled.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (error) {
      setActionError(getErrorMessage(error, "Agent could not be deleted."));
    } finally {
      setBusyAgentId(null);
    }
  };

  const handleSaveConfig = async (
    agent: Agent,
    currentValues: Record<string, EditableConfigValue>
  ) => {
    if (!agent.config) {
      return;
    }

    setBusyAgentId(agent.id);
    setConfigError(null);
    setConfigSuccess(null);

    try {
      await updateConfig(agent.id, buildConfigEnvelope(agent.config, currentValues));
      setConfigSuccess("Agent details updated. Future runs will use the new settings.");
      setTimeout(() => setConfigSuccess(null), 5000);
    } catch (error) {
      setConfigError(getErrorMessage(error, "Agent details could not be updated."));
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
          details={displayDetails}
          template={selectedTemplate}
          editControls={
            convexEnabled
              ? {
                  isSaving: busyAgentId === selectedAgent?.id,
                  error: configError,
                  success: configSuccess,
                  onSave: handleSaveConfig,
                }
              : undefined
          }
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
