# Dev 2 Runbook: Backend (Convex Schema, Functions, Security, Cron)

## 1) Mission and Ownership

**Owner:** Dev 2 (Backend Agent)  
**Branch/worktree:** `feature/backend`  
**Primary goal:** Implement Convex-backed system of record and APIs that support real-time UI and orchestration runtime, with secure credential handling and predictable scheduling.

### In Scope
- Convex schema and indexes.
- Queries, mutations, and action contracts used by Dev 1 and Dev 3.
- Auth scaffolding and row-level authorization.
- AES-256 credential encryption utilities and runtime decryption boundaries.
- Cron scheduling for ScholarBot and RegBot.
- Logging, retry metadata, and auditability.

### Out of Scope
- Frontend implementation and UI behavior (Dev 1).
- Browser Use workflow runtime implementation (Dev 3).

---

## 2) Non-Negotiables (Shared Contracts)

## Canonical Enums
- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`

## Required Backend Contracts (must export exactly)
- `dashboard.getOverview(userId)`
- `users.upsertProfile(payload)`, `users.getProfile()`
- `agents.create(type, config)`, `agents.updateStatus(agentId, status)`, `agents.listByUser()`
- `scholarships.listByUser(filters)`, `scholarships.upsertFromRun(payload)`
- `registrationMonitors.create(payload)`, `registrationMonitors.listByUser()`
- `pendingActions.create(payload)`, `pendingActions.resolve(actionId, response)`
- `customWorkflows.create(payload)`, `customWorkflows.update(agentId, patch)`
- `agentLogs.append(payload)`, `agentLogs.list(agentId, pagination)`

## Required Orchestration Interfaces (backend endpoints/actions)
- `orchestrator.triggerAgentRun(agentId, runType)`
- `orchestrator.handleWebhook(eventPayload)`
- `orchestrator.resumeFromPendingAction(actionId)`
- `flowforge.generateWorkflowSpec(nlDescription)`
- `flowforge.generateAgentScript(spec)`

---

## 3) Coordination Rules (Must Follow)

1. Contract freeze points: after **Phase 1** and **Phase 3**.
2. Sync cadence: every 30 minutes with Dev 1 and Dev 3.
3. Hard integration windows: midpoint and pre-demo.
4. Merge policy: local tests + one integration smoke test required before merge.
5. Blocker protocol: blocked >20 minutes must be published with fallback path.
6. Demo priority: ScholarBot + RegBot flows over FlowForge expansion.

---

## 4) Backend Structure and Artifact Conventions

## Recommended backend layout
```txt
convex/
  schema.ts
  users.ts
  dashboard.ts
  agents.ts
  scholarships.ts
  registrationMonitors.ts
  pendingActions.ts
  customWorkflows.ts
  agentLogs.ts
  orchestrator.ts
  flowforge.ts
  cron.ts
  security/
    encryption.ts
    authz.ts
  types/
    contracts.ts
