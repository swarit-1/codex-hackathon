# Project Skills

This file defines the project-specific skills Codex agents should use when working in `codex-hackathon`.

## Browser Automation Skill

Use this skill for any task involving Playwright, browser agents, or workflow execution in real web UIs.

### Purpose

- Generate browser automation scripts.
- Test end-to-end UI flows.
- Inspect DOM structures and page state.
- Simulate user workflows across UT systems and related sites.
- Extract structured data from rendered pages.
- Complete repetitive browser actions safely and deterministically.

### Core behaviors

- Prefer Playwright for browser automation and page inspection.
- Generate executable scripts that can be reused as workflow steps.
- Model workflows as explicit sequences: authenticate, navigate, wait, inspect, act, confirm.
- When targeting UT portals, treat Duo, session expiry, redirects, and delayed rendering as normal conditions.
- Record selectors and interaction assumptions in a way that can be regenerated if the DOM changes.

### Expected outputs

- Playwright scripts or workflow snippets.
- DOM inspection notes.
- Browser step plans with clear success and failure states.
- Structured extraction logic for tables, cards, forms, and portal dashboards.

### Typical use cases

- Navigating UT registration portals.
- Inspecting scholarship pages and designated UT websites.
- Scraping structured records from portals and dashboards.
- Completing repetitive student actions through a browser workflow.

## Workflow Generator Skill

Use this skill for any task where a natural-language request needs to become a structured workflow definition.

### Purpose

- Convert plain-English requests into ordered workflow steps.
- Produce workflow definitions that browser agents or backend orchestration can execute.
- Normalize vague requests into explicit actions, inputs, outputs, and triggers.

### Transformation pattern

Turn a request into:

1. Preconditions and required inputs.
2. Ordered interaction steps.
3. Extraction or decision points.
4. Output actions such as notify, save, retry, or pause for user input.
5. Failure handling and human handoff conditions.

### Example

User request:
`Check my course portal and notify me if new assignments appear.`

Generated workflow:

1. Log in to the course portal.
2. Navigate to the course dashboard.
3. Scrape the assignment list.
4. Compare against the last known snapshot.
5. Notify the user if new assignments appear.

### Rules

- Every generated workflow must be stepwise and executable.
- Avoid ambiguous actions such as "check stuff" or "handle it".
- Include pauses for required user actions like MFA, essays, or confirmation prompts.
- Prefer deterministic workflow steps over broad autonomous behavior.

## UI Scaffolding Skill

Use this skill for frontend implementation work in the Next.js app.

### Purpose

- Generate React components for the app UI.
- Enforce the project’s design system and marketplace visual direction.
- Wire components to existing frontend hooks and backend-facing contracts.
- Preserve consistency across marketplace, studio, my-agents, and settings surfaces.

### Core behaviors

- Build with the existing Next.js App Router structure in `apps/web/app`.
- Reuse shared UI from `apps/web/components/shared` before adding new primitives.
- Use hooks from `apps/web/lib/hooks` instead of hardcoding backend behavior in pages.
- Respect the existing Convex-backed data flow with mock fallback only when Convex is unavailable.
- Follow the restrained product direction from `Uncodixfy.md`: calm, structured, not flashy, not "AI dashboard" style.

### Expected outputs

- New page shells and route components.
- Shared marketplace cards, tables, and operational UI components.
- Hook-wired pages that remain consistent with contracts in `apps/web/lib/contracts`.

### Rules

- Do not bypass shared types and mappers.
- Do not hardcode production data into route components.
- Prefer extending existing shared sections, hooks, and styles over creating parallel systems.
- Keep visuals intentional and polished, but restrained.
