# AGENTS.md

This file defines how Codex agents should work in the `codex-hackathon` project.

## Project Architecture

### Frontend stack

- Next.js App Router app in `codex-hackathon/apps/web`
- React + TypeScript
- Shared UI components in `apps/web/components`
- Styles in `apps/web/styles/globals.css`
- Frontend hooks, contracts, mappers, and utilities in `apps/web/lib`
- Convex client wiring in `apps/web/lib/convex`

### Backend stack

- Convex backend in `codex-hackathon/convex`
- Shared backend contracts in `convex/types/contracts.ts`
- Domain modules such as:
  - `convex/marketplace.ts`
  - `convex/agents.ts`
  - `convex/pendingActions.ts`
  - `convex/flowforge.ts`
  - `convex/orchestrator.ts`
  - `convex/auth.ts`
- Supporting backend logic in `convex/lib`
- Security helpers in `convex/security`

### File structure

- `codex-hackathon/apps/web/app`: route entrypoints
- `codex-hackathon/apps/web/components`: UI components
- `codex-hackathon/apps/web/lib/contracts`: frontend contract and mock shapes
- `codex-hackathon/apps/web/lib/hooks`: frontend data and action hooks
- `codex-hackathon/apps/web/lib/mappers.ts`: backend-to-UI mapping logic
- `codex-hackathon/convex`: backend functions and runtime logic
- `codex-hackathon/docs`: product and implementation planning docs
- `codex-hackathon/services/agents`: agent-related service code

## Development Rules

### Naming conventions

- Use descriptive names aligned with the product language: marketplace, my-agents, studio, settings.
- Name hooks with `use...`.
- Name Convex modules by domain, not by vague utility labels.
- Keep route, component, and type names explicit about their purpose.

### State management patterns

- Use local component state only for view-local interactions.
- Use hooks in `apps/web/lib/hooks` for backend-backed queries and mutations.
- Use shared contract types from `apps/web/lib/contracts/types.ts`.
- Use mapper functions to convert backend records into UI models.
- Keep mock data only as fallback behavior when Convex is disabled or unavailable.

### Test requirements

- Default expectation: new behavior should pass the relevant build, lint, and test checks.
- Do not ship code that breaks type safety or app compilation.
- If tests are skipped, state that explicitly.

## Workflow Generation Rules

### Browser interaction patterns

- Prefer Playwright-compatible step sequences for browser workflows.
- Express browser workflows as explicit ordered actions.
- Include wait conditions, selectors, and verification checkpoints.
- Treat login, MFA, redirects, and dynamic loading as first-class workflow states.
- Pause for human input when a workflow reaches a required user action.

### Scraping guidelines

- Extract only the structured data needed for the workflow.
- Prefer stable selectors and semantic landmarks over brittle deep selectors.
- Normalize scraped data into explicit records, not raw page dumps.
- Record assumptions about the page structure when the workflow depends on them.

### Security restrictions

- Do not store or expose secrets in generated workflow code.
- Do not hardcode credentials.
- Treat authentication state, session tokens, and student data as sensitive.
- Respect UT portal constraints, MFA boundaries, and user-consent checkpoints.
- Do not automate restricted actions without explicit workflow definition and user intent.

## Definition of Done

Codex agents are expected to:

- pass relevant tests and build checks
- maintain linting and type-safety expectations
- update documentation when architecture, workflows, or interfaces change
- preserve existing backend wiring instead of replacing it with hardcoded UI behavior
- keep generated workflows structured, reviewable, and safe
