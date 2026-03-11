# Orchestration Run Status Model

## Purpose
Defines the normalized runtime envelope and event sequence for Phase 1/2 runtime execution, including My Agents operational controls.

## Browser Use Runtime Mode
- `local_v1` (primary): run tasks through local Browser Use v1.0 Python runner.
- `mock` (fallback/testing): deterministic in-memory task lifecycle.
- Fallback from `local_v1` to `mock` is controlled by `BROWSER_USE_FALLBACK_ENABLED`.

## Run Context Envelope (Required)
- `agentId: string`
- `runId: string`
- `templateId?: string`
- `scenarioId: string`
- `status: "active" | "paused" | "completed" | "error"`
- `timestamp: string` (ISO-8601)
- `details: Record<string, unknown>`

## Runtime Event Types
- `start`
- `step`
- `pause`
- `resume`
- `retry`
- `success`
- `failure`

## Scenario Tagging
- `marketplace_install_dev_template`
- `scholarbot_happy_path`
- `regbot_happy_path`
- `my_agents_run_now`
- `my_agents_schedule_update`

## Run Control State Model
Internal run state (`currentRunState`) is tracked independently from canonical `AgentStatus`.

- `idle`
- `running`
- `paused`
- `completed`
- `failed`
- `cancelled`

### Agent Status Mapping
- `running` -> `active`
- `paused` -> `paused`
- `completed` -> `completed`
- `failed` -> `error`
- `cancelled` -> `paused` (until delete tombstone finalizes)

## Event Order Guarantees
### ScholarBot (install/run)
1. `start`
2. `step`
3. `pause`

### ScholarBot (resume)
1. `resume`
2. `step`
3. `success`

### RegBot
1. `start`
2. `step`
3. `retry` (retryable Duo timeout only)
4. `success` or `failure`

### My Agents Run-Now
1. `step` (request accepted)
2. `step` (idempotent short-circuit) OR runtime run start
3. terminal telemetry event (`success` or `failure`)

### My Agents Schedule Update
1. validation performed
2. previous scheduled handle cancelled (if present)
3. new scheduled handle persisted
4. `success` telemetry with `nextRunAt`

## Error Taxonomy (Phase 2)
- `missing_or_deleted_agent`
- `run_already_in_progress` (idempotent, non-fatal)
- `invalid_schedule_cron`
- `schedule_compute_next_run_failed`
- `browser_task_handle_missing`
- `safe_delete_cancellation_failed`
