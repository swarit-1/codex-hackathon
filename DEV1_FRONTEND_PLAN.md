# Dev 1 Runbook: Frontend (Next.js Dashboard UX)

## 1) Mission and Ownership

**Owner:** Dev 1 (Frontend Agent)  
**Branch/worktree:** `feature/frontend`  
**Primary goal:** Deliver a production-quality hackathon UI for LonghorNet that supports ScholarBot and RegBot end-to-end first, then FlowForge and settings polish.

### In Scope
- Next.js 14 App Router frontend implementation.
- Auth screen UX, onboarding flow, dashboard home, ScholarBot/RegBot/FlowForge/Settings panels.
- Real-time state rendering from Convex subscriptions.
- Pending-action UX and resume interactions.
- Demo-safe fallback mode in UI.

### Out of Scope
- Convex schema/function implementation (Dev 2).
- Browser Use runtime/agent logic (Dev 3).
- Infrastructure/deployment automation beyond frontend configs.

---

## 2) Non-Negotiables (Shared Contracts)

## Canonical Enums
- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`

## Required Backend Contracts (must consume exactly)
- `dashboard.getOverview(userId)`
- `users.upsertProfile(payload)`, `users.getProfile()`
- `agents.create(type, config)`, `agents.updateStatus(agentId, status)`, `agents.listByUser()`
- `scholarships.listByUser(filters)`, `scholarships.upsertFromRun(payload)`
- `registrationMonitors.create(payload)`, `registrationMonitors.listByUser()`
- `pendingActions.create(payload)`, `pendingActions.resolve(actionId, response)`
- `customWorkflows.create(payload)`, `customWorkflows.update(agentId, patch)`
- `agentLogs.append(payload)`, `agentLogs.list(agentId, pagination)`

## Required Orchestration Interfaces (must reflect statuses/events)
- `orchestrator.triggerAgentRun(agentId, runType)`
- `orchestrator.handleWebhook(eventPayload)`
- `orchestrator.resumeFromPendingAction(actionId)`
- `flowforge.generateWorkflowSpec(nlDescription)`
- `flowforge.generateAgentScript(spec)`

## UI Data Contracts to Lock
- One dashboard subscription payload: overview metrics + pending actions + latest run events.
- Per-panel list/detail payloads for scholarships, registration monitors, custom workflows, and logs.

---

## 3) Coordination Rules (Must Follow)

1. Contract freeze points: after **Phase 1** and **Phase 3**.
2. Sync cadence: every 30 minutes with Dev 2 and Dev 3.
3. Hard integration windows: midpoint and pre-demo.
4. Merge policy: merge only after local tests pass + one integration smoke test.
5. Blocker protocol: if blocked >20 minutes, publish blocker note with owner, dependency, fallback.
6. Demo priority: ScholarBot + RegBot full demo path takes precedence over FlowForge enhancements.

---

## 4) Working Setup and File Conventions

## Recommended frontend structure
```txt
apps/web/
  app/
    page.tsx
    dashboard/page.tsx
    scholarbot/page.tsx
    regbot/page.tsx
    flowforge/page.tsx
    settings/page.tsx
  components/
    dashboard/
    scholarbot/
    regbot/
    flowforge/
    settings/
    shared/
  lib/
    convex/
    contracts/
    utils/
  styles/
