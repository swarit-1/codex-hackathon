# Backend Known Issues

## Current State

- Phase 0 and Phase 1 are fully scaffolded with real Convex reads, writes, and authorization.
- Phase 4 run control is wired end-to-end: scheduling, run-now, delete, and webhook reconciliation
  all use live database mutations with authz enforcement.
- Encryption is wired: `encryptCredentialVaultInProfileData` now calls AES-256-GCM encryption via
  Web Crypto API for credential vault data.

## Resolved Issues (Dev 2 Audit)

- **Orchestrator runtime crash (P0)**: All 3 orchestrator handlers were `action` type but accessed
  `ctx.db`. Converted to `mutation` since they only do DB operations.
- **Empty cron scheduler (P0)**: `cron.ts` was a no-op. Implemented `checkScheduledAgents` as an
  `internalMutation` + `crons.ts` with 1-minute interval cron job.
- **Unencrypted credentials (P0)**: `encryptCredentialVaultInProfileData` was a no-op passthrough.
  Made it async and wired to `encryptJsonValue` (AES-256-GCM).
- **deriveNextRunAt returning current timestamp (P1)**: Created `cron-parser.ts` with proper
  5-field cron expression parsing and timezone support.
- **Delete blocked for running agents (P1)**: `cancel_then_archive` mode threw an error instead of
  cancelling. Now cancels the running agent before proceeding with cascade deletion.
- **In-memory agent filtering (P2)**: `agents.listByUser` now uses `by_userId_status` and
  `by_userId_ownerType` indexes when filters are provided.
- **Unbounded webhook dedup scan (P2)**: `handleWebhook` now uses `queryByIndexRecent` with limit 100.
- **Authz race in marketplace (P2)**: Moved authorization check before data access in `listTemplates`.
- **No rate limiting on runNow (P2)**: Added 30-second cooldown check.
- **Dangerous `patch: v.any()` in customWorkflows (P3)**: Replaced with explicit allowed fields.
- **`users.upsertProfile` accessing `.handler` (P1)**: Extracted shared logic into plain async
  functions instead of calling registered mutation handlers.

## Remaining Risks

### Phase 4

- No archival column exists on `agents`; delete is a hard delete with cascade.
- When runtime integration requires external HTTP calls, orchestrator handlers will need refactoring
  to actions that call internal mutations for DB writes via `ctx.runMutation`.

### Phase 5

- Fixture helpers are deterministic but not yet exposed through a backend test runner or QA endpoint.
- Sample payload docs exist but runtime/services code has not been updated to emit them.
- Scenario-tagged logs are not yet emitted from real runtime and moderation flows.
