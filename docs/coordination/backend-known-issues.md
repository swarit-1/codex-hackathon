# Backend Known Issues

## Current State

- Phase 0 and Phase 1 are scaffolded in source form only; the repo still lacks a full local Convex
  bootstrap and compile/test harness.
- Phase 2 and Phase 3 business logic are not complete yet, so Phase 4 run control is currently
  implemented as shared contracts/helpers rather than live database mutations and auth-enforced
  orchestration flows.

## Phase 4 Risks

- `agents.runNow`, `agents.updateSchedule`, and `agents.delete` still need Phase 2/3 data access and
  authorization wiring before they can safely mutate records.
- no runtime callback persistence exists yet in `orchestrator.handleWebhook`; only the shared
  envelope and trace model are defined.
- delete semantics are modeled, but no archival column exists yet on `agents`, so final delete
  behavior must be resolved when operational mutations are implemented.

## Phase 5 Risks

- fixture helpers are deterministic, but they are not yet exposed through a backend test runner or
  QA endpoint
- sample payload docs exist, but runtime/services code has not been updated to emit them
- error taxonomy is defined in backend helpers, but authz and encryption modules still need real
  implementations to use it consistently
