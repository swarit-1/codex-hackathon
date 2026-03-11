# Dev 3 Runbook: Agent Runtime Engineering (Template-Driven Runtime)

## 1) Mission and Ownership

**Owner:** Dev 3 (Runtime Engineering)
**Branch/worktree:** `feature/agents-runtime`
**Primary goal:** Execute template-driven automations for ScholarBot, RegBot, and Model-to-Agent Studio outputs with reliable run control and telemetry.

### Ownership Boundaries
- Own Browser Use runtime integration, template instantiation logic, run-now execution, schedule propagation, and retry behavior.
- Do not own frontend pages (Dev 1) or backend schema/security policy definitions (Dev 2).
- Deliver runtime readiness artifacts to Dev 4 for integration and release gating.

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

### Backend APIs (Call As-Is)
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

### Runtime Interfaces (Implement)
- `orchestrator.triggerAgentRun(agentId, runType)`
- `orchestrator.handleWebhook(eventPayload)`
- `orchestrator.resumeFromPendingAction(actionId)`
- `flowforge.generateWorkflowSpec(nlDescription)` (Studio compatibility alias)
- `flowforge.generateAgentScript(spec)` (Studio compatibility alias)

### Shared Test Scenario IDs
- Existing: `scholarbot_happy_path`, `regbot_happy_path`, `flowforge_happy_path`, `regbot_duo_timeout`, `webhook_retry_path`
- Added: `marketplace_install_dev_template`, `marketplace_install_student_template`, `submission_pending_to_approved`, `my_agents_run_now`, `my_agents_schedule_update`

### Freeze Process
- `v1-freeze` after Phase 1.
- `v2-freeze` after Phase 3.
- Post-freeze runtime payload changes require Dev 4-approved ticket.

---

## 3) Coordination Rules

1. 30-minute sync cadence with Dev 1/2/4.
2. Freeze compliance after Phase 1 and Phase 3.
3. Merge only with local tests + integration smoke pass.
4. Blocker SLA: >20 minutes requires fallback strategy and owner.
5. Prioritize My Agents operational reliability over non-essential runtime features.

---

## 4) Phase-by-Phase Execution

### Phase 0: Runtime Shell and Template Instantiation Base
**Objective:** Build provider wrapper and template-instantiation entry path.

**Tasks**
1. Implement Browser Use wrapper (create/start/status/cancel).
2. Implement runtime event normalization model.
3. Implement template-to-agent instantiation handoff path from installs.

**Deliverables**
- Runtime shell with deterministic local mock mode.

### Phase 1: First-Party Template Runtime (ScholarBot + RegBot)
**Objective:** Ensure first-party dev templates run through install-driven model.

**Tasks**
1. Bind ScholarBot and RegBot runtime config to template-linked agent instances.
2. Preserve existing pause/resume and registration retry state machines.
3. Emit scenario-tagged logs for first-party template runs.

**Deliverables**
- ScholarBot/RegBot operational through Marketplace install path.

**Acceptance Criteria**
- `marketplace_install_dev_template` + `scholarbot_happy_path` + `regbot_happy_path` pass.
- `v1-freeze` alignment confirmed by Dev 4.

### Phase 2: My Agents Operational Runtime Controls
**Objective:** Support direct operational commands from My Agents.

**Tasks**
1. Implement `runNow` runtime path.
2. Implement schedule-change propagation path.
3. Handle delete requests with safe cancellation semantics.
4. Keep telemetry complete for run-now and schedule updates.

**Deliverables**
- Runtime control surface compatible with My Agents actions.

**Acceptance Criteria**
- `my_agents_run_now` and `my_agents_schedule_update` pass with trace logs.

### Phase 3: Model-to-Agent Studio Runtime Path
**Objective:** Process Studio-generated workflows as installable runtime assets.

**Tasks**
1. Preserve NL-to-spec and spec-to-script pipeline via `flowforge.*` alias.
2. Install generated workflow as private template/agent instance.
3. Support optional publish submission trigger.

**Deliverables**
- End-to-end Studio runtime path with private install default.

**Acceptance Criteria**
- `flowforge_happy_path` and `submission_pending_to_approved` runtime event expectations are met.
- `v2-freeze` issued by Dev 4.

### Phase 4: Reliability and Retry Hardening
**Objective:** Stabilize runtime under failure and webhook degradation.

**Tasks**
1. Implement retry/backoff handling for runtime and webhook failures.
2. Ensure Duo timeout and webhook retry paths are explicit and recoverable.
3. Add auto-pause on repeated failures and structured failure context logs.

**Deliverables**
- Reliability-complete runtime with documented retry matrix.

### Phase 5: Runtime Readiness Package for Dev 4
**Objective:** Hand off all assets needed for release gate validation.

**Tasks**
1. Produce deterministic replay fixtures for all scenario IDs.
2. Publish runtime troubleshooting runbook.
3. Resolve release-critical runtime defects found by Dev 4.

**Deliverables**
- Runtime readiness package and defect-closure evidence.

**Acceptance Criteria**
- Dev 4 can execute final gates without requesting net-new runtime scope.

---

## 5) Dependencies and Handoffs

| Phase | Handoff | Receiver |
|---|---|---|
| 0 | runtime event taxonomy and payload examples | Dev 1 + Dev 2 + Dev 4 |
| 1 | first-party template runtime semantics | Dev 1 + Dev 4 |
| 2 | run-now/schedule/delete runtime behavior docs | Dev 2 + Dev 4 |
| 3 | Studio generation/deploy/publish event shapes | Dev 1 + Dev 2 + Dev 4 |
| 4 | retry/backoff and failure-context mapping | Dev 4 |
| 5 | replay fixture pack and runtime runbook | Dev 4 |

---

## 6) Dev 3 Test Responsibilities

1. Runtime unit tests for template instantiation and state machines.
2. Integration tests for first-party template runs from marketplace installs.
3. Operational control tests for run-now and schedule update flows.
4. Failure tests for Duo timeout and webhook retry recovery.
5. Scenario-tagged telemetry completeness checks.

---

## 7) Definition of Done

1. Runtime supports template-driven installs for first-party and Studio-generated agents.
2. My Agents operational commands execute safely and observably.
3. Reliability/error paths are deterministic and testable.
4. Dev 4 receives complete readiness artifacts for release gate.

---

## 8) Escalation Protocol

If blocked >20 minutes:
1. Publish blocker with impacted scenario ID and dependency owner.
2. Use deterministic fallback/replay mode without breaking frozen contracts.
3. Notify Dev 4 for release-risk and freeze tracking.
