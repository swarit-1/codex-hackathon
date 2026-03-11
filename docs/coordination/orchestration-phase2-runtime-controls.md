# Orchestration Phase 2 Runtime Controls Handoff (Dev2/Dev4)

## Scope
Phase 2 adds My Agents operational runtime controls with deterministic telemetry.
Browser execution now supports `local_v1` (primary) with `mock` fallback via env flags.

## Implemented Control Paths
- `agents.runNow(agentId)`
  - idempotent when `currentRunState === "running"`
  - otherwise triggers `orchestrator.triggerAgentRun(agentId, "manual")`
  - scenario tag: `my_agents_run_now`

- `agents.updateSchedule(agentId, schedule)`
  - strict 5-field cron (UTC) validation (`*` or integer per field)
  - cancels prior scheduled handle if present
  - persists new `scheduledTaskId` + `nextRunAt`
  - scenario tag: `my_agents_schedule_update`

- `agents.delete(agentId)`
  - attempts active Browser Use cancellation
  - cancels pending scheduled task handle if present
  - tombstones agent and clears run/schedule handles
  - scenario tag: `my_agents_delete`

## Control Metadata Added to Agent
- `currentRunId`
- `currentRunState` (`idle|running|paused|completed|failed|cancelled`)
- `scheduledTaskId`
- `lastControlAction`
- `lastControlActionAt`

## Response Shapes
- `runNow`: `idempotent`, `agentId`, `runId?`, `runState`, `browserTaskId?`, `scenarioId`, `result?`
- `updateSchedule`: `agent`, `nextRunAt`, `scheduledTaskId`, `validation`, `scenarioId`
- `delete`: `agentId`, `deletedAt`, `cancellation`, `scenarioId`

## Trace Expectations
- `my_agents_run_now` logs include request acceptance and idempotent/terminal outcome.
- `my_agents_schedule_update` logs include previous/new schedule, validation, `nextRunAt`, and task handle changes.
- Delete logs include run cancellation outcome and schedule cancellation outcome.
