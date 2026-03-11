# Backend API Contracts

## Current Scope

The backend now has:

- Phase 1 schema and index freeze in source
- Phase 2 real Convex-backed reads and writes for user, marketplace, agent, workflow, monitor,
  scholarship, log, and pending-action handlers
- Phase 3 authorization and credential-vault handling foundations
- Phase 4 runtime handoff and webhook reconciliation helpers
- Phase 5 deterministic fixture and observability contracts

## Canonical Enums

- `AgentStatus = "active" | "paused" | "completed" | "error"`
- `ScholarshipStatus = "found" | "applying" | "paused" | "submitted" | "expired"`
- `MonitorStatus = "watching" | "registered" | "failed"`
- `PendingActionType = "essay" | "detail" | "confirmation"`
- `TemplateSource = "dev" | "student"`
- `SubmissionStatus = "draft" | "pending_review" | "approved" | "rejected"`
- `TemplateVisibility = "private" | "public"`
- `AgentOwnerType = "first_party" | "student" | "generated"`
- `AgentType = "scholar" | "reg" | "custom"`
- `AgentRunStatus = "idle" | "running" | "succeeded" | "failed" | "cancelled"`

## Shared Interface Defaults

- All backend handlers accept a single object argument.
- List handlers return `{ items: T[]; nextCursor: string | null }`.
- `schedule` is always persisted as `{ enabled, cron, timezone, jitterMinutes? }`.
- template and agent config stay in the envelope
  `{ schemaVersion, inputSchema, defaultConfig, defaultSchedule?, currentConfig? }`.
- ownership and moderation checks are enforced in handler code, not inferred by the caller.

## Phase 4-5 Shared Runtime Contracts

- `RuntimeRunType = "manual" | "scheduled" | "resume"`
- `RunTriggerSource = "my_agents" | "scheduler" | "pending_action" | "webhook"`
- `AgentOperationType = "run_now" | "schedule_update" | "delete"`
- `AgentOperationStatus = "accepted" | "deferred" | "rejected"`
- `AgentDeleteMode = "archive_only" | "cancel_then_archive"`
- `ScenarioId`
  - `scholarbot_happy_path`
  - `regbot_happy_path`
  - `flowforge_happy_path`
  - `regbot_duo_timeout`
  - `webhook_retry_path`
  - `marketplace_install_dev_template`
  - `marketplace_install_student_template`
  - `submission_pending_to_approved`
  - `my_agents_run_now`
  - `my_agents_schedule_update`
- `BackendErrorCode`
  - `PHASE_2_NOT_IMPLEMENTED`
  - `VALIDATION_ERROR`
  - `INVALID_STATE`
  - `FORBIDDEN`
  - `NOT_FOUND`

## Handler Signatures

### Users

- `users.upsertProfile({ userId, name, email, eid?, authMethod, profileData? })`
- `users.getProfile({ userId })`

### Agents

- `agents.create({ userId, type, config, templateId?, ownerType?, schedule? })`
- `agents.updateStatus({ agentId, status })`
- `agents.listByUser({ userId, status?, ownerType?, type?, limit?, cursor? })`
- `agents.runNow({ agentId })`
- `agents.updateSchedule({ agentId, schedule })`
- `agents.delete({ agentId })`

### Marketplace

- `marketplace.listTemplates({ source, category?, visibility?, ownerUserId?, limit?, cursor? })`
- `marketplace.getTemplate({ templateId })`
- `marketplace.installTemplate({ templateId, userId, config })`
- `marketplace.submitTemplate({ userId, draftPayload, templateId? })`
- `marketplace.reviewSubmission({ submissionId, decision, reviewerId, reviewNotes? })`

### Scholarship and registration flows

- `scholarships.listByUser({ userId, status?, limit?, cursor? })`
- `scholarships.upsertFromRun({ userId, agentId, title, source, deadline?, eligibility?, matchScore?, status, missingFields? })`
- `registrationMonitors.create({ userId, agentId, courseNumber, uniqueId, semester, status?, pollInterval })`
- `registrationMonitors.listByUser({ userId, status?, limit?, cursor? })`

### Human-in-the-loop, logs, and workflows

- `pendingActions.create({ userId, agentId, type, prompt })`
- `pendingActions.resolve({ actionId, response })`
- `customWorkflows.create({ userId, prompt, sourceAlias?, spec?, generatedScript?, agentId?, templateSubmissionId? })`
- `customWorkflows.update({ agentId, patch })`
- `agentLogs.append({ agentId, event, level?, details, screenshots?, scenarioId? })`
- `agentLogs.list({ agentId, limit?, cursor? })`

### Dashboard and runtime aliases

- `dashboard.getOverview({ userId })`
- `flowforge.generateWorkflowSpec({ nlDescription })`
- `flowforge.generateAgentScript({ spec })`
- `orchestrator.triggerAgentRun({ agentId, runType })`
- `orchestrator.handleWebhook({ eventPayload })`
- `orchestrator.resumeFromPendingAction({ actionId })`

## Run Control Semantics

- `agents.updateSchedule` persists a normalized schedule and is expected to reject invalid
  cron/timezone/jitter combinations with `VALIDATION_ERROR`.
- `agents.runNow` is expected to prepare a runtime handoff payload with traceable metadata for
  downstream orchestration.
