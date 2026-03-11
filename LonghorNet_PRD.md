# LonghorNet — Product Requirements Document

**Marketplace and Autonomous Agent Platform for UT Austin Students**

OpenAI x UT Austin — Codex Hackathon | Theme: Build it Forward | March 10–11, 2026

---

## 1. Executive Summary

LonghorNet is an AI platform where UT students can discover and deploy automation agents from a marketplace, manage all active automations from one control center, and generate new agents from natural language. The product is organized around three primary surfaces:

1. **Marketplace:** Browse dev-built templates and student-built templates.
2. **My Agents:** Operate currently running agents with clear controls and logs.
3. **Model-to-Agent Studio:** Describe a workflow in natural language and generate a deployable agent.

ScholarBot and RegBot remain core flagship flows, now delivered as first-party templates in the marketplace.

---

## 2. Problem Statement

### 2.1 Scholarship Discovery and Application

UT students miss scholarship opportunities because discovery is fragmented across portals and applications are repetitive.

### 2.2 Course Registration

Course registration for high-demand classes still depends on manual monitoring and split-second action.

### 2.3 Repetitive Web Workflows

Students repeatedly perform browser tasks (status checks, recurring forms, application tracking) without practical no-code automation.

### 2.4 Discovery and Agent Management Fragmentation

Even when automations exist, students lack:
- A trusted place to discover reusable templates.
- A way to compare official templates vs student-created templates.
- A single operational panel to manage all running agents (pause/resume, run now, schedule edits, logs).

---

## 3. Solution Overview

LonghorNet provides a marketplace-centric product with three primary surfaces:

| Surface | What It Does | How It Works |
|---|---|---|
| **Marketplace** | Catalog of reusable agent templates from LonghorNet devs and students. | Templates are stored in Convex with metadata, moderation status, and install actions that instantiate user-owned agents. |
| **My Agents** | Operational control center for currently running automations. | User sees all active/inactive agents with controls for pause/resume/run now/edit schedule/delete and log inspection. |
| **Model-to-Agent Studio** | Natural language to deployable agent generation. | LLM converts prompt to workflow spec, generates script, validates via dry run, installs as a private template/agent instance. |

Flagship first-party templates:
- **ScholarBot template:** scholarship discovery, matching, apply pause/resume.
- **RegBot template:** registration seat monitoring and fast registration path.

---

## 4. Target Users

**Primary:** UT Austin students needing faster access to scholarships, classes, and repetitive web workflows.

**Secondary:** Student org leaders and power users who create and publish reusable workflow templates for peers.

---

## 5. Technical Architecture

### 5.1 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui |
| Backend / DB | Convex (real-time DB, serverless functions, cron jobs, file storage) |
| Agent Runtime | Browser Use Cloud API |
| Auth | Convex Auth + UT SSO (stretch) + email/password fallback |
| AI / LLM | OpenAI GPT-4o for matching, workflow interpretation, and script generation |
| Scheduling | Convex cron + runtime scheduling metadata |
| Deployment | Vercel (frontend), Convex Cloud (backend) |

### 5.2 System Architecture

1. **Presentation Layer (Next.js):** Marketplace browsing, My Agents operations, Model-to-Agent Studio authoring, and live status rendering.
2. **Orchestration Layer (Convex):** Template catalog, installs, submissions, moderation state, agent lifecycle control, and user notification hooks.
3. **Execution Layer (Browser Use Cloud):** Agent runs and callbacks/webhooks into Convex logs and statuses.

### 5.3 Data Model (Convex Schema)

| Table | Key Fields | Purpose |
|---|---|---|
| `users` | name, email, eid, authMethod, profileData, createdAt | User identity and profile context. |
| `marketplaceTemplates` | title, description, source (`dev`\|`student`), category, visibility (`private`\|`public`), installCount, ownerUserId?, templateConfig, createdAt | Marketplace catalog entries and template metadata. |
| `templateSubmissions` | userId, templateId?, draftPayload, status (`draft`\|`pending_review`\|`approved`\|`rejected`), reviewerId?, reviewNotes?, createdAt, updatedAt | Student publish pipeline and moderation queue. |
| `agents` | userId, templateId, ownerType (`first_party`\|`student`\|`generated`), type (`scholar`\|`reg`\|`custom`), status (`active`\|`paused`\|`completed`\|`error`), config, schedule, lastRunStatus, lastRunAt, nextRunAt, browserUseTaskId | Installed and user-owned runtime instances. |
| `scholarships` | title, source, deadline, eligibility, matchScore, status, agentId, missingFields[] | ScholarBot result state. |
| `registrationMonitors` | userId, courseNumber, uniqueId, semester, status, pollInterval, agentId | RegBot monitor state per course. |
| `pendingActions` | userId, agentId, type, prompt, response, resolvedAt | Human-in-the-loop actions. |
| `agentLogs` | agentId, timestamp, event, details, screenshots[], scenarioId? | Operational and audit logs for all runs. |

