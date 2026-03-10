# Dev 3 Runbook: Agent Orchestration (Browser Use + LLM Pipelines)

## 1) Mission and Ownership

**Owner:** Dev 3 (Agent Orchestration Agent)  
**Branch/worktree:** `feature/agents`  
**Primary goal:** Build the runtime orchestration layer for ScholarBot, RegBot, and FlowForge, integrated with Convex contracts and resilient enough for live demo conditions.

### In Scope
- Browser Use Cloud API integration and lifecycle management.
- ScholarBot and RegBot runtime execution paths.
- FlowForge two-stage LLM pipeline and deployment flow.
- Webhook/event ingestion mapping into backend log/status updates.
- Retry/backoff/failure pause behavior and demo fallback runbooks.

### Out of Scope
- Frontend implementation (Dev 1).
- Convex schema/auth/cron implementation (Dev 2), except required integration calls.

---

## 2) Non-Negotiables (Shared Contracts)

## Canonical Enums
- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`

## Required Backend Contracts (must call exactly)
- `dashboard.getOverview(userId)`
- `users.upsertProfile(payload)`, `users.getProfile()`
- `agents.create(type, config)`, `agents.updateStatus(agentId, status)`, `agents.listByUser()`
- `scholarships.listByUser(filters)`, `scholarships.upsertFromRun(payload)`
- `registrationMonitors.create(payload)`, `registrationMonitors.listByUser()`
- `pendingActions.create(payload)`, `pendingActions.resolve(actionId, response)`
- `customWorkflows.create(payload)`, `customWorkflows.update(agentId, patch)`
- `agentLogs.append(payload)`, `agentLogs.list(agentId, pagination)`

## Required Orchestration Interfaces (must implement)
- `orchestrator.triggerAgentRun(agentId, runType)`
- `orchestrator.handleWebhook(eventPayload)`
- `orchestrator.resumeFromPendingAction(actionId)`
- `flowforge.generateWorkflowSpec(nlDescription)`
- `flowforge.generateAgentScript(spec)`

---

## 3) Coordination Rules (Must Follow)

1. Contract freeze points: after **Phase 1** and **Phase 3**.
2. Sync cadence: every 30 minutes with Dev 1 and Dev 2.
3. Hard integration windows: midpoint and pre-demo.
4. Merge policy: local tests + one integration smoke test required before merge.
5. Blocker protocol: blocked >20 minutes requires explicit fallback path.
6. Demo priority: ScholarBot + RegBot full flow over FlowForge extras.

---

## 4) Runtime Structure and Artifacts

## Recommended orchestration layout
```txt
services/agents/
  browserUseClient.ts
  orchestrator.ts
  webhookHandler.ts
  scholarbot/
    runner.ts
    matcher.ts
    stateMachine.ts
  regbot/
    runner.ts
    seatChecker.ts
    duoHandler.ts
  flowforge/
    specGenerator.ts
    scriptGenerator.ts
    validator.ts
  shared/
    retryPolicy.ts
    eventTypes.ts
    payloadMappers.ts
