# Dev 1 Runbook: Frontend (Marketplace UI + My Agents + Model-to-Agent Studio)

## 1) Mission and Ownership

**Owner:** Dev 1 (Frontend)
**Branch/worktree:** `feature/frontend`
**Primary goal:** Deliver the marketplace-first product interface with production-ready UX for Marketplace, My Agents, and Model-to-Agent Studio.

### Ownership Boundaries
- Own all frontend routes, components, interaction logic, and real-time rendering.
- Do not implement backend schema/contracts (Dev 2) or runtime execution logic (Dev 3).
- Close integration/UI defects reported by Dev 4 release-gate testing.

---

## 2) Shared Contracts and Types (Locked Across All 4 Devs)

### Canonical Status Types
- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`
- `TemplateSource = "dev" | "student"`
- `SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected"`
- `TemplateVisibility = "private" | "public"`

### Required APIs (Consume As-Is)
- Existing:
  - `dashboard.getOverview(userId)`
  - `users.upsertProfile(payload)` / `users.getProfile()`
  - `agents.create(type, config)` / `agents.updateStatus(agentId, status)` / `agents.listByUser()`
  - `scholarships.listByUser(filters)` / `scholarships.upsertFromRun(payload)`
  - `registrationMonitors.create(payload)` / `registrationMonitors.listByUser()`
  - `pendingActions.create(payload)` / `pendingActions.resolve(actionId, response)`
  - `customWorkflows.create(payload)` / `customWorkflows.update(agentId, patch)`
  - `agentLogs.append(payload)` / `agentLogs.list(agentId, pagination)`
- Added:
  - `marketplace.listTemplates(filters)`
  - `marketplace.getTemplate(templateId)`
  - `marketplace.installTemplate(templateId, config)`
  - `marketplace.submitTemplate(payload)`
  - `marketplace.reviewSubmission(submissionId, decision)`
  - `agents.runNow(agentId)`
  - `agents.updateSchedule(agentId, schedule)`
  - `agents.delete(agentId)`

### Naming Policy
- Product/UI terminology: **Model-to-Agent Studio**.
- Compatibility alias allowed in integration payloads: `flowforge.*` internal contracts.

### Shared Test Scenario IDs
- Existing: `scholarbot_happy_path`, `regbot_happy_path`, `flowforge_happy_path`, `regbot_duo_timeout`, `webhook_retry_path`
- Added: `marketplace_install_dev_template`, `marketplace_install_student_template`, `submission_pending_to_approved`, `my_agents_run_now`, `my_agents_schedule_update`

### Contract Freeze Process (Owned by Dev 4)
- `v1-freeze` after Phase 1.
- `v2-freeze` after Phase 3.
- Any post-freeze changes require Dev 4 ticket + compatibility note.

---

## 3) Coordination Rules

1. 30-minute sync cadence with Dev 2/3/4.
2. Freeze points after Phase 1 and Phase 3.
3. Merge only after local tests + one integration smoke pass.
4. Blocker SLA: blocked >20 minutes must include fallback.
5. Priority order: Marketplace/My Agents must-have flows, then Studio polish.

---

## 4) Phase-by-Phase Execution (IA Order Locked)

### Phase 0: Frontend Foundation
**Objective:** Prepare route shell and shared UI primitives for new IA.

**Tasks**
1. Establish top-level routes for `/marketplace`, `/my-agents`, `/studio` (and auth/settings).
2. Build shared layout/nav and status badge components.
3. Add typed client contracts for all shared types and new APIs.

**Deliverables**
- Route shell, navigation, base loading/empty/error components.

### Phase 1: Marketplace UI
**Objective:** Build browse/install/publish UX for dev and student templates.

**Tasks**
1. Implement Marketplace tabs: `dev-built`, `student-built`.
2. Implement template cards with source, category, install count, and status badges.
3. Implement template detail view and install CTA.
4. Implement student submission form with `pending_review` badge state.

**Deliverables**
- End-to-end UI for listing and installing templates.

**Acceptance Criteria**
- `marketplace_install_dev_template` renders correctly.
- `marketplace_install_student_template` renders correctly.
- `v1-freeze` acknowledged by Dev 4.

### Phase 2: My Agents UI
**Objective:** Build operational control center for running instances.

**Tasks**
1. Implement agent list with filtering (status/type/source).
2. Add controls: pause/resume, run now, edit schedule, delete.
3. Add per-agent log timeline and screenshot references.

**Deliverables**
- My Agents panel with complete operational controls.

**Acceptance Criteria**
- UI paths for `my_agents_run_now` and `my_agents_schedule_update` are stable.

### Phase 3: Model-to-Agent Studio UI
**Objective:** Build natural language generation + deploy workflow UX.

**Tasks**
1. Build prompt input, preview/confirmation, and deploy UX.
2. Display generated workflow status and run output references.
3. Add optional "publish to marketplace" action.

**Deliverables**
- Studio flow usable for one full prompt-to-deploy cycle.

**Acceptance Criteria**
- `flowforge_happy_path` (Studio alias) is visually and functionally complete.
- `v2-freeze` acknowledged by Dev 4.

### Phase 4: Legacy Feature Surface Alignment
**Objective:** Ensure ScholarBot/RegBot are represented as first-party templates.

**Tasks**
1. Update ScholarBot/RegBot UI entry points to originate from Marketplace installs.
2. Ensure pending-action UX and monitor UX remain accessible from My Agents.
3. Remove outdated IA references from UI copy.

**Deliverables**
- ScholarBot/RegBot integrated into marketplace-centric IA.

### Phase 5: UI Polish + Dev4 Defect Closure
**Objective:** Close release-blocking UI issues from Dev 4 reports.

**Tasks**
1. Fix Sev-1 and Sev-2 defects tied to marketplace/my-agents/studio scenarios.
2. Improve responsiveness and edge-state messaging.
3. Re-verify all scenario IDs with Dev 4 fixture packs.

**Deliverables**
- Final UI defect closure log and release-candidate signoff input.

**Acceptance Criteria**
- No open release-blocking UI defects for required scenarios.

---

## 5) Dependencies and Handoffs

| Phase | Input Needed | Owner |
|---|---|---|
| 0 | typed API signatures + event taxonomy | Dev 2 + Dev 3 |
| 1 | marketplace list/detail/install payloads | Dev 2 |
| 2 | run-now/schedule/delete semantics + logs payload | Dev 2 + Dev 3 |
| 3 | Studio generation/deploy status payloads | Dev 3 |
| 4 | template-source mapping for first-party templates | Dev 2 |
| 5 | defect queue and pass/fail gates | Dev 4 |

---

## 6) Dev 1 Test Responsibilities

1. Route/render tests for Marketplace, My Agents, Studio.
2. Marketplace tab/filter/install and submission badge-state tests.
3. My Agents control action UX tests (run now/schedule/delete).
4. Studio prompt-preview-deploy flow rendering tests.
5. Regression checks against Dev 4 fixture payloads.

---

## 7) Definition of Done

1. Marketplace UI supports dev and student template flows.
2. My Agents supports all required operational controls.
3. Model-to-Agent Studio UX is functional and aligned with naming policy.
4. All freeze-stamped contracts are respected with no release-blocking UI drift.

---

## 8) Escalation Protocol

If blocked >20 minutes:
1. Publish blocker with scenario ID and dependency owner.
2. Use typed fixture fallback only if contract owner is unavailable.
3. Notify Dev 4 so release-risk board stays current.
