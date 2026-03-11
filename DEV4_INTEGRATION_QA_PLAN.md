# Dev 4 Runbook: Integration + QA Lead (Marketplace-Centric Release Owner)

## 1) Mission and Ownership

**Owner:** Dev 4 (Integration + QA)
**Branch/worktree:** `feature/integration-qa`
**Primary goal:** Own cross-service integration quality and release gates for Marketplace, My Agents, and Model-to-Agent Studio.

### Ownership Boundaries
- Own contract validation, E2E suites, resilience testing, freeze governance, and go/no-go decision.
- Do not implement product features directly; route defects to Dev 1/2/3 with severity and evidence.
- Own naming drift checks for transition from FlowForge wording to Model-to-Agent Studio.

---

## 2) Shared Contracts and Types (Enforced)

### Canonical Types
- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`
- `TemplateSource = "dev" | "student"`
- `SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected"`
- `TemplateVisibility = "private" | "public"`

### API Validation Targets
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

### Runtime Validation Targets
- `orchestrator.triggerAgentRun(agentId, runType)`
- `orchestrator.handleWebhook(eventPayload)`
- `orchestrator.resumeFromPendingAction(actionId)`
- `flowforge.generateWorkflowSpec(nlDescription)` (Studio compatibility alias)
- `flowforge.generateAgentScript(spec)` (Studio compatibility alias)

### Shared Scenario IDs (Required)
- Existing: `scholarbot_happy_path`, `regbot_happy_path`, `flowforge_happy_path`, `regbot_duo_timeout`, `webhook_retry_path`
- Added: `marketplace_install_dev_template`, `marketplace_install_student_template`, `submission_pending_to_approved`, `my_agents_run_now`, `my_agents_schedule_update`

### Contract Version Stamp Process (Owned by Dev 4)
1. `v1-freeze` after Phase 1 contract validation.
2. `v2-freeze` after Phase 3 resilience validation.
3. Post-freeze process:
   - open change ticket,
   - capture compatibility impact,
   - get acknowledgements from Dev 1/2/3,
   - rerun impacted scenario suite.

---

## 3) Coordination Rules

1. Enforce 30-minute status and risk syncs.
2. Track freeze drift and block merges that violate frozen contracts.
3. Require test evidence for merge promotion.
4. Blocker SLA: >20 minutes must appear on triage board.
5. Release priorities:
   - Marketplace install flows
   - My Agents operations
   - ScholarBot/RegBot first-party templates
   - Studio generation/deploy path

---

## 4) Phase-by-Phase Execution

### Phase 0: Harness and Scenario Matrix Setup
**Objective:** Build integration harness for old and new scenario IDs.

**Tasks**
1. Build scenario matrix mapping triggers, expected statuses, and required evidence.
2. Prepare fixture loading and assertion helpers.
3. Validate build/test environment readiness for all three implementation tracks.

**Deliverables**
- Shared harness bootstrap and scenario matrix docs.

### Phase 1: Contract Validation and v1 Freeze
**Objective:** Validate API shape and event semantics for marketplace-first IA.

**Tasks**
1. Validate all marketplace and my-agents API contracts.
2. Validate Studio naming compliance and flowforge alias compatibility.
3. Validate UI contract rendering against fixture payloads.
4. Issue `v1-freeze` after critical drift is closed.

**Deliverables**
- Contract compliance report and `v1-freeze` record.

### Phase 2: E2E Happy Path Validation
**Objective:** Validate required product outcomes end-to-end.

**Tasks**
1. Run `marketplace_install_dev_template` and `marketplace_install_student_template`.
2. Run `my_agents_run_now` and `my_agents_schedule_update`.
3. Run `scholarbot_happy_path`, `regbot_happy_path`, and `flowforge_happy_path`.
4. File reproducible defects by severity with owner routing.

**Deliverables**
- E2E report and prioritized defect queue.

### Phase 3: Failure and Moderation Workflow Validation + v2 Freeze
**Objective:** Validate non-happy-path reliability and moderation transitions.

**Tasks**
1. Validate `submission_pending_to_approved` state transition correctness.
2. Validate `regbot_duo_timeout` and `webhook_retry_path` recovery behavior.
3. Validate stale-state and duplicate-install/run handling.
4. Issue `v2-freeze` when release-critical failures are resolved.

**Deliverables**
- Resilience/moderation report and `v2-freeze` record.

### Phase 4: Demo Hardening
**Objective:** Create robust fallback and evidence package.

**Tasks**
1. Produce replay fixture set for all required scenario IDs.
2. Build operator fallback runbook for demo-time instability.
3. Capture evidence package: logs, screenshots, scenario trace tables.

**Deliverables**
- Demo contingency package and rehearsal checklist.

### Phase 5: Release Gate and Go/No-Go
**Objective:** Own final release confidence decision.

**Tasks**
1. Run final regression sweep on all required scenario IDs.
2. Enforce explicit pass criteria:
   - Marketplace install flows pass.
   - My Agents operations pass.
   - ScholarBot/RegBot run-paths pass.
   - Studio generate/deploy pass.
   - Dashboard state consistency passes.
3. Publish go/no-go report and unresolved risk summary.

**Deliverables**
- Final QA signoff and release decision artifact.

---

## 5) Dependencies and Handoffs

| Phase | Input Needed | Owner |
|---|---|---|
| 0 | testable builds + baseline fixtures | Dev 1 + Dev 2 + Dev 3 |
| 1 | API docs, event maps, naming references | Dev 1 + Dev 2 + Dev 3 |
| 2 | stable feature branches for E2E | Dev 1 + Dev 2 + Dev 3 |
| 3 | reliability/moderation implementation updates | Dev 2 + Dev 3 |
| 4 | replay fixture support and UI fallback support | Dev 1 + Dev 3 |
| 5 | final bug-fix branches for retest | Dev 1 + Dev 2 + Dev 3 |

---

## 6) Dev 4 Test Responsibilities

1. Contract validation for all preserved and added APIs.
2. E2E suites for marketplace installs, my-agents operations, and studio flows.
3. Failure-mode suites for timeout/retry/recovery and moderation transitions.
4. Naming drift checks for Model-to-Agent Studio vs `flowforge.*` alias.
5. Final release gate and risk publication.

---

## 7) Definition of Done

1. `v1-freeze` and `v2-freeze` are issued and documented.
2. All required scenario IDs pass or have approved fallback procedures.
3. No unresolved release-blocking defects remain.
4. Go/no-go report is published with traceable evidence.

---

## 8) Escalation Protocol

If blocked >20 minutes:
1. Open blocker with impacted scenario IDs and owner.
2. Route defect to Dev 1/2/3 with severity and required evidence.
3. Update release-risk board and freeze status immediately.
