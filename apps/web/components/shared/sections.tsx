"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type {
  Agent,
  AgentEvent,
  FilterOption,
  MarketplaceTemplate,
  SettingsSection,
  StudioDraft,
} from "../../lib/contracts/types";
import {
  extractConfigFields,
  getEditableConfigValues,
  type EditableConfigValue,
} from "../../lib/utils";

export function SectionHeading({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link className="text-action" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function MarketplaceCard({
  template,
  installControls,
}: {
  template: MarketplaceTemplate;
  installControls?: {
    enabled: boolean;
    isInstalling?: boolean;
    isInstalled?: boolean;
    error?: string | null;
    onInstall?: (
      template: MarketplaceTemplate,
      currentValues: Record<string, EditableConfigValue>
    ) => Promise<void> | void;
  };
}) {
  const { supportedFields, unsupportedFields } = useMemo(
    () => extractConfigFields(template.templateConfig.inputSchema),
    [template.templateConfig.inputSchema]
  );
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [currentValues, setCurrentValues] = useState<Record<string, EditableConfigValue>>(
    () => getEditableConfigValues(template.templateConfig)
  );

  useEffect(() => {
    setCurrentValues(getEditableConfigValues(template.templateConfig));
  }, [template.id, template.templateConfig]);

  useEffect(() => {
    if (installControls?.isInstalled) {
      setIsInstallOpen(false);
    }
  }, [installControls?.isInstalled]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!installControls?.onInstall) {
      return;
    }

    await installControls.onInstall(template, currentValues);
  };

  return (
    <article className="market-card" id={template.id}>
      <div className="market-card-head">
        <div>
          <h3>{template.title}</h3>
          <p>{template.description}</p>
        </div>
        <span className={`status-chip ${template.source}`}>{template.trustLabel}</span>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>Category</dt>
          <dd>{template.category}</dd>
        </div>
        <div>
          <dt>Installs</dt>
          <dd>{template.installs}</dd>
        </div>
        <div>
          <dt>Default cadence</dt>
          <dd>{template.scheduleDefault}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{formatStatus(template.status)}</dd>
        </div>
      </dl>
      <div className="market-card-list">
        <div>
          <h4>Setup</h4>
          <ul>
            {template.setupFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Outputs</h4>
          <ul>
            {template.outcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </div>
      </div>

      {installControls?.enabled && isInstallOpen ? (
        <form className="inline-form" onSubmit={handleSubmit}>
          {supportedFields.length > 0 ? (
            <div className="field-grid">
              {supportedFields.map((field) => {
                const value = currentValues[field.key];

                if (field.type === "textarea") {
                  return (
                    <label
                      key={field.key}
                      className={field.uiWidth === "compact" ? "form-field compact" : "form-field"}
                    >
                      <span>{field.label}</span>
                      <textarea
                        onChange={(event) =>
                          setCurrentValues((previousValues) => ({
                            ...previousValues,
                            [field.key]: event.target.value,
                          }))
                        }
                        required={field.required}
                        rows={4}
                        value={String(value ?? "")}
                      />
                    </label>
                  );
                }

                if (field.type === "select") {
                  return (
                    <label
                      key={field.key}
                      className={field.uiWidth === "compact" ? "form-field compact" : "form-field"}
                    >
                      <span>{field.label}</span>
                      <select
                        onChange={(event) =>
                          setCurrentValues((previousValues) => ({
                            ...previousValues,
                            [field.key]: event.target.value,
                          }))
                        }
                        required={field.required}
                        value={String(value ?? "")}
                      >
                        <option value="">Select an option</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }

                if (field.type === "boolean" || field.type === "checkbox") {
                  return (
                    <label key={field.key} className="checkbox-field">
                      <input
                        checked={Boolean(value)}
                        onChange={(event) =>
                          setCurrentValues((previousValues) => ({
                            ...previousValues,
                            [field.key]: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                return (
                  <label
                    key={field.key}
                    className={field.uiWidth === "compact" ? "form-field compact" : "form-field"}
                  >
                    <span>{field.label}</span>
                    <input
                      onChange={(event) =>
                        setCurrentValues((previousValues) => ({
                          ...previousValues,
                          [field.key]: event.target.value,
                        }))
                      }
                      required={field.required}
                      type={field.type === "email" || field.type === "url" ? field.type : "text"}
                      value={String(value ?? "")}
                    />
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="form-note">
              This template can be installed with its backend defaults.
            </p>
          )}

          {unsupportedFields.length > 0 ? (
            <p className="form-note">
              Some advanced setup fields are not editable yet and will keep their default values.
            </p>
          ) : null}

          {installControls.error ? (
            <p className="form-message error">{installControls.error}</p>
          ) : null}

          <div className="card-actions">
            <button disabled={installControls.isInstalling} type="submit">
              {installControls.isInstalling ? "Installing..." : "Save and install"}
            </button>
            <button
              className="secondary"
              onClick={() => setIsInstallOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="card-actions">
        {installControls?.enabled ? (
          <button
            disabled={installControls.isInstalling || installControls.isInstalled}
            onClick={() => setIsInstallOpen((currentValue) => !currentValue)}
            type="button"
          >
            {installControls.isInstalled
              ? "Installed"
              : isInstallOpen
                ? "Hide setup"
                : "Install template"}
          </button>
        ) : (
          <Link className="button-link" href="/my-agents">
            Install template
          </Link>
        )}
        <Link className="button-link secondary" href={`/marketplace#${template.id}`}>
          View details
        </Link>
      </div>
    </article>
  );
}

export function MarketplaceHero() {
  return (
    <div className="market-banner">
      <div className="market-banner-copy">
        <h1>Favorites of 2026</h1>
        <p>Find official UT student workflows and community-built tools in one place.</p>
        <Link className="banner-link" href="/studio">
          Build a workflow
        </Link>
      </div>
      <div className="market-banner-art" aria-hidden="true">
        <div className="banner-block trophy" />
        <div className="banner-block spark" />
        <div className="banner-block ribbon" />
      </div>
    </div>
  );
}

export function MarketplaceSidebar({
  options,
  activeValue,
  onChange,
}: {
  options: FilterOption[];
  activeValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <aside className="market-sidebar" aria-label="Marketplace categories">
      <nav className="sidebar-nav">
        {options.map((option) => (
          <button
            key={option.value}
            aria-pressed={activeValue === option.value}
            className={activeValue === option.value ? "sidebar-link active" : "sidebar-link"}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export function MarketplaceTile({
  template,
}: {
  template: MarketplaceTemplate;
}) {
  const sourceLabel = template.source === "dev" ? "Official" : "Student-built";
  const installLabel = `${template.installs.toLocaleString()} installs`;

  return (
    <article className="store-tile" id={template.id}>
      <div className="tile-preview">
        {template.imageSrc ? (
          <Image
            alt={`${template.title} artwork`}
            className="tile-image"
            fill
            sizes="(max-width: 820px) 100vw, (max-width: 1100px) 50vw, 25vw"
            src={template.imageSrc}
          />
        ) : (
          <div className={`tile-logo ${template.iconKey}`}>
            <span>{template.iconGlyph}</span>
          </div>
        )}
        <div className="tile-preview-fill" />
      </div>
      <div className="store-tile-body">
        <h3>{template.title}</h3>
        <div className="store-meta">
          <span className={`store-tag ${template.source}`}>{sourceLabel}</span>
          <span className="store-tag neutral">{installLabel}</span>
          <span className="store-tag neutral">{template.category}</span>
        </div>
        <p>{template.description}</p>
      </div>
      <div className="tile-actions">
        <Link className="button-link tile-button" href="/my-agents">
          Install
        </Link>
        <Link className="catalog-link" href={`/marketplace#${template.id}`}>
          Details
        </Link>
      </div>
    </article>
  );
}

export function FilterBar({
  options,
  activeValue,
  onChange,
}: {
  options: FilterOption[];
  activeValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="filter-bar" role="toolbar" aria-label="Filters">
      {options.map((option) => (
        <button
          key={option.value}
          aria-pressed={activeValue === option.value}
          className={activeValue === option.value ? "filter-pill active" : "filter-pill"}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ScholarDemoButton() {
  const [state, setState] = useState<"idle" | "launching" | "launched" | "error">("idle");
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  async function handleClick() {
    if (state === "launched" && liveUrl) {
      window.open(liveUrl, "_blank");
      return;
    }
    setState("launching");
    try {
      const res = await fetch("/api/demo/scholar", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setState("launched");
        setLiveUrl(data.liveUrl ?? null);
        if (data.liveUrl) {
          window.open(data.liveUrl, "_blank");
        }
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const label =
    state === "launching"
      ? "Launching..."
      : state === "launched"
        ? "Watch Live"
        : state === "error"
          ? "Failed — retry?"
          : "Demo";

  return (
    <button
      className="button-link demo-btn"
      onClick={handleClick}
      disabled={state === "launching"}
      type="button"
    >
      {label}
    </button>
  );
}

function EurekaDemoButton() {
  const [state, setState] = useState<"idle" | "launching" | "launched" | "error">("idle");
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  async function handleClick() {
    if (state === "launched" && liveUrl) {
      window.open(liveUrl, "_blank");
      return;
    }
    setState("launching");
    try {
      const res = await fetch("/api/demo/eureka", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setState("launched");
        setLiveUrl(data.liveUrl ?? null);
        if (data.liveUrl) {
          window.open(data.liveUrl, "_blank");
        }
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const label =
    state === "launching"
      ? "Scanning..."
      : state === "launched"
        ? "Watch Live"
        : state === "error"
          ? "Failed — retry?"
          : "Scan Labs";

  return (
    <button
      className="button-link demo-btn"
      onClick={handleClick}
      disabled={state === "launching"}
      type="button"
    >
      {label}
    </button>
  );
}

function getToggleLabel(agent: Agent): string | null {
  if (agent.status === "active") {
    return "Pause";
  }

  if (agent.status === "paused" || agent.status === "error") {
    return "Resume";
  }

  return null;
}

export function AgentTable({
  agents,
  actionControls,
}: {
  agents: Agent[];
  actionControls?: {
    busyAgentId?: string | null;
    error?: string | null;
    onRunNow?: (agentId: string) => Promise<void> | void;
    onToggleStatus?: (agent: Agent) => Promise<void> | void;
    onDelete?: (agentId: string) => Promise<void> | void;
  };
}) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Status</th>
            <th>Last run</th>
            <th>Next run</th>
            <th>Pending action</th>
            <th>Schedule</th>
            <th></th>
            {actionControls ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => {
            const toggleLabel = getToggleLabel(agent);
            const isBusy = actionControls?.busyAgentId === agent.id;

            return (
              <tr key={agent.id}>
                <td>
                  <strong>{agent.name}</strong>
                  <span>{agent.source === "dev" ? "Official template" : "Community template"}</span>
                </td>
                <td>
                  <span className={`table-status ${agent.status}`}>{formatStatus(agent.status)}</span>
                </td>
                <td>{agent.lastRunLabel}</td>
                <td>{agent.nextRunLabel}</td>
                <td>{agent.pendingActionLabel}</td>
                <td>{agent.scheduleLabel}</td>
                <td>
                  {agent.type === "scholar" ? <ScholarDemoButton /> : null}
                  {agent.type === "eureka" ? <EurekaDemoButton /> : null}
                </td>
                {actionControls ? (
                  <td>
                    <div className="agent-row-actions">
                      <button
                        className="secondary"
                        disabled={isBusy}
                        onClick={() => actionControls.onRunNow?.(agent.id)}
                        type="button"
                      >
                        Run now
                      </button>
                      {toggleLabel ? (
                        <button
                          className="secondary"
                          disabled={isBusy}
                          onClick={() => actionControls.onToggleStatus?.(agent)}
                          type="button"
                        >
                          {toggleLabel}
                        </button>
                      ) : null}
                      <button
                        className="secondary danger"
                        disabled={isBusy}
                        onClick={() => actionControls.onDelete?.(agent.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {actionControls?.error ? <p className="form-message error">{actionControls.error}</p> : null}
      <div className="table-actions">
        <Link className="button-link" href="/marketplace">
          Install from marketplace
        </Link>
        <Link className="button-link secondary" href="/studio">
          Build a workflow
        </Link>
        <Link className="button-link secondary" href="/settings">
          Review settings
        </Link>
      </div>
    </div>
  );
}

export function EventList({ events }: { events: AgentEvent[] }) {
  return (
    <div className="event-list">
      {events.map((event) => (
        <article key={event.id} className={`event-card ${event.kind}`}>
          <div className="event-time">{event.time}</div>
          <div className="event-body">
            <div className="event-header">
              <h3>{event.title}</h3>
              <span>{event.agentName}</span>
            </div>
            <p>{event.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function StudioQueue({
  drafts,
  activeDraftId,
  deployingDraftId,
  onSelectDraft,
  onDeployDraft,
}: {
  drafts: StudioDraft[];
  activeDraftId?: string;
  deployingDraftId?: string | null;
  onSelectDraft?: (draft: StudioDraft) => void;
  onDeployDraft?: (draft: StudioDraft) => Promise<void> | void;
}) {
  return (
    <div className="studio-queue">
      {drafts.map((draft) => (
        <article
          key={draft.id}
          className={draft.id === activeDraftId ? "queue-card active" : "queue-card"}
        >
          <div className="queue-state">{draft.state}</div>
          <div>
            <h3>{draft.title}</h3>
            <p>{draft.summary}</p>
          </div>
          {onSelectDraft || onDeployDraft ? (
            <div className="card-actions">
              {onSelectDraft ? (
                <button
                  className="secondary"
                  onClick={() => onSelectDraft(draft)}
                  type="button"
                >
                  Open draft
                </button>
              ) : null}
              {onDeployDraft && draft.draftPayload && !draft.agentId ? (
                <button
                  disabled={deployingDraftId === draft.id}
                  onClick={() => onDeployDraft(draft)}
                  type="button"
                >
                  {deployingDraftId === draft.id ? "Deploying..." : "Deploy privately"}
                </button>
              ) : null}
              {draft.agentId ? <span className="status-chip student">Deployed</span> : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function SettingsGrid({ sections }: { sections: SettingsSection[] }) {
  return (
    <div className="settings-grid">
      {sections.map((section) => (
        <article key={section.title} className="settings-card">
          <h3>{section.title}</h3>
          <p>{section.description}</p>
        </article>
      ))}
    </div>
  );
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}
