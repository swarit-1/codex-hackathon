# Backend Phase Checklists

## Phase 0: Backend Foundation

### Modular Handler Scaffold

- [x] added source-only Convex server shim for `query` / `mutation` / `action` exports
- [x] added shared validators for enums, config envelope, schedule, filters, and pagination
- [x] added shared stub-response helpers for null reads, empty lists, and deterministic Phase 2 errors
- [x] created `convex/marketplace.ts`

### Public Handler Coverage

- [x] `users.upsertProfile` / `users.getProfile`
- [x] `agents.create` / `agents.updateStatus` / `agents.listByUser` / `agents.runNow` / `agents.updateSchedule` / `agents.delete`
- [x] `marketplace.listTemplates` / `marketplace.getTemplate` / `marketplace.installTemplate` / `marketplace.submitTemplate` / `marketplace.reviewSubmission`
- [x] `scholarships.listByUser` / `scholarships.upsertFromRun`
- [x] `registrationMonitors.create` / `registrationMonitors.listByUser`
- [x] `pendingActions.create` / `pendingActions.resolve`
- [x] `customWorkflows.create` / `customWorkflows.update`
- [x] `agentLogs.append` / `agentLogs.list`
- [x] `dashboard.getOverview`
- [x] `flowforge.generateWorkflowSpec` / `flowforge.generateAgentScript`
- [x] `orchestrator.triggerAgentRun` / `orchestrator.handleWebhook` / `orchestrator.resumeFromPendingAction`

### Placeholder Behavior

- [x] list queries return `{ items, nextCursor }` pagination envelopes
- [x] single-record queries return `null` on missing resources where appropriate
- [x] Phase 2 handlers use real Convex reads and writes instead of placeholder mutations

## Phase 1: Marketplace Schema Freeze

### Schema and Type Lock

- [x] Added marketplace enums: `TemplateSource`, `SubmissionStatus`, `TemplateVisibility`
- [x] Added agent ownership/run enums: `AgentOwnerType`, `AgentType`, `AgentRunStatus`
- [x] Defined typed schedule contract: `{ enabled, cron, timezone, jitterMinutes? }`
- [x] Defined stable config envelope for templates and installed agents
- [x] Preserved existing canonical status unions without changing values

### Table Coverage

- [x] `marketplaceTemplates` defined
- [x] `templateSubmissions` defined
- [x] `agents` expanded with `templateId`, `ownerType`, `schedule`, `lastRunStatus`
- [x] supporting tables defined: `users`, `scholarships`, `registrationMonitors`, `pendingActions`, `customWorkflows`, `agentLogs`

### Index Coverage

- [x] template browsing indexes for source + visibility
- [x] template filter index for source + category + visibility
- [x] moderation queue indexes for submission status and submitter history
- [x] My Agents indexes for user, status, ownerType, and template lineage
- [x] scheduler index for `status + nextRunAt`
- [x] log/supporting indexes for agent-linked reads

### Documentation Freeze Items

- [x] backend contract doc updated with record shapes and ID conventions
- [x] frontend data-needs doc updated for Marketplace and My Agents
- [x] backend contract doc updated with exact object-shaped handler signatures
- [x] Model-to-Agent Studio naming documented with `flowforge.*` compatibility note
- [x] archival behavior documented so installed agents remain valid after template unlisting

### Query Smoke Expectations

- [ ] dev-built public template listing reads through source + visibility index
- [ ] student-built public template listing reads through source + visibility index
- [ ] pending-review moderation queue reads through status + createdAt index
- [x] My Agents filtered reads use user/status and user/ownerType indexes
- [x] scheduler reads use status + nextRunAt index

### v1 Freeze Signoff Inputs

- [ ] Dev 1 confirms Marketplace/My Agents payload sufficiency
- [ ] Dev 3 confirms template linkage and scheduler fields unblock runtime work
- [ ] Dev 4 confirms enum names and schema shapes match freeze expectations

## Phase 4: Scheduling and Run Control

### Shared Foundations

- [x] added shared run-control types for runtime handoff, operation events, delete modes, and trace IDs
- [x] added schedule validation and normalization helpers
- [x] added deterministic operation-event builders for `run_now`, `schedule_update`, and `delete`
- [x] added normalized runtime handoff payload builder

### Remaining Integration Work

- [x] wire `agents.updateSchedule` to persist normalized schedules and emit operation events
- [x] wire `agents.runNow` to prepare runtime handoff payloads and emit operation events
- [x] wire `agents.delete` to apply safe delete mode semantics
- [x] wire `orchestrator.handleWebhook` to reconcile runtime callbacks using shared trace IDs

### Robustness (added in Dev 2 audit)

- [x] orchestrator handlers converted from `action` to `mutation` (ctx.db access fix)
- [x] cron scheduler implemented (`cron.ts` + `crons.ts` with 1-minute interval)
- [x] credential vault encryption wired (AES-256-GCM via Web Crypto API)
- [x] cron parser created for proper next-run-time computation
- [x] `agents.runNow` rate limiting (30s cooldown)
- [x] `agents.delete` cancel-then-archive mode actually cancels before deleting
- [x] marketplace authz check moved before data access
- [x] webhook dedup scan bounded to 100 recent logs
- [x] `customWorkflows.update` validator uses explicit fields instead of `v.any()`

## Phase 5: Observability and Fixture Pack

### Shared Foundations

- [x] added shared backend error taxonomy helper
- [x] added deterministic scenario fixture builder covering all shared scenario IDs
- [x] documented runtime handoff and webhook payload envelopes
- [x] documented sample payloads for Dev 1/3/4 handoff

### Remaining Integration Work

- [ ] expose fixture helpers to Dev 4 through test utilities or deterministic backend entrypoints
- [ ] emit scenario-tagged logs from real runtime and moderation flows where deterministic scenarios exist
- [x] standardize all handler failures on the shared backend error taxonomy
- [ ] validate payload docs against live handler/runtime behavior once Phase 2-4 implementation lands
