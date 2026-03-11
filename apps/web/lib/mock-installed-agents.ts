"use client";

import type { Agent, MarketplaceTemplate } from "./contracts/types";
import { installedAgents as defaultInstalledAgents } from "./contracts/mock-data";
import { buildConfigEnvelope, type EditableConfigValue } from "./utils";

const MOCK_INSTALLED_AGENTS_STORAGE_KEY = "longhornet.mockInstalledAgents";
const MOCK_INSTALLED_AGENTS_EVENT = "longhornet.mockInstalledAgents.updated";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function inferAgentType(template: MarketplaceTemplate): Agent["type"] {
  const normalized = `${template.id} ${template.title}`.toLowerCase();

  if (normalized.includes("reg")) return "reg";
  if (normalized.includes("scholar")) return "scholar";
  if (normalized.includes("eureka") || normalized.includes("lab")) return "eureka";
  if (normalized.includes("imbot") || normalized.includes("intramural")) return "im";
  return "custom";
}

function emitMockAgentUpdate() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(MOCK_INSTALLED_AGENTS_EVENT));
}

export function readMockInstalledAgents(): Agent[] {
  if (!canUseStorage()) {
    return defaultInstalledAgents;
  }

  const raw = window.localStorage.getItem(MOCK_INSTALLED_AGENTS_STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(
      MOCK_INSTALLED_AGENTS_STORAGE_KEY,
      JSON.stringify(defaultInstalledAgents)
    );
    return defaultInstalledAgents;
  }

  try {
    const parsed = JSON.parse(raw) as Agent[];
    return Array.isArray(parsed) ? parsed : defaultInstalledAgents;
  } catch {
    return defaultInstalledAgents;
  }
}

export function writeMockInstalledAgents(agents: Agent[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(MOCK_INSTALLED_AGENTS_STORAGE_KEY, JSON.stringify(agents));
  emitMockAgentUpdate();
}

export function installMockAgent(
  template: MarketplaceTemplate,
  currentValues: Record<string, EditableConfigValue>
): Agent {
  const now = Date.now();
  const nextAgent: Agent = {
    id: `mock-agent-${template.id}-${now}`,
    name: template.title,
    templateId: template.id,
    source: template.source,
    type: inferAgentType(template),
    status: "active",
    config: buildConfigEnvelope(template.templateConfig, currentValues),
    pendingActionCount: 0,
    currentRun: {
      id: `mock-run-${template.id}-${now}`,
      triggerType: "manual",
      status: "queued",
      phase: "queued",
      statusLabel: "Queued",
      phaseLabel: "Queued",
      startedAt: now,
      updatedAt: now,
      updatedLabel: "just now",
      startedLabel: new Date(now).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      summary: `${template.title} installed with your current setup values.`,
    },
    latestSummary: `${template.title} installed with your current setup values.`,
    nextStepLabel: "Ready to run",
    lastRunLabel: "Never run",
    nextRunLabel: "Not scheduled",
    pendingActionLabel: "No pending action",
    scheduleLabel: template.scheduleDefault,
    lastRunStatus: "idle",
  };

  const currentAgents = readMockInstalledAgents();
  writeMockInstalledAgents([nextAgent, ...currentAgents]);
  return nextAgent;
}

export function deleteMockAgent(agentId: string) {
  const currentAgents = readMockInstalledAgents();
  writeMockInstalledAgents(currentAgents.filter((agent) => agent.id !== agentId));
}

export function subscribeToMockInstalledAgents(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onChange();
  window.addEventListener(MOCK_INSTALLED_AGENTS_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(MOCK_INSTALLED_AGENTS_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
