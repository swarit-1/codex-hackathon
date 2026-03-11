"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, SectionHeading, StudioQueue } from "../../components/shared";
import type { StudioDraft } from "../../lib/contracts/types";
import {
  useConvexEnabled,
  useRequireCurrentUser,
  useStudioActions,
  useStudioDrafts,
} from "../../lib/hooks";
import { getErrorMessage } from "../../lib/utils";

const EXAMPLE_PROMPT =
  "Watch UT scholarship and department pages for new funding opportunities, compare them to my profile, and prepare a weekly digest with anything that needs human review.";

const FALLBACK_SPEC = [
  "Authenticate into approved UT destinations.",
  "Collect opportunities or page changes against saved profile context.",
  "Pause whenever a high-risk confirmation or missing field appears.",
  "Install privately by default, with optional moderation submission later.",
];

export default function StudioPage() {
  const router = useRouter();
  const convexEnabled = useConvexEnabled();
  const { isReady, isLoading, needsOnboarding } = useRequireCurrentUser();
  const { drafts } = useStudioDrafts();
  const { generateWorkflow, deployWorkflow } = useStudioActions();
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPT);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<StudioDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deployingDraftId, setDeployingDraftId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeDraftId && drafts[0]?.id) {
      setActiveDraftId(drafts[0].id);
    }
  }, [activeDraftId, drafts]);

  const activeDraft = useMemo(
    () =>
      drafts.find((draft) => draft.id === activeDraftId) ??
      (generatedDraft?.id === activeDraftId ? generatedDraft : null) ??
      generatedDraft ??
      drafts[0] ??
      null,
    [activeDraftId, drafts, generatedDraft]
  );

  if (convexEnabled && !isReady) {
    return (
      <AppShell currentPath="/studio">
        <section className="page-section">
          <p className="empty-state">
            {isLoading || needsOnboarding ? "Loading account..." : "Preparing Studio..."}
          </p>
        </section>
      </AppShell>
    );
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const nextDraft = await generateWorkflow(prompt.trim());

      if (nextDraft) {
        setGeneratedDraft(nextDraft);
        setActiveDraftId(nextDraft.id);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Workflow generation failed."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeploy = async (draft: StudioDraft) => {
    setDeployingDraftId(draft.id);
    setErrorMessage(null);

    try {
      const agent = await deployWorkflow(draft);

      if (agent) {
        router.push("/my-agents");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Workflow deployment failed."));
    } finally {
      setDeployingDraftId(null);
    }
  };

  const previewSteps = Array.isArray(activeDraft?.specResult?.spec?.steps)
    ? (activeDraft?.specResult?.spec?.steps as Array<{ description?: string }>)
        .map((step) => step.description)
        .filter((description): description is string => Boolean(description))
    : [];

  return (
    <AppShell currentPath="/studio">
      <section className="studio-layout">
        <div className="studio-panel studio-input">
          <SectionHeading
            title="Model-to-Agent Studio"
            description="Describe the work once, inspect the generated workflow, then deploy it privately."
          />
          <label className="form-field">
            <span>Describe the workflow</span>
            <textarea
              onChange={(event) => setPrompt(event.target.value)}
              rows={10}
              value={prompt}
            />
          </label>
          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
          <div className="card-actions">
            <button disabled={isGenerating || prompt.trim().length === 0} onClick={handleGenerate} type="button">
              {isGenerating ? "Generating..." : "Generate workflow"}
            </button>
            <button className="secondary" onClick={() => setPrompt(EXAMPLE_PROMPT)} type="button">
              Load example
            </button>
          </div>
        </div>

        <div className="studio-panel studio-preview">
          <SectionHeading
            title="Generated preview"
            description="Review the spec and deploy privately once the draft looks right."
          />
          <div className="spec-block">
            <h3>{activeDraft?.title ?? "Workflow spec"}</h3>
            <p className="preview-summary">
              {activeDraft?.summary ??
                "Generate a workflow to see its draft payload, spec, and deployment-ready outline."}
            </p>
            <ul className="plain-list">
              {(previewSteps.length > 0 ? previewSteps : FALLBACK_SPEC).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
          {activeDraft?.draftPayload ? (
            <div className="preview-meta">
              <div>
                <span>Category</span>
                <strong>{activeDraft.draftPayload.category}</strong>
              </div>
              <div>
                <span>Type</span>
                <strong>{activeDraft.draftPayload.templateType}</strong>
              </div>
            </div>
          ) : null}
          <div className="card-actions">
            <button
              disabled={!activeDraft?.draftPayload || Boolean(activeDraft.agentId) || deployingDraftId === activeDraft?.id}
              onClick={() => activeDraft && void handleDeploy(activeDraft)}
              type="button"
            >
              {deployingDraftId === activeDraft?.id
                ? "Deploying..."
                : activeDraft?.agentId
                  ? "Already deployed"
                  : "Deploy privately"}
            </button>
            <button className="secondary" disabled type="button">
              Submit later
            </button>
          </div>
        </div>
      </section>

      <section className="page-section">
        <SectionHeading
          title="Current drafts"
          description="Generated workflows stay visible after creation so you can refine or deploy them later."
          actionHref="/my-agents"
          actionLabel="Check deployed agents"
        />
        <StudioQueue
          activeDraftId={activeDraft?.id}
          deployingDraftId={deployingDraftId}
          drafts={drafts}
          onDeployDraft={convexEnabled ? handleDeploy : undefined}
          onSelectDraft={(draft) => setActiveDraftId(draft.id)}
        />
      </section>
    </AppShell>
  );
}
