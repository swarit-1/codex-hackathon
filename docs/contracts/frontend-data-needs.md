# Frontend Data Needs

## Marketplace List Cards

These fields are guaranteed by the Phase 1 schema for Marketplace browsing:

- `templateId`
- `title`
- `description`
- `source`
- `category`
- `visibility`
- `templateType`
- `installCount`
- `createdAt`
- `approvedAt?`
- `archivedAt?`

Frontend assumptions:

- `source` powers the `dev-built` and `student-built` tabs.
- `category` supports filter chips or select menus.
- `installCount` is safe to render in card summaries.
- `archivedAt` is not shown by default, but allows UI to hide or flag archived templates later.
- list data is delivered in `{ items, nextCursor }` pagination envelopes.

## Marketplace Detail / Install Flow

These fields are guaranteed for template detail and install setup:

- `templateId`
- all list-card fields
- `templateConfig.schemaVersion`
- `templateConfig.inputSchema`
- `templateConfig.defaultConfig`
- `templateConfig.defaultSchedule?`
- `ownerUserId?`

Frontend assumptions:

- install forms render from `templateConfig.inputSchema`
- initial values come from `templateConfig.defaultConfig`
- schedule UI initializes from `templateConfig.defaultSchedule` when present
- student-owned private templates can be shown in creator-facing views using `ownerUserId`

## My Agents List Shell

These fields are guaranteed for the initial My Agents operational surface:

- `agentId`
- `userId`
- `templateId?`
- `ownerType`
- `type`
- `status`
- `lastRunStatus`
- `schedule`
- `lastRunAt?`
- `nextRunAt?`
- `browserUseTaskId?`
- `createdAt`
- `updatedAt`

Frontend assumptions:

- filter chips can safely use `status`, `type`, and `ownerType`
- My Agents cards/tables may display both `status` and `lastRunStatus`
- schedule editing UI should treat the persisted shape as `{ enabled, cron, timezone, jitterMinutes? }`
- list data is delivered in `{ items, nextCursor }` pagination envelopes.

## Pending Review / Submission Surfaces

These fields are guaranteed for student publish and moderation experiences:

- `submissionId`
- `userId`
- `templateId?`
- `status`
- `reviewNotes?`
- `createdAt`
- `updatedAt`

Frontend assumptions:

- `pending_review` badge state is driven by `templateSubmissions.status`
- moderation status is not inferred from `marketplaceTemplates.visibility`
- a submission can exist without a linked marketplace template before approval

## Naming Compatibility

- User-facing copy should say `Model-to-Agent Studio`.
- Backend/runtime payloads may still expose `flowforge` compatibility naming during the MVP.
