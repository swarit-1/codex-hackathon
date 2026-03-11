"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type {
  Agent,
  AgentDetailData,
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
                      {field.description ? <small className="field-hint">{field.description}</small> : null}
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
                      {field.description ? <small className="field-hint">{field.description}</small> : null}
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
                      type={
                        field.type === "email" || field.type === "url" || field.type === "password"
                          ? field.type
                          : "text"
                      }
                      value={String(value ?? "")}
                    />
                    {field.description ? <small className="field-hint">{field.description}</small> : null}
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
  selectedAgentId,
  onSelectAgent,
  actionControls,
}: {
  agents: Agent[];
  selectedAgentId?: string;
  onSelectAgent?: (agent: Agent) => void;
  actionControls?: {
    busyAgentId?: string | null;
    error?: string | null;
    onRunNow?: (agentId: string) => Promise<void> | void;
    onToggleStatus?: (agent: Agent) => Promise<void> | void;
    onDelete?: (agentId: string) => Promise<void> | void;
  };
}) {
  if (agents.length === 0) {
    return (
      <div className="table-shell">
        <p className="empty-state">
          No agents installed yet. Install a marketplace workflow or deploy a private draft to start tracking runs here.
        </p>
        <div className="table-actions">
          <Link className="button-link" href="/marketplace">
            Install from marketplace
          </Link>
          <Link className="button-link secondary" href="/studio">
            Build a workflow
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <div className="agent-board">
        {agents.map((agent) => {
          const toggleLabel = getToggleLabel(agent);
          const isBusy = actionControls?.busyAgentId === agent.id;
          const runStateClass =
            agent.currentRun?.status === "failed"
              ? "error"
              : agent.currentRun?.status === "succeeded"
                ? "active"
                : agent.currentRun?.status === "waiting_for_input"
                  ? "paused"
                  : agent.status;

          return (
            <article
              key={agent.id}
              className={selectedAgentId === agent.id ? "agent-runtime-card selected" : "agent-runtime-card"}
            >
              <div className="agent-runtime-top">
                <div className="agent-runtime-heading">
                  <div className="agent-runtime-name">
                    <strong>{agent.name}</strong>
                    <span>{agent.source === "dev" ? "Official workflow" : "Community workflow"}</span>
                  </div>
                  <p className="agent-runtime-summary">{agent.latestSummary}</p>
                </div>
                <div className="agent-runtime-badges">
                  <span className={`table-status ${runStateClass}`}>
                    {agent.currentRun?.statusLabel ?? formatStatus(agent.status)}
                  </span>
                  <span className="status-chip neutral">
                    {agent.currentRun?.phaseLabel ?? "Idle"}
                  </span>
                </div>
              </div>

              <dl className="agent-runtime-meta">
                <div>
                  <dt>Updated</dt>
                  <dd>{agent.currentRun?.updatedLabel ?? agent.lastRunLabel}</dd>
                </div>
                <div>
                  <dt>Next step</dt>
                  <dd>{agent.nextStepLabel}</dd>
                </div>
                <div>
                  <dt>Next run</dt>
                  <dd>{agent.nextRunLabel}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>{agent.scheduleLabel}</dd>
                </div>
              </dl>

              {agent.currentRun?.resultCounts ? (
                <div className="metric-chip-row">
                  {Object.entries(agent.currentRun.resultCounts).map(([key, value]) => (
                    <span key={key} className="metric-chip">
                      <strong>{value}</strong>
                      <span>{formatStatus(key)}</span>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="agent-row-actions">
                {actionControls ? (
                  <>
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
                  </>
                ) : null}
                <button
                  className="secondary"
                  onClick={() => onSelectAgent?.(agent)}
                  type="button"
                >
                  {selectedAgentId === agent.id ? "Viewing details" : "View details"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
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

export function AgentDetailPanel({
  agent,
  details,
  activeTab,
  onTabChange,
  editControls,
}: {
  agent?: Agent;
  details: AgentDetailData;
  activeTab: "progress" | "results" | "history";
  onTabChange: (tab: "progress" | "results" | "history") => void;
  editControls?: {
    isSaving?: boolean;
    error?: string | null;
    success?: string | null;
    onSave?: (
      agent: Agent,
      currentValues: Record<string, EditableConfigValue>
    ) => Promise<void> | void;
  };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValues, setCurrentValues] = useState<Record<string, EditableConfigValue>>({});
  const { supportedFields, unsupportedFields } = useMemo(
    () =>
      agent?.config
        ? extractConfigFields(agent.config.inputSchema)
        : { supportedFields: [], unsupportedFields: [] },
    [agent?.config]
  );
  const hasPasswordField = supportedFields.some((field) => field.type === "password");

  useEffect(() => {
    if (!agent?.config) {
      setCurrentValues({});
      return;
    }

    setCurrentValues(getEditableConfigValues(agent.config));
  }, [agent?.config, agent?.id]);

  useEffect(() => {
    setIsEditing(false);
  }, [agent?.id]);

  if (!agent) {
    return (
      <div className="table-shell">
        <p className="empty-state">
          Select an agent to inspect live progress, recent results, and run history.
        </p>
      </div>
    );
  }

  const currentRun = details.currentRun ?? agent.currentRun;
  const debugLink =
    currentRun?.liveUrl && !currentRun.liveUrl.includes("cloud.browser-use.com/tasks/")
      ? currentRun.liveUrl
      : null;

  if (details.isLoading) {
    return (
      <div className="table-shell">
        <p className="empty-state">Loading run details...</p>
      </div>
    );
  }

  return (
    <div className="table-shell detail-shell">
      <div className="detail-shell-header">
        <div>
          <h3>{agent.name}</h3>
          <p>{currentRun?.summary ?? agent.latestSummary}</p>
        </div>
        <div className="agent-runtime-badges">
          <span className={`table-status ${currentRun?.status === "failed" ? "error" : currentRun?.status === "succeeded" ? "active" : currentRun?.status === "waiting_for_input" ? "paused" : agent.status}`}>
            {currentRun?.statusLabel ?? formatStatus(agent.status)}
          </span>
          <span className="status-chip neutral">
            {currentRun?.phaseLabel ?? "Idle"}
          </span>
          {editControls?.onSave && agent.config ? (
            <button
              className="secondary"
              onClick={() => setIsEditing((currentValue) => !currentValue)}
              type="button"
            >
              {isEditing ? "Close editor" : "Edit details"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="tab-strip" role="tablist" aria-label="Agent detail tabs">
        {(["progress", "results", "history"] as const).map((tab) => (
          <button
            key={tab}
            aria-pressed={activeTab === tab}
            className={activeTab === tab ? "tab-pill active" : "tab-pill"}
            onClick={() => onTabChange(tab)}
            type="button"
          >
            {formatStatus(tab)}
          </button>
        ))}
      </div>

      {activeTab === "progress" ? (
        <div className="detail-panel-grid">
          {isEditing && agent.config && editControls?.onSave ? (
            <article className="detail-card detail-card-wide">
              <h4>Edit agent details</h4>
              <form
                className="inline-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await editControls.onSave?.(agent, currentValues);
                }}
              >
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
                            {field.description ? <small className="field-hint">{field.description}</small> : null}
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
                            {field.description ? <small className="field-hint">{field.description}</small> : null}
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
                            type={
                              field.type === "email" || field.type === "url" || field.type === "password"
                                ? field.type
                                : "text"
                            }
                            value={String(value ?? "")}
                          />
                          {field.description ? <small className="field-hint">{field.description}</small> : null}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="form-note">This agent has no editable setup fields.</p>
                )}

                {hasPasswordField ? (
                  <p className="form-note">
                    Leave the password field blank to keep the stored password unchanged.
                  </p>
                ) : null}
                {unsupportedFields.length > 0 ? (
                  <p className="form-note">
                    Some advanced fields are still fixed to their stored values.
                  </p>
                ) : null}
                {editControls.error ? <p className="form-message error">{editControls.error}</p> : null}
                {editControls.success ? <p className="form-message success">{editControls.success}</p> : null}

                <div className="card-actions">
                  <button disabled={editControls.isSaving} type="submit">
                    {editControls.isSaving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setCurrentValues(getEditableConfigValues(agent.config!));
                      setIsEditing(false);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </article>
          ) : null}

          <article className="detail-card">
            <h4>Current run</h4>
            <dl className="detail-list">
              <div>
                <dt>Started</dt>
                <dd>{currentRun?.startedLabel ?? "No run yet"}</dd>
              </div>
              <div>
                <dt>Last update</dt>
                <dd>{currentRun?.updatedLabel ?? "Not available"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{currentRun?.statusLabel ?? "Idle"}</dd>
              </div>
              <div>
                <dt>Phase</dt>
                <dd>{currentRun?.phaseLabel ?? "Idle"}</dd>
              </div>
            </dl>
            {currentRun?.errorCategory ? (
              <p className="form-note">{getRunGuidance(currentRun.errorCategory)}</p>
            ) : null}
            {currentRun?.browserUseTaskId ? (
              <p className="form-note">Task ID: {currentRun.browserUseTaskId}</p>
            ) : null}
            {debugLink ? (
              <a className="text-action" href={debugLink} rel="noreferrer" target="_blank">
                Open provider debug link
              </a>
            ) : null}
          </article>

          <article className="detail-card">
            <h4>Needs your input</h4>
            {details.pendingActions.length > 0 ? (
              <div className="detail-stack">
                {details.pendingActions.map((action) => (
                  <div key={action.id} className="inline-note">
                    <strong>{formatPendingActionType(action.type)}</strong>
                    <span>{action.prompt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No open actions for this agent.</p>
            )}
          </article>

          <article className="detail-card detail-card-wide">
            <h4>Run timeline</h4>
            {details.timeline.length > 0 ? (
              <EventList events={details.timeline} />
            ) : (
              <p className="empty-state">No timeline events yet for this run.</p>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === "results" ? (
        <div className="detail-panel-grid">
          <article className="detail-card">
            <h4>Registration</h4>
            {details.registrationMonitors.length > 0 ? (
              <div className="detail-stack">
                {details.registrationMonitors.map((monitor) => (
                  <div key={monitor.id} className="inline-note">
                    <strong>{monitor.courseNumber} ({monitor.uniqueId})</strong>
                    <span>{monitor.semester} · {formatStatus(monitor.status)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No registration monitor results for this agent.</p>
            )}
          </article>

          <article className="detail-card">
            <h4>Scholarships</h4>
            {details.scholarships.length > 0 ? (
              <div className="detail-stack">
                {details.scholarships.slice(0, 6).map((match) => (
                  <div key={match.id} className="inline-note">
                    <strong>{match.title}</strong>
                    <span>
                      {match.source}
                      {typeof match.matchScore === "number" ? ` · Fit ${(match.matchScore * 100).toFixed(0)}%` : ""}
                      {match.missingFields?.length ? ` · Needs ${match.missingFields.join(", ")}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No scholarship results for this agent.</p>
            )}
          </article>

          <article className="detail-card detail-card-wide">
            <h4>Lab openings</h4>
            {details.labOpenings.length > 0 ? (
              <div className="detail-stack">
                {details.labOpenings.slice(0, 6).map((opening) => (
                  <div key={opening.id} className="inline-note">
                    <strong>{opening.labName}</strong>
                    <span>
                      {opening.professorName} · {opening.department} · {formatStatus(opening.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No lab-opening results for this agent.</p>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="detail-stack">
          {details.runs.length > 0 ? (
            details.runs.map((run) => (
              <article key={run.id} className="history-card">
                <div className="history-card-head">
                  <div>
                    <strong>{run.statusLabel}</strong>
                    <span>{run.phaseLabel}</span>
                  </div>
                  <span>{run.startedLabel}</span>
                </div>
                <p>{run.summary ?? "No summary captured for this run."}</p>
                {run.error ? <p className="form-message error">{run.error}</p> : null}
              </article>
            ))
          ) : (
            <p className="empty-state">This agent has no recorded run history yet.</p>
          )}
        </div>
      ) : null}
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
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPendingActionType(type: string) {
  switch (type) {
    case "email_draft":
      return "Email draft";
    default:
      return formatStatus(type);
  }
}

function getRunGuidance(category: string) {
  switch (category) {
    case "authentication":
      return "Authentication is blocking progress. Recheck the login step or complete Duo before retrying.";
    case "configuration":
      return "This run is missing required configuration. Review the agent setup before retrying.";
    case "site_changed":
      return "The target site likely changed. Review the recent output and update the workflow selectors or prompt.";
    case "provider_error":
      return "The browser provider returned an upstream error. Retry after a short delay.";
    case "timeout":
      return "The run exceeded its polling window. Retry or narrow the target workflow scope.";
    default:
      return "The run failed in a way that needs review before retrying.";
  }
}