```

## Tracking artifacts (must maintain)
- `docs/contracts/orchestration-webhook-contracts.md`
- `docs/contracts/orchestration-run-status-model.md`
- `docs/coordination/orchestration-known-issues.md`
- `docs/coordination/orchestration-phase-checklists.md`
- `docs/coordination/orchestration-retry-matrix.md`

---

## 5) Phase-by-Phase Execution

## Phase 0: Integration Shell
**Objective:** Build the orchestration backbone and Convex integration points.

### Tasks
1. Create Browser Use API client wrapper:
   - create task
   - start run
   - fetch run status
   - cancel run
2. Create unified run lifecycle states:
   - queued, running, paused, completed, failed, retrying.
3. Implement `orchestrator.triggerAgentRun(agentId, runType)` entrypoint.
4. Implement webhook/event handler scaffold:
   - Parse provider events.
   - Normalize into internal run event model.
5. Define mapping from runtime events to `agentLogs.append` payload.

### Deliverables
- Runnable orchestration shell with mocked provider responses.
- Webhook contract draft shared with Dev 2 and Dev 1.

### Acceptance Criteria
- Can trigger a synthetic run and persist normalized events.
- Event schema remains stable and typed.

---

## Phase 1: ScholarBot Runtime
**Objective:** Deliver scholarship discovery/match/pause/resume runtime path.

### Tasks
1. Implement source crawling loop for targeted scholarship sources.
2. Implement eligibility extraction and GPT-4o match scoring call.
3. Persist candidate scholarships through backend contract.
4. Implement pause/resume state machine:
   - On missing field -> create pending action (`essay`/`detail`).
   - On response -> continue from checkpoint.
5. Capture screenshots at key checkpoints:
   - listing discovered
   - form fill started
   - pending action generated
   - submission attempt/result
6. Add duplicate detection support (URL + title hash context).

### Deliverables
- ScholarBot runnable template with checkpointed state.
- Status event map for frontend display.

### Acceptance Criteria
- End-to-end run can reach paused and resumed states.
- Match scoring and required fields are logged and persisted.

### Tests
- Pause/resume state machine tests.
- Duplicate scholarship detection tests.

### Handoff Needed
- Dev 2: pending action payloads, scholarship upsert payload details.
- Dev 1: status/event labels and screenshot metadata shape.

---

## Phase 2: RegBot Runtime
**Objective:** Deliver registration polling and seat-claim attempt path.

### Tasks
1. Implement login/session routine for UT registration target.
2. Implement polling run logic:
   - check seat availability
   - if open, execute registration action sequence immediately
3. Implement Duo push flow:
   - trigger push
   - 60-second timeout window
   - timeout path creates retry state for next cycle
4. Implement conflict/failure handling:
   - seat taken race
   - schedule conflict warning
   - system downtime/backoff
5. Emit normalized events for each phase of registration attempt.

### Deliverables
- RegBot runtime script and decision logic.
- Retry/backoff policy integrated.

### Acceptance Criteria
- Demonstrable transitions: watching -> attempting -> registered/failed/retrying.
- Timeout and race conditions do not crash run pipeline.

### Tests
- Seat-open registration attempt flow test.
- Duo timeout + retry path tests.
- Conflict detection and pending confirmation creation tests.

---

## Phase 3: FlowForge MVP Runtime
**Objective:** Implement minimal but working custom workflow generation/deployment.

### Tasks
1. Implement `flowforge.generateWorkflowSpec(nlDescription)`:
   - LLM converts prompt to structured JSON workflow spec.
2. Implement preview string generation from workflow spec.
3. Implement `flowforge.generateAgentScript(spec)`:
   - LLM turns spec into Browser Use compatible script template.
4. Implement dry-run validator:
   - fail fast on obvious URL/selector failures.
5. Support workflow lifecycle actions:
   - deploy, pause, delete.

### Deliverables
- One successful prompt -> preview -> generated script -> deploy path.
- Failures surfaced with actionable context.

### Acceptance Criteria
- At least one custom workflow deploys and produces output.
- Preview text aligns with generated spec intent.

### Tests
- NL-to-spec parsing tests.
- Spec-to-script generation format tests.
- Dry-run validation failure/success tests.

### Handoff Needed
- Dev 2: custom workflow persistence contract stabilization.
- Dev 1: preview model and workflow run-state payload shape.

---

## Phase 4: Resilience and Reliability
**Objective:** Improve runtime tolerance to real-world instability.

### Tasks
1. Implement layout-change fallback strategy:
   - alternate selector sets
   - semantic element search fallback
2. Add repeated-failure guard:
   - after 3 consecutive failures, auto-pause and notify.
3. Standardize retry matrix by error type:
   - transient network
   - auth failure
   - target site unavailable
   - selector mismatch
4. Ensure all failures produce telemetry entries in `agentLogs`.

### Deliverables
- Retry matrix doc and implementation mapping.
- Reliable auto-pause safety behavior.

### Acceptance Criteria
- No silent failures: every failure path yields explicit event/log output.
- Repeated failures do not thrash external targets.

---

## Phase 5: Demo Hardening and Contingency Runbook
**Objective:** Guarantee demo continuity despite integration flakiness.

### Tasks
1. Create deterministic demo scripts for:
   - ScholarBot pause/resume/submit storyline
   - RegBot detect/register storyline
   - FlowForge one successful generated workflow
2. Create fallback replay payloads when external services fail.
3. Build live contingency runbook:
   - trigger points
   - fallback activation steps
   - evidence artifacts to show judges (logs/screenshots/traces)
4. Validate end-to-end integration with Dev 1 and Dev 2 in final rehearsal.

### Deliverables
- Demo-ready runbook and replay fixtures.
- Final orchestration readiness checklist.

### Acceptance Criteria
- Core demo can proceed even with Browser Use or target-site instability.
- Frontend can display fallback run evidence without code changes.

---

## 6) Handoffs by Phase (to Dev 1 and Dev 2)

| Phase | To Dev 1 | To Dev 2 |
|---|---|---|
| 0 | run lifecycle statuses and event labels | webhook normalization draft |
| 1 | ScholarBot event payload and screenshot refs | scholarship/pending action write payloads |
| 2 | RegBot timeline states and user-facing messages | registration attempt result schema |
| 3 | FlowForge preview + deployment state payload | workflow generation/deploy callbacks |
| 4 | retry/failure display semantics | failure taxonomy + auto-pause metadata |
| 5 | replay payload formats for demo mode | contingency event storage patterns |

---

## 7) Orchestration Definition of Done (Final)

1. ScholarBot and RegBot run end-to-end from Convex triggers.
2. FlowForge can generate and deploy one working workflow.
3. Webhooks normalized into stable backend event/log contracts.
4. Retry, timeout, and auto-pause behaviors are implemented and tested.
5. Demo fallback runbook and replay payloads are ready.

---

## 8) Escalation and Blocker Playbook

When blocked more than 20 minutes:
1. Publish blocker with:
   - `Issue`
   - `Target integration`
   - `Owner dependency`
   - `Fallback execution`
2. Fallback policy:
   - Keep public contracts stable.
   - Use deterministic mocked provider responses to unblock UI/backend integration.
3. At next checkpoint, reconcile real integration and remove only obsolete mocks.

