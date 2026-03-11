"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useMemo } from "react";
import { agentEvents as mockEvents, installedAgents as mockAgents } from "../contracts/mock-data";
import type { Agent, AgentEvent, AgentStatus } from "../contracts/types";
import { toAgentEvent, toAgentUI } from "../mappers";
import { useConvexEnabled } from "./use-convex-enabled";
import { useCurrentUser } from "./use-demo-user";

export function useInstalledAgents(): {
  agents: Agent[];
  isLoading: boolean;
} {
  const convexEnabled = useConvexEnabled();
  const { sessionToken, userId } = useCurrentUser();
  const agentsResult = useQuery(
    api.agents.listByUser,
    convexEnabled && userId && sessionToken
      ? {
          sessionToken,
          userId: userId as Id<"users">,
        }
      : "skip"
  );
  const pendingActionsResult = useQuery(
    api.pendingActions.listByUser,
    convexEnabled && userId && sessionToken
      ? {
          sessionToken,
          userId: userId as Id<"users">,
        }
      : "skip"
  );
  const devTemplates = useQuery(
    api.marketplace.listTemplates,
    convexEnabled
      ? {
          source: "dev",
          visibility: "public",
        }
      : "skip"
  );
  const studentTemplates = useQuery(
    api.marketplace.listTemplates,
    convexEnabled
      ? {
          source: "student",
          visibility: "public",
        }
      : "skip"
  );

  const agents = useMemo(() => {
    if (!convexEnabled) {
      return mockAgents;
    }

    const templatesById = new Map(
      [...(devTemplates?.items ?? []), ...(studentTemplates?.items ?? [])].map((template) => [
        String(template.id),
        template,
      ])
    );
    const pendingCounts = (pendingActionsResult?.items ?? []).reduce<Map<string, number>>((counts, action) => {
      if ((action as { resolvedAt?: number }).resolvedAt) {
        return counts;
      }

      const agentId = String((action as { agentId: string }).agentId);
      counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>());

    return (agentsResult?.items ?? []).map((record) =>
      toAgentUI(
        record as never,
        templatesById.get(String(record.templateId))?.title,
        pendingCounts.get(String(record.id))
      )
    );
  }, [agentsResult?.items, convexEnabled, devTemplates?.items, pendingActionsResult?.items, studentTemplates?.items]);

  return {
    agents,
    isLoading:
      convexEnabled &&
      Boolean(userId) &&
      (!agentsResult || !pendingActionsResult || !devTemplates || !studentTemplates),
  };
}

export function useAgentEvents(): {
  events: AgentEvent[];
  isLoading: boolean;
} {
  const convexEnabled = useConvexEnabled();
  const { sessionToken, userId } = useCurrentUser();
  const logsResult = useQuery(
    api.agentLogs.listByUser,
    convexEnabled && userId && sessionToken
      ? {
          sessionToken,
          userId: userId as Id<"users">,
        }
      : "skip"
  );
  const agentsResult = useQuery(
    api.agents.listByUser,
    convexEnabled && userId && sessionToken
      ? {
          sessionToken,
          userId: userId as Id<"users">,
        }
      : "skip"
  );
  const devTemplates = useQuery(
    api.marketplace.listTemplates,
    convexEnabled
      ? {
          source: "dev",
          visibility: "public",
        }
      : "skip"
  );
  const studentTemplates = useQuery(
    api.marketplace.listTemplates,
    convexEnabled
      ? {
          source: "student",
          visibility: "public",
        }
      : "skip"
  );

  const events = useMemo(() => {
    if (!convexEnabled) {
      return mockEvents;
    }

    const templatesById = new Map(
      [...(devTemplates?.items ?? []), ...(studentTemplates?.items ?? [])].map((template) => [
        String(template.id),
        template,
      ])
    );
    const agentNames = new Map(
      (agentsResult?.items ?? []).map((agent) => [
        String(agent.id),
        toAgentUI(
          agent as never,
          templatesById.get(String(agent.templateId))?.title,
          0
        ).name,
      ])
    );

    return (logsResult?.items ?? []).map((record) =>
      toAgentEvent(record as never, agentNames.get(String(record.agentId)))
    );
  }, [agentsResult?.items, convexEnabled, devTemplates?.items, logsResult?.items, studentTemplates?.items]);

  return {
    events,
    isLoading: convexEnabled && Boolean(userId) && (!logsResult || !agentsResult),
  };
}

export function useAgentActions() {
  const convexEnabled = useConvexEnabled();
  const { sessionToken } = useCurrentUser();
  const runNowMutation = useMutation(api.agents.runNow);
  const updateStatusMutation = useMutation(api.agents.updateStatus);
  const deleteAgentMutation = useMutation(api.agents.deleteAgent);

  return {
    runNow: async (agentId: string) => {
      if (!convexEnabled || !sessionToken) {
        return null;
      }

      return runNowMutation({
        sessionToken,
        agentId: agentId as Id<"agents">,
      });
    },
    updateStatus: async (agentId: string, status: Extract<AgentStatus, "active" | "paused">) => {
      if (!convexEnabled || !sessionToken) {
        return null;
      }

      return updateStatusMutation({
        sessionToken,
        agentId: agentId as Id<"agents">,
        status,
      });
    },
    deleteAgent: async (agentId: string) => {
      if (!convexEnabled || !sessionToken) {
        return null;
      }

      return deleteAgentMutation({
        sessionToken,
        agentId: agentId as Id<"agents">,
      });
    },
  };
}
