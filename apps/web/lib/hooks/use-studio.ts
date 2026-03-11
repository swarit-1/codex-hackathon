"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { studioDrafts as mockDrafts } from "../contracts/mock-data";
import type { StudioDraft } from "../contracts/types";
import { toStudioDraft } from "../mappers";
import { useConvexEnabled } from "./use-convex-enabled";
import { useCurrentUser } from "./use-demo-user";

export function useStudioDrafts(): {
  drafts: StudioDraft[];
  isLoading: boolean;
} {
  const convexEnabled = useConvexEnabled();
  const { userId } = useCurrentUser();
  const draftsResult = useQuery(
    api.customWorkflows.listByUser,
    convexEnabled && userId
      ? {
          userId: userId as Id<"users">,
        }
      : "skip"
  );

  return {
    drafts: !convexEnabled ? mockDrafts : (draftsResult?.items ?? []).map((record) => toStudioDraft(record as never)),
    isLoading: convexEnabled && Boolean(userId) && !draftsResult,
  };
}

export function useStudioActions() {
  const convexEnabled = useConvexEnabled();
  const { userId } = useCurrentUser();
  const generateWorkflowSpec = useAction(api.flowforge.generateWorkflowSpec);
  const generateAgentScript = useAction(api.flowforge.generateAgentScript);
  const createWorkflow = useMutation(api.customWorkflows.create);
  const updateWorkflow = useMutation(api.customWorkflows.update);
  const createAgent = useMutation(api.agents.create);

  return {
    generateWorkflow: async (prompt: string) => {
      if (!convexEnabled || !userId) {
        return null;
      }

      const specResult = await generateWorkflowSpec({
        nlDescription: prompt,
      });
      const scriptResult = await generateAgentScript({
        spec: specResult.spec,
      });
      const workflowRecord = await createWorkflow({
        userId: userId as Id<"users">,
        prompt,
        sourceAlias: "flowforge",
        spec: specResult,
        generatedScript: scriptResult.script,
      });

      return toStudioDraft({
        ...workflowRecord,
        spec: specResult,
        generatedScript: scriptResult.script,
      });
    },
    deployWorkflow: async (draft: StudioDraft) => {
      if (!convexEnabled || !userId || !draft.draftPayload) {
        return null;
      }

      const agent = await createAgent({
        userId: userId as Id<"users">,
        type: draft.draftPayload.templateType,
        ownerType: "generated",
        config: draft.draftPayload.templateConfig,
        schedule: draft.draftPayload.templateConfig.defaultSchedule,
      });

      await updateWorkflow({
        workflowId: draft.id as Id<"customWorkflows">,
        agentId: agent.id as Id<"agents">,
      });

      return agent;
    },
  };
}
