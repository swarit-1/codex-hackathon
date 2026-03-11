# Dev 2 Runbook: Backend (Marketplace + Agent Operations + Security)

## 1) Mission and Ownership

**Owner:** Dev 2 (Backend)
**Branch/worktree:** `feature/backend`
**Primary goal:** Provide Convex schema and contract surface for marketplace-driven discovery, agent lifecycle operations, and Studio-generated automation.

### Ownership Boundaries
- Own schema, indexes, queries/mutations/actions, authz, encryption, scheduling metadata, and observability contracts.
- Do not own frontend UX (Dev 1) or browser runtime execution internals (Dev 3).
- Provide deterministic fixtures and stable error taxonomy required by Dev 4.

---

## 2) Shared Contracts and Types (Locked Across All 4 Devs)

### Canonical Types
- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`
- `TemplateSource = "dev" | "student"`
- `SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected"`
- `TemplateVisibility = "private" | "public"`

### Existing Contract Surface (Preserve)
- `dashboard.getOverview(userId)`
- `users.upsertProfile(payload)` / `users.getProfile()`
- `agents.create(type, config)` / `agents.updateStatus(agentId, status)` / `agents.listByUser()`
- `scholarships.listByUser(filters)` / `scholarships.upsertFromRun(payload)`
- `registrationMonitors.create(payload)` / `registrationMonitors.listByUser()`
- `pendingActions.create(payload)` / `pendingActions.resolve(actionId, response)`
- `customWorkflows.create(payload)` / `customWorkflows.update(agentId, patch)`
- `agentLogs.append(payload)` / `agentLogs.list(agentId, pagination)`

### Added Contract Surface
- `marketplace.listTemplates(filters)`
- `marketplace.getTemplate(templateId)`
- `marketplace.installTemplate(templateId, config)`
- `marketplace.submitTemplate(payload)`
- `marketplace.reviewSubmission(submissionId, decision)`
- `agents.runNow(agentId)`
- `agents.updateSchedule(agentId, schedule)`
- `agents.delete(agentId)`

### Naming Policy
- External/product term: **Model-to-Agent Studio**.
- Internal alias allowed for MVP compatibility: `flowforge.*` contract namespace.

### Shared Test Scenario IDs
- Existing: `scholarbot_happy_path`, `regbot_happy_path`, `flowforge_happy_path`, `regbot_duo_timeout`, `webhook_retry_path`
- Added: `marketplace_install_dev_template`, `marketplace_install_student_template`, `submission_pending_to_approved`, `my_agents_run_now`, `my_agents_schedule_update`

### Contract Freeze Process (Dev 4 Owned)
- `v1-freeze` after Phase 1.
- `v2-freeze` after Phase 3.
- Post-freeze changes require approved change ticket + compatibility note.

---

## 3) Coordination Rules

1. Sync with Dev 1/3/4 every 30 minutes.
2. Freeze compliance required after Phase 1 and Phase 3.
3. Merge requires local pass + integration smoke pass.
4. Blockers >20 minutes require fallback and owner assignment.
5. MVP order: marketplace install + my-agents operations + first-party template runs.

---

## 4) Phase-by-Phase Execution

### Phase 0: Backend Foundation
**Objective:** Prepare backend modules and typed contracts for revised IA.

**Tasks**
1. Confirm module boundaries for marketplace, agent operations, submissions, and logs.
2. Create shared type definitions for new marketplace/submission enums.
3. Scaffold contract handlers with stable signatures.

**Deliverables**
- Compiling contract scaffold with all required function names.

### Phase 1: Schema + Indexes for Marketplace-Centric Model
**Objective:** Implement persistent model for templates, submissions, and installed agents.

**Tasks**
1. Add/extend schema tables:
   - `marketplaceTemplates`
   - `templateSubmissions`
   - expanded `agents` with `templateId`, `ownerType`, `schedule`, `lastRunStatus`
2. Add indexes for source/status/visibility/filtering and moderation queue reads.
3. Document schema and id conventions for Dev 1/3/4.

**Deliverables**
- Query-efficient schema for Marketplace and My Agents.

**Acceptance Criteria**
- `v1-freeze` contract shapes approved by Dev 4.

### Phase 2: Marketplace + My Agents API Contracts
**Objective:** Deliver operational APIs for install/manage workflows.

**Tasks**
1. Implement all added marketplace and agent-operation APIs.
2. Ensure installation creates correctly linked user-owned agent instances.
3. Ensure review actions transition `pending_review -> approved/rejected`.
4. Maintain idempotent behavior for run-now and install operations.

**Deliverables**
- Stable API surface for Marketplace and My Agents controls.

### Phase 3: Security and Moderation Authorization
**Objective:** Enforce role-safe access across publishing and operations.

**Tasks**
1. Extend row-level authz to template submissions and review actions.
2. Keep AES-256 credential boundaries intact for runtime secrets.
3. Restrict review endpoints to authorized moderation role policy.
4. Standardize explicit permission and validation error codes.

**Deliverables**
- Secure contract layer covering marketplace moderation and agent operations.

**Acceptance Criteria**
- `v2-freeze` issued by Dev 4 with no unresolved authz drift.

### Phase 4: Scheduling/Run Control Integration
**Objective:** Support real operational controls from My Agents.

**Tasks**
1. Implement schedule update persistence and validation.
2. Implement `runNow` trigger handoff semantics to runtime orchestration.
3. Implement safe delete semantics for active and inactive instances.
4. Emit operation events for run-now/schedule/delete for UI and QA visibility.

**Deliverables**
- Backend support for full My Agents control surface.

### Phase 5: Observability + Fixture Pack for Dev4
**Objective:** Finalize deterministic testability and release diagnostics.

**Tasks**
1. Create deterministic fixtures for all shared scenarios (existing + added).
2. Stabilize error taxonomy and operation trace fields.
3. Provide contract payload examples for Marketplace/My Agents/Studio flows.
4. Add scenario ID tagging in logs for QA traceability.

**Deliverables**
- Integration-ready fixture and diagnostics package.

**Acceptance Criteria**
- Dev 4 can run contract/E2E gates without backend code modifications.

---

## 5) Dependencies and Handoffs

| Phase | Handoff | Receiver |
|---|---|---|
| 0 | draft signatures and enum types | Dev 1 + Dev 3 |
| 1 | schema docs and index behavior | Dev 1 + Dev 3 + Dev 4 |
| 2 | marketplace + my-agents payload samples | Dev 1 + Dev 3 + Dev 4 |
| 3 | moderation/authz policy details | Dev 4 |
| 4 | run-now/schedule/delete backend semantics | Dev 1 + Dev 3 + Dev 4 |
| 5 | deterministic fixture bundle + taxonomy | Dev 4 |

---

## 6) Dev 2 Test Responsibilities

1. Schema and index query tests for template/submission/agent operations.
2. Authorization tests for user vs moderator actions.
3. Security tests for credential encryption boundaries.
4. Idempotency tests for install and run-now operations.
5. Fixture validation for all shared scenario IDs.

---

## 7) Definition of Done

1. Marketplace and My Agents backend contracts are stable and documented.
2. Moderation and operational authorization rules are enforced.
3. Run-now/schedule/delete flows are production-safe.
4. Dev 4 can gate release with deterministic backend fixtures and logs.

---

## 8) Escalation Protocol

If blocked >20 minutes:
1. Publish blocker with impacted API and scenario ID.
2. Preserve function signatures and return deterministic fallback errors if needed.
3. Notify Dev 4 to update freeze and release-risk tracking.
