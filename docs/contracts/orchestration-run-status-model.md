# Orchestration Run Status Model

## Purpose

This document defines the shared run-control and lifecycle semantics for the orchestration layer,
covering both the Phase 1/2 runtime execution model and the Phase 4/5 scheduling and observability work.

## Browser Use Runtime Mode
- `local_v1` (primary): run tasks through local Browser Use v1.0 Python runner.
- `mock` (fallback/testing): deterministic in-memory task lifecycle.
- Fallback from `local_v1` to `mock` is controlled by `BROWSER_USE_FALLBACK_ENABLED`.

## Core Distinctions

- `agent.status`
  - lifecycle state for product controls
  - values: `active`, `paused`, `completed`, `error`
- `agent.lastRunStatus`
  - most recent execution outcome
  - values: `idle`, `running`, `succeeded`, `failed`, `cancelled`

These fields must not be collapsed into one status.

## Run Types

- `manual`
  - initiated by My Agents `run now`
- `scheduled`
  - initiated by cron/scheduler evaluation
- `resume`
  - initiated after pending human action resolution

## Trigger Sources

- `my_agents`
- `scheduler`
- `pending_action`
- `webhook`

## Operational Actions

- `run_now`
- `schedule_update`
- `delete`

Each action emits an operation event with:

- `agentId`
- `operation`
- `status`
- `message`
- `trace.traceId`
- `trace.emittedAt`
- `trace.source`
- optional `trace.scenarioId`

## Delete Semantics

- `archive_only`
  - use when the agent is not actively running
- `cancel_then_archive`
  - use when the last known runtime state is still active/running and downstream cancellation is
    required first

## Scheduling Validation Rules

- enabled schedules must include a non-empty cron expression
- cron expressions must have 5 or 6 segments
- timezone is required
- `jitterMinutes`, when present, must be a non-negative integer

## Scenario Tagging

- `marketplace_install_dev_template`
- `scholarbot_happy_path`
- `regbot_happy_path`
- `my_agents_run_now`
- `my_agents_schedule_update`

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

## Traceability Requirements

- every Phase 4 operation should have a stable `traceId`
- runtime handoff payloads and webhook callbacks should preserve the same `traceId`
- logs may attach a `scenarioId` for deterministic QA replay

## Error Taxonomy
- `missing_or_deleted_agent`
- `run_already_in_progress` (idempotent, non-fatal)
- `invalid_schedule_cron`
- `schedule_compute_next_run_failed`
- `browser_task_handle_missing`
- `safe_delete_cancellation_failed`