```

## Tracking artifacts (must maintain)
- `docs/contracts/backend-api-contracts.md`
- `docs/coordination/backend-known-issues.md`
- `docs/coordination/backend-phase-checklists.md`
- `docs/coordination/backend-sample-payloads.md`

---

## 5) Phase-by-Phase Execution

## Phase 0: Foundation
**Objective:** Stand up Convex project fundamentals and typed contract base.

### Tasks
1. Initialize Convex project and environment variables.
2. Create shared type module for enums and payload interfaces.
3. Scaffold auth helpers and `getCurrentUserOrThrow` utility.
4. Add base function files for each contract surface.
5. Add lint/test scaffolding for Convex functions.

### Deliverables
- Convex project boots and deploys locally.
- Shared types module committed.
- Auth scaffolding and function stubs in place.

### Acceptance Criteria
- No schema/type build blockers.
- Function namespaces compile with typed placeholders.

### Handoff Needed
- Dev 1 gets initial API namespace map.
- Dev 3 gets action endpoint scaffolding for runtime callbacks.

---

## Phase 1: Schema and Indexes
**Objective:** Implement full PRD data model and indexes for low-latency reads.

### Tasks
1. Implement tables:
   - `users`
   - `agents`
   - `scholarships`
   - `registrationMonitors`
   - `pendingActions`
   - `customWorkflows`
   - `agentLogs`
2. Define required fields from PRD with validation.
3. Add indexes for:
   - `userId`
   - `agentId`
   - `status`
   - time-based querying (`createdAt`, `timestamp`, `nextRunAt`, `lastRunAt`)
4. Add unique-ish constraints by convention where required:
   - Scholarship duplicate checks using source URL + title hash field.
5. Document schema in backend contract file.

### Deliverables
- Stable schema with indexes.
- Seed data fixtures for development.
- Contract freeze v1 document for Dev 1 and Dev 3.

### Acceptance Criteria
- Queries can filter by user/status/time without full scan patterns.
- Schema supports all PRD entities.

### Tests
- Schema validation tests for required/optional fields.
- Index-backed query behavior tests.

---

## Phase 2: Core Queries and Mutations
**Objective:** Ship all app-facing and runtime-facing CRUD/state transitions.

### Tasks
1. `users` domain:
   - `upsertProfile`, `getProfile`
2. `dashboard` domain:
   - `getOverview(userId)` with summary counts + latest activity + pending action count.
3. `agents` domain:
   - create/list/updateStatus with authorization checks.
4. `scholarships` domain:
   - `listByUser(filters)`, `upsertFromRun(payload)` with duplicate handling.
5. `registrationMonitors` domain:
   - create/list/update status transitions.
6. `pendingActions` domain:
   - create/resolve/list unresolved first.
7. `customWorkflows` domain:
   - create/update/list by user.
8. `agentLogs` domain:
   - append/list with pagination and severity.

### Deliverables
- All required contracts implemented and callable.
- Sample request/response payloads documented.

### Acceptance Criteria
- Dev 1 can build UI against live backend methods.
- Dev 3 can write run/log outputs through supported APIs.

### Tests
- Query/mutation behavior tests per domain.
- Idempotency checks for upsert and status transitions.

---

## Phase 3: Security and Authorization
**Objective:** Enforce data isolation and secure credential lifecycle.

### Tasks
1. Implement AES-256 encryption utility for stored credentials.
2. Implement decryption boundary:
   - Only runtime actions can decrypt (never frontend queries).
3. Add row-level authorization checks to every query/mutation/action:
   - user can only read/write own rows.
4. Add redact/sanitize helper for logs/events containing sensitive values.
5. Add explicit error codes for auth/authz failures.

### Deliverables
- Security utilities committed and integrated.
- Authz checks in all functions.
- Contract freeze v2 after security pass.

### Acceptance Criteria
- No cross-user data leakage via any function.
- Secrets never returned to client-facing calls.

### Tests
- Authorization isolation tests across two user contexts.
- Encryption/decryption boundary tests.

### Handoff Needed
- Dev 1 gets safe payload guarantees.
- Dev 3 gets runtime-only credential read contract.

---

## Phase 4: Scheduling and Notifications
**Objective:** Implement deterministic polling schedule with event fan-out hooks.

### Tasks
1. Add cron jobs:
   - ScholarBot hourly.
   - RegBot every 10 minutes plus jitter behavior.
2. Wire cron jobs to `orchestrator.triggerAgentRun`.
3. Add notification event creation hooks for:
   - seat registered
   - scholarship submitted
   - pending action created
4. Persist run scheduling metadata:
   - `lastRunAt`, `nextRunAt`, `retryCount`, `lastError`.

### Deliverables
- Cron schedule active in backend.
- Trigger and notification records flowing.

### Acceptance Criteria
- Scheduled tasks call orchestration endpoints reliably.
- Re-runs do not duplicate side effects unexpectedly.

### Tests
- Cron trigger correctness tests.
- Idempotent scheduling mutation tests.

---

## Phase 5: Observability and Hardening
**Objective:** Final backend reliability pass for live demo and handoff.

### Tasks
1. Normalize error shapes across all domains.
2. Add structured logging schema in `agentLogs`.
3. Capture retry metadata and failure reasons consistently.
4. Add audit completeness checks for core flows:
   - discover/match/pause/resume/submit
   - watch/detect/register/fail/retry
5. Produce seed script for demo scenarios.

### Deliverables
- Reliable logging + error model.
- Demo seed script and sample traces.
- Final backend readiness checklist.

### Acceptance Criteria
- Dev 1 dashboard can render all major run states with stable shapes.
- Dev 3 can diagnose failures through `agentLogs` without backend code edits.

---

## 6) Data Handoffs (to Dev 1 and Dev 3)

| Phase | To Dev 1 | To Dev 3 |
|---|---|---|
| 0 | API namespace draft | action endpoints draft |
| 1 | schema-backed profile shapes | entity IDs, status enums, index assumptions |
| 2 | sample UI payloads for each panel | upsert/list/log payload contracts |
| 3 | safe frontend payload + auth guarantees | runtime decryption boundary and auth model |
| 4 | overview timing fields for UI | cron trigger contract + jitter metadata |
| 5 | final stable contract docs | error taxonomy + log pagination contract |

---

## 7) Backend Definition of Done (Final)

1. All required contracts implemented and documented.
2. Schema, indexes, and authz fully enforced.
3. Encryption path verified and client-safe.
4. Cron jobs schedulable and observable.
5. Logs and retries are complete enough for demo troubleshooting.

---

## 8) Escalation and Blocker Playbook

When blocked more than 20 minutes:
1. File blocker note with:
   - `Issue`
   - `Blocked Contract`
   - `Owner`
   - `Fallback`
2. Fallback rules:
   - Preserve interface signatures.
   - Return deterministic mock/error payloads instead of breaking callers.
3. Reconcile at next sync; do not alter frozen contracts without all-dev agreement.