```

## Tracking artifacts (must maintain)
- `docs/coordination/frontend-known-issues.md`
- `docs/coordination/frontend-phase-checklists.md`
- `docs/contracts/frontend-data-needs.md`

---

## 5) Phase-by-Phase Execution

## Phase 0 (30-45 min): Setup and Shell
**Objective:** Bootstrap runnable Next.js app with route skeleton and visual foundation.

### Tasks
1. Initialize Next.js 14 + TypeScript + App Router.
2. Install/configure Tailwind CSS and shadcn/ui.
3. Build base app layout with navigation to: `/`, `/dashboard`, `/scholarbot`, `/regbot`, `/flowforge`, `/settings`.
4. Add shared design tokens (colors, spacing, status chip styles) to avoid one-off styling.
5. Add Convex provider wiring and placeholder hooks layer.
6. Add error boundary and loading skeleton components.

### Deliverables
- All six routes render.
- Shared layout/nav and status chip component committed.
- Placeholder data hooks in place.
- Phase checklist + known issues log updated.

### Acceptance Criteria
- `npm run dev` starts cleanly.
- No blocking TypeScript errors.
- Every route has a distinct scaffold view and loading state.

### Handoff Needed
- Dev 2: initial function names and payload placeholders.
- Dev 3: initial event/status taxonomy for run-state display.

---

## Phase 1: Auth + Onboarding
**Objective:** Implement login screen and complete onboarding wizard bound to profile schema.

### Tasks
1. Build landing/auth page:
   - UT SSO button as primary CTA.
   - Email/password fallback as secondary.
2. Build onboarding multi-step flow with exact PRD fields:
   - `name`, `major`, `GPA`, `classification`, `interests`, demographics, financial-need indicators.
3. Implement client-side validation:
   - Required fields and bounds (GPA format and range).
4. Connect onboarding submit to `users.upsertProfile(payload)`.
5. Load initial values from `users.getProfile()` for resume/edit behavior.
6. Add route guard:
   - If no completed profile, redirect to onboarding.

### Deliverables
- Auth page + onboarding wizard fully interactive.
- Profile save/reload path working via Convex contracts or stub.
- Validation errors and success messages implemented.

### Acceptance Criteria
- New user can finish onboarding in one pass.
- Returning user sees saved profile values.
- Guarded navigation blocks dashboard until onboarding complete.

### Tests
- Route rendering and guard behavior.
- Validation checks for required fields and invalid GPA.
- Submission success/error UX paths.

### Handoff Needed
- Dev 2: finalized profile payload shape after Phase 1 contract freeze.

---

## Phase 2: Dashboard Home
**Objective:** Build real-time operational dashboard with quick actions and action queue.

### Tasks
1. Build overview cards:
   - Active agents count.
   - Pending actions count.
   - Recent activity summary.
2. Subscribe to `dashboard.getOverview(userId)` and render live updates.
3. Add quick action buttons:
   - Add Scholarship Monitor.
   - Watch a Course.
   - Create Workflow.
4. Build recent activity feed panel with status chips and timestamps.
5. Add robust empty/loading/error states for each dashboard module.

### Deliverables
- Dashboard home connected to live overview payload.
- Quick actions route correctly.
- Activity feed updates without refresh.

### Acceptance Criteria
- Overview values update in near real time as backend data changes.
- No manual refresh required for status transitions.

### Tests
- Subscription update rendering.
- Empty/feed fallback behavior.
- Quick action navigation smoke test.

### Handoff Needed
- Dev 2: stable `dashboard.getOverview` payload.
- Dev 3: run event names and severity mapping.

---

## Phase 3: ScholarBot + RegBot Panels
**Objective:** Build all MVP-critical workflows for scholarship and registration monitoring.

### Tasks
1. ScholarBot panel:
   - Scholarship table/list with match score, deadline, status.
   - Scholarship detail view showing progress and required fields.
   - Pending action component with inline essay editor and resume action.
2. RegBot panel:
   - Watchlist with statuses (`watching`, `registered`, `failed`).
   - Add course form (department+number or unique ID).
   - Poll history/log timeline with timestamps and screenshot links.
3. Shared log viewer:
   - Display event, timestamp, details, screenshot references.
4. Wire actions:
   - Resolve pending actions via `pendingActions.resolve(actionId, response)`.
   - Create/update monitors via monitor contracts.

### Deliverables
- ScholarBot and RegBot panels fully wired.
- Resume flow and watchlist create flow working.
- Log viewer usable for demo storytelling.

### Acceptance Criteria
- Can demonstrate: scholarship pause -> user input -> resume trigger.
- Can demonstrate: monitor creation -> status transitions -> logs visible.

### Tests
- Pending-action resolve optimistic update and rollback.
- Scholarship list/detail rendering.
- Monitor create/list/update rendering flow.

### Handoff Needed
- Dev 2: stable scholarship/monitor/pending/log query contracts after Phase 3 freeze.
- Dev 3: webhook status mapping and screenshot metadata format.

---

## Phase 4: FlowForge + Settings
**Objective:** Implement should-have UX for custom workflow creation and credentials/settings.

### Tasks
1. FlowForge page:
   - Natural language input with examples.
   - Preview confirmation card from generated workflow interpretation.
   - Deploy, pause, edit, delete controls tied to workflow contracts.
2. Settings page:
   - Profile editor (reuse onboarding schemas where possible).
   - Credential vault UX (encryption indicators, never display secrets in plain text).
   - Notification preference controls.
3. Display custom workflow results/log snippets on page.

### Deliverables
- End-to-end UI flow for prompt -> preview -> deploy.
- Settings sections visible and functional.

### Acceptance Criteria
- FlowForge generates preview and submits deployment request.
- User can manage workflow lifecycle states from UI.

### Tests
- FlowForge form validation and preview confirmation.
- Settings save and reload behavior.

### Handoff Needed
- Dev 2: `customWorkflows` and settings persistence contracts.
- Dev 3: preview text + run-result payload structure.

---

## Phase 5: Polish + Demo Mode
**Objective:** Hardening and presentation readiness for live demo.

### Tasks
1. Add comprehensive loading/empty/error UX across all panels.
2. Ensure mobile-responsive layout (minimum acceptable).
3. Implement demo mode toggles:
   - Use mock fallback payloads when integrations are unavailable.
   - Visually indicate demo fallback state.
4. Perform visual consistency pass and accessibility pass (focus states, labels).
5. Clean console warnings and remove dead UI code.

### Deliverables
- Demo-ready UI with fallback behavior.
- Updated known issues with residual risks and workarounds.
- Final frontend acceptance checklist marked complete.

### Acceptance Criteria
- Full UI demo runs even if one external system is degraded.
- No blocking TS/build errors.
- Core views usable on desktop and mobile.

---

## 6) Data Dependencies by Phase (Dev 2 + Dev 3)

| Phase | Needs from Dev 2 | Needs from Dev 3 |
|---|---|---|
| 0 | provisional function names | provisional event states |
| 1 | `users.getProfile`, `users.upsertProfile` schema | none |
| 2 | `dashboard.getOverview` payload shape | run event list for feed |
| 3 | scholarship/monitor/pending/log contracts | screenshot metadata + run-state mapping |
| 4 | workflow/settings contracts | preview + generated-script status payloads |
| 5 | stable prod-like payloads for demo mode | replay payloads for fallback demo |

---

## 7) Frontend Definition of Done (Final)

1. All core routes and panels run and are integrated.
2. Must-have UI flows are connected to backend stubs/live functions.
3. No blocking TypeScript errors; local build is stable.
4. Mobile layout is acceptable for demo and judge interaction.
5. Known issues log documents non-blocking defects and mitigations.

---

## 8) Escalation and Blocker Playbook

When blocked more than 20 minutes:
1. Post blocker note with:
   - `Issue`
   - `Dependency Owner (Dev 2 or Dev 3)`
   - `Needed by time`
   - `Fallback path`
2. Activate fallback:
   - Use local type-safe mocks.
   - Keep UI integration points unchanged.
3. Re-sync at next 30-minute checkpoint and either:
   - Replace mocks with real contracts, or
   - Lock fallback for demo and document limitation.