---

## 6. Feature Specifications

### 6.1 Marketplace

#### User Flow

1. User opens Marketplace and sees two tabs: **Dev-built** and **Student-built**.
2. User filters templates by category and use case.
3. User opens template details to view summary, required inputs, run schedule defaults, and install count.
4. User clicks **Install Template** and provides configuration.
5. System creates a user-owned `agents` entry linked to the template.
6. Agent appears immediately in **My Agents**.

#### Technical Details

- `marketplace.listTemplates(filters)` serves tab/filter/pagination.
- `marketplace.getTemplate(templateId)` serves template detail payload.
- `marketplace.installTemplate(templateId, config)` creates user-owned agent instance.
- Dev templates are pre-approved; student templates are approved from moderation queue.

#### Edge Cases

- Template removed after install: installed instance continues unless disabled by policy.
- Invalid template config: validation error with field-level feedback.
- Duplicate install attempts: backend returns existing install or explicit duplicate response.

### 6.2 My Agents (Operational Control Center)

#### User Flow

1. User opens My Agents and sees all installed/running agents.
2. User filters by type, status, and source.
3. User can take actions: pause/resume, run now, edit schedule, delete.
4. User opens logs per agent to inspect progress, failures, and screenshots.

#### Technical Details

- Uses `agents.listByUser()` as primary feed.
- Operational controls:
  - `agents.updateStatus(agentId, status)`
  - `agents.runNow(agentId)`
  - `agents.updateSchedule(agentId, schedule)`
  - `agents.delete(agentId)`
- `agentLogs.list(agentId, pagination)` powers timeline view.

#### Edge Cases

- Run-now requested while already running: return idempotent response with current run state.
- Schedule conflicts or invalid cron: reject with validation guidance.
- Delete during active run: stop request and safe termination policy.

### 6.3 ScholarBot (First-Party Dev Template)

#### User Flow

1. User installs ScholarBot from Dev-built templates.
2. User sets scholarship sources and profile inputs.
3. Agent scans, matches, starts form filling, then pauses for missing human fields.
4. User resolves pending action; agent resumes and submits.

#### Technical Details

- GPT-4o matching + required-field extraction.
- Resume checkpoints persisted in Convex.
- Status events feed My Agents and logs.

#### Edge Cases

- Site layout changes trigger fallback selectors and error logging.
- Expired deadlines move applications to `expired` state.

### 6.4 RegBot (First-Party Dev Template)

#### User Flow

1. User installs RegBot from Dev-built templates.
2. User adds course monitor inputs.
3. Agent polls seat availability and triggers registration when open.
4. Duo timeout/failure follows retry policy and logs outcome.

#### Technical Details

- Poll cadence default: every 10 minutes with jitter.
- Duo timeout path and retry scheduling are first-class states.

#### Edge Cases

- Seat race loss after detection.
- Time conflict prompt requiring user confirmation.
- UT system outage with exponential backoff.

### 6.5 Model-to-Agent Studio (formerly FlowForge)

#### User Flow

1. User enters natural language task in Studio.
2. LLM generates workflow spec preview.
3. User confirms/edits and deploys.
4. Generated workflow installs as private template + agent instance.
5. User may optionally submit it to marketplace moderation queue.

#### Technical Details

- Compatibility alias preserved for MVP internals:
  - `flowforge.generateWorkflowSpec(...)`
  - `flowforge.generateAgentScript(...)`
- Studio output can stay private or enter `templateSubmissions` as `pending_review`.

#### Edge Cases

- Ambiguous prompt requests clarifying questions.
- Repeated dry-run failure auto-pauses and returns actionable diagnostics.

---

## 7. Dashboard UI / Information Architecture

### 7.1 Primary Pages and Components

**Landing / Auth**
- UT SSO primary button and email/password fallback.
- Onboarding for baseline profile and template personalization.

