# Dev 4 Phase 1 Drift Log

Last updated: March 11, 2026
Owner: Dev 4

## Severity Rules

- `Sev-1`: blocks `v1-freeze`
- `Sev-2`: must be resolved or waived before phase close
- `Sev-3`: follow-up after freeze allowed

## Open Drift Items

| ID | Severity | Area | Owner | Drift | Blocking status |
|---|---|---|---|---|---|
| D4-P1-001 | Sev-1 | Backend | Dev 2 | `marketplace.*` API module is not yet represented in code even though the contract is frozen | blocking |
| D4-P1-002 | Sev-1 | Backend | Dev 2 | `agents.runNow`, `agents.updateSchedule`, and `agents.delete` are frozen in docs but not implemented in `convex/agents.ts` | blocking |
| D4-P1-003 | Sev-1 | Runtime | Dev 3 | normalized orchestration event model is frozen in docs but no implementation exists in `convex/orchestrator.ts` or runtime mappers | blocking |
| D4-P1-004 | Sev-2 | Shared types | Dev 2 | `TemplateSource`, `SubmissionStatus`, and `TemplateVisibility` are absent from `convex/types/contracts.ts` | blocking until acknowledged |
| D4-P1-005 | Sev-2 | Docs to code | Dev 2 + Dev 3 | placeholder contract code files remain empty, increasing freeze drift risk | blocking until handoff |

## Closed Drift Items

| ID | Severity | Area | Resolution |
|---|---|---|---|
| D4-P1-006 | Sev-2 | Contract docs | placeholder docs replaced by frozen Phase 1 contract source in `docs/contracts/` |
| D4-P1-007 | Sev-3 | Coordination | handoff checklists authored for backend, frontend, and orchestration teams |

## Waiver Rules

- Any Sev-1 waiver requires explicit Dev 4 approval and a named retest owner.
- Waived items must include impacted scenario IDs and a revalidation deadline.