- `agents.delete` is expected to resolve to one of two safe delete modes:
  - `archive_only`
  - `cancel_then_archive`
- all three operational paths should emit operation events that can be surfaced in logs and QA
  fixtures.

## Observability Semantics

- operation logs should include:
  - stable `traceId`
  - optional `scenarioId`
  - human-readable `message`
  - backend-owned status metadata for QA and UI visibility
- runtime handoff payloads and webhook payloads should use the same `traceId` so Dev 4 can trace a
  run from My Agents action to runtime callback.

## Record Shapes

### `marketplaceTemplates`

- `title: string`
- `description: string`
- `source: TemplateSource`
- `category: string`
- `visibility: TemplateVisibility`
- `templateType: AgentType`
- `installCount: number`
- `ownerUserId?: Id<"users">`
- `templateConfig: { schemaVersion, inputSchema, defaultConfig, defaultSchedule?, currentConfig? }`
- `createdAt: number`
- `updatedAt: number`
- `approvedAt?: number`
- `archivedAt?: number`

### `templateSubmissions`

- `userId: Id<"users">`
- `templateId?: Id<"marketplaceTemplates">`
- `draftPayload: { title, description, category, templateType, visibility?, templateConfig }`
- `status: SubmissionStatus`
- `reviewerId?: Id<"users">`
- `reviewNotes?: string`
- `createdAt: number`
- `updatedAt: number`

### `agents`

- `userId: Id<"users">`
- `templateId?: Id<"marketplaceTemplates">`
- `ownerType: AgentOwnerType`
- `type: AgentType`
- `status: AgentStatus`
- `config: { schemaVersion, inputSchema, defaultConfig, defaultSchedule?, currentConfig? }`
- `schedule: { enabled, cron, timezone, jitterMinutes? }`
- `lastRunStatus: AgentRunStatus`
- `lastRunAt?: number`
- `nextRunAt?: number`
- `browserUseTaskId?: string`
- `createdAt: number`
- `updatedAt: number`

### Supporting tables

- `users`: identity, auth method, profile data, created/updated timestamps
- `scholarships`: scholarship result state linked to `userId` and `agentId`
- `registrationMonitors`: course watch state linked to `userId` and `agentId`
- `pendingActions`: human-in-the-loop prompts linked to `userId` and `agentId`
- `customWorkflows`: Model-to-Agent Studio / `flowforge` workflow artifacts
- `agentLogs`: timestamped operational log events with optional screenshots and `scenarioId`

## ID Conventions

- All cross-record references use Convex document IDs.
- `templateId` always points to `marketplaceTemplates`.
- `userId` always points to `users`.
- `agentId` always points to `agents`.
- Student submissions may exist without a `templateId` until approval creates or links a template.
- Template archival is modeled with `archivedAt`; installed agents remain linked to archived templates.

## Index-Backed Read Patterns

### Marketplace

- `marketplace.listTemplates(filters)`
  - uses `marketplaceTemplates.by_source_visibility` for `dev-built` vs `student-built` tabs
  - uses `marketplaceTemplates.by_source_category_visibility` for source/category filters
  - uses `marketplaceTemplates.by_createdAt` for newest-first fallback ordering
- `marketplace.getTemplate(templateId)`
  - direct lookup by `templateId`

### Moderation

- `marketplace.submitTemplate(payload)`
  - creates `templateSubmissions` records without requiring a public template row
- `marketplace.reviewSubmission(submissionId, decision)`
  - uses `templateSubmissions.by_status_createdAt` for queue reads
  - uses `templateSubmissions.by_templateId` when approval links an existing template
- submitter history reads use `templateSubmissions.by_userId_status`

### My Agents

- `agents.listByUser()`
  - uses `agents.by_userId`
  - filtered views use `agents.by_userId_status` and `agents.by_userId_ownerType`
- scheduler reads use `agents.by_status_nextRunAt`
- template lineage and install lookup use `agents.by_templateId`
- list responses use the shared paginated shape `{ items, nextCursor }`

## Runtime Action Behavior

- `flowforge.generateWorkflowSpec({ nlDescription })`
  - returns a deterministic Model-to-Agent Studio spec and private template draft payload
- `flowforge.generateAgentScript({ spec })`
  - returns a deterministic script stub with a stable checksum
- `orchestrator.triggerAgentRun({ agentId, runType })`
  - marks the agent as running when not already running
  - emits traceable operation and handoff log entries
- `orchestrator.handleWebhook({ eventPayload })`
  - reconciles `lastRunStatus`, lifecycle status, `nextRunAt`, and appends webhook logs
  - ignores duplicate webhook events based on `event + occurredAt + traceId`
- `orchestrator.resumeFromPendingAction({ actionId })`
  - requires a resolved pending action before resuming runtime handoff

## Lifecycle Defaults

- `agent.status` is lifecycle state for user-facing controls.
- `agent.lastRunStatus` is the most recent execution outcome and must not be collapsed into
  `agent.status`.
- Installed agent ownership defaults:
  - dev template -> `first_party`
  - approved student template -> `student`
  - Model-to-Agent Studio / `flowforge` generated workflow -> `generated`

## Compatibility Notes

- Product copy should use `Model-to-Agent Studio`.
- Internal MVP compatibility may continue to use the `flowforge.*` namespace in payloads and
  workflow records.