**Marketplace Page**
- Tabs: `Dev-built`, `Student-built`.
- Template cards: title, source, category, install count, status badges.
- Template detail panel with install CTA.
- Student publish submission form and pending-review badge.

**My Agents Page**
- Agent list with status, source, next run, last run.
- Controls: pause/resume, run now, edit schedule, delete.
- Per-agent logs with timeline and screenshots.

**Model-to-Agent Studio Page**
- Natural language input, preview, deploy control.
- Generated workflow list and lifecycle status.
- Optional publish-to-marketplace action.

**Settings**
- Profile, credential vault, notification preferences.

---

## 8. Security and Privacy

- Credentials encrypted at rest (AES-256) and only decrypted in runtime context.
- Strict row-level authorization for templates, submissions, installs, and agents.
- Student submissions moderated before public visibility.
- All runs and key actions logged with timestamps and evidence artifacts.
- Transport encryption for all service calls.

---

## 9. Codex Development Strategy

### 9.1 Parallel Agent Architecture (4 Dev Tracks)

| Dev | Scope | Branch |
|---|---|---|
| Dev 1 | Marketplace/My Agents/Studio UI | `feature/frontend` |
| Dev 2 | Convex schema/contracts/security/cron | `feature/backend` |
| Dev 3 | Runtime instantiation/execution/retries | `feature/agents-runtime` |
| Dev 4 | Integration QA, contract freezes, release gate | `feature/integration-qa` |

### 9.2 Development Rules

- Contract freeze points: `v1-freeze` (after Phase 1), `v2-freeze` (after Phase 3).
- 30-minute cross-team sync cadence.
- Release-blocking priority: ScholarBot + RegBot + My Agents operations.

---

## 10. MVP Scope and Hackathon Timeline

### 10.1 Must-Have (MVP)

- Marketplace UI with Dev-built + Student-built tabs.
- Install flow for at least one dev-built template and one approved student template.
- My Agents operational controls: pause/resume/run now/edit schedule/delete.
- ScholarBot and RegBot as installable first-party templates.
- Model-to-Agent Studio generating and deploying one working agent.
- Pending-review submission flow for student publish pipeline.

### 10.2 Should-Have

- Lightweight moderation action panel (`approve`/`reject`).
- Rich log viewer with screenshots and run traces.
- Email/in-app notifications for key run outcomes.

### 10.3 Nice-to-Have

- Template ranking and recommendation signals.
- Advanced schedule presets and per-agent analytics.
- Mobile UI polish across all primary pages.

### 10.4 Timeline

| Time Block | Focus |
|---|---|
| 5:30–6:00 PM | Setup, branch/worktree creation, contracts bootstrap |
| 6:00–8:30 PM | Marketplace + schema/runtime scaffolds in parallel |
| 8:30 PM–12:00 AM | Core install + My Agents operations + ScholarBot/RegBot template flow |
| 12:00–4:00 AM | Studio pipeline + submission moderation + reliability paths |
| 4:00–8:00 AM | E2E integration, defect closure, demo script hardening |
| 8:00–10:00 AM | Final freeze, release gate, submission |

---

## 11. Demo and Pitch Strategy

1. Show Marketplace with dev-built and student-built template browsing.
2. Install ScholarBot or RegBot from Marketplace into My Agents.
3. Demonstrate My Agents operational control (`run now`, pause/resume, schedule edit, logs).
4. Use Model-to-Agent Studio to generate one custom workflow and deploy.
5. Show pending-review student submission and moderation transition.

---

## 12. Success Metrics

- Users can install templates from both Marketplace tabs.
- My Agents supports full operational controls with consistent status updates.
- Model-to-Agent Studio deploys at least one generated workflow.
- Student submission transitions from `pending_review` to `approved` and appears in Student-built tab.
- ScholarBot and RegBot still execute end-to-end as first-party templates.

---

## 13. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Low-quality student templates | Poor user trust | Moderation queue with approve/reject before public listing |
| Contract drift across 4 teams | Integration failures | Dev 4-managed `v1-freeze` and `v2-freeze` process |
| Runtime instability in live demo | Broken end-to-end flow | Replay fixtures + fallback runbook in My Agents logs |
| Scope creep in marketplace extras | MVP misses deadline | Keep ratings/reviews out of this revision |
| Naming confusion during transition | Inconsistent UX/implementation | Product term is "Model-to-Agent Studio" with documented `flowforge.*` alias |

---

Hook 'em. Build it forward.
