import Link from "next/link";
import type {
  Agent,
  AgentEvent,
  FilterOption,
  MarketplaceTemplate,
  SettingsSection,
  StudioDraft,
} from "../../lib/contracts/types";

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

export function MarketplaceCard({ template }: { template: MarketplaceTemplate }) {
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
      <div className="card-actions">
        <button type="button">Install template</button>
        <button className="secondary" type="button">
          View details
        </button>
      </div>
    </article>
  );
}

export function FilterBar({ options }: { options: FilterOption[] }) {
  return (
    <div className="filter-bar" role="toolbar" aria-label="Filters">
      {options.map((option, index) => (
        <button
          key={option.value}
          className={index === 0 ? "filter-pill active" : "filter-pill"}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AgentTable({ agents }: { agents: Agent[] }) {
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
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
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
            </tr>
          ))}
        </tbody>
      </table>
      <div className="table-actions">
        <button type="button">Pause / resume</button>
        <button className="secondary" type="button">
          Run now
        </button>
        <button className="secondary" type="button">
          Edit schedule
        </button>
        <button className="secondary danger" type="button">
          Delete
        </button>
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

export function StudioQueue({ drafts }: { drafts: StudioDraft[] }) {
  return (
    <div className="studio-queue">
      {drafts.map((draft) => (
        <article key={draft.id} className="queue-card">
          <div className="queue-state">{draft.state}</div>
          <div>
            <h3>{draft.title}</h3>
            <p>{draft.summary}</p>
          </div>
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
