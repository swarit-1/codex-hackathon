"use client";

import {
  agentEvents as mockEvents,
  installedAgents as mockAgents,
} from "../contracts/mock-data";
import type { Agent, AgentEvent } from "../contracts/types";

/**
 * Returns the user's installed agents.
 *
 * Uses mock data by default. When Convex is configured, swap to:
 *   const result = useQuery(api.agents.listByUser, { userId });
 *   return { agents: result?.items.map(r => toAgentUI(r)) ?? [], isLoading: !result };
 */
export function useInstalledAgents(): {
  agents: Agent[];
  isLoading: boolean;
} {
  return { agents: mockAgents, isLoading: false };
}

/**
 * Returns recent agent run events.
 *
 * Uses mock data by default. When Convex is configured, swap to:
 *   const result = useQuery(api.agentLogs.listByUser, { userId });
 *   return { events: result?.items.map(r => toAgentEvent(r)) ?? [], isLoading: !result };
 */
export function useAgentEvents(): {
  events: AgentEvent[];
  isLoading: boolean;
} {
  return { events: mockEvents, isLoading: false };
}

/**
 * Returns mutation callbacks for agent operations.
 * In mock mode these are no-ops. With Convex:
 *   const runNow = useMutation(api.agents.runNow);
 */
export function useAgentActions() {
  return {
    runNow: (_agentId: string) => Promise.resolve(),
    updateStatus: (_agentId: string, _status: "active" | "paused") =>
      Promise.resolve(),
    deleteAgent: (_agentId: string) => Promise.resolve(),
  };
}
