# Orchestration Webhook Contracts

## Purpose

This document defines the normalized runtime callback envelope that the backend expects from the
orchestration/runtime layer, covering both the original inbound payload model and the Phase 4/5
handoff and webhook callback contracts.

## Runtime Handoff Payload

Prepared by backend run-control helpers before the runtime layer receives work:

```json
{
  "agentId": "agents/my_agents_run_now",
  "runType": "manual",
  "source": "my_agents",
  "requestedAt": 1773187200000,
  "requestedByUserId": "users/demo-user",
  "scenarioId": "my_agents_run_now",
  "traceId": "run_now:agents/my_agents_run_now:1773187200000",
  "schedule": {
    "enabled": true,
    "cron": "*/10 * * * *",
    "timezone": "America/Chicago",
    "jitterMinutes": 2
  }
}
```

## Runtime Webhook Payload

Expected normalized callback envelope from runtime to backend:

```json
{
  "agentId": "agents/my_agents_run_now",
  "event": "runtime.run.completed",
  "status": "succeeded",
  "occurredAt": 1773187260000,
  "traceId": "run_now:agents/my_agents_run_now:1773187200000",
  "runType": "manual",
  "scenarioId": "my_agents_run_now",
  "details": {
    "message": "runtime completed successfully"
  }
}
```

## Legacy Inbound Payload (Phase 1/2)

```ts
interface RawWebhookPayload {
  agentId: string;
  runId?: string;
  templateId?: string;
  scenarioId?: string;
  status?: "active" | "paused" | "completed" | "error";
  event?: "start" | "step" | "pause" | "resume" | "retry" | "success" | "failure";
  timestamp?: string;
  details?: Record<string, unknown>;
}
```

### Legacy Validation Rules
- `agentId` is required.
- Missing optional fields are normalized with deterministic defaults:
  - `runId = "webhook_run"`
  - `scenarioId = "webhook_retry_path"`
  - `status = "active"`
  - `event = "step"`
  - `timestamp = now()`
  - `details = {}`

## Required Fields (Phase 4+)

- `agentId`
- `event`
- `status`
- `occurredAt`
- `traceId`

## Optional Fields

- `runType`
- `scenarioId`
- `details`

## Backend Expectations

- `traceId` must match the originating handoff payload
- `status` must align with `AgentRunStatus`
- `scenarioId`, when present, is passed through to logs for Dev 4 replay and trace correlation
- duplicate webhook deliveries should be tolerated by using `traceId` plus event timestamp as the
  deduplication basis in later phases

## Processing Rules
1. Normalize payload to runtime event model.
2. Append scenario-tagged log entry to `agentLogs`.
3. Update agent `status` and `lastRunStatus` based on webhook status.
4. If payload contains a pending action resume event, route to `orchestrator.resumeFromPendingAction(actionId)`.

## Error Contract
- Unknown `agentId` returns an error and does not append logs.
- Invalid payload shape (missing required fields) returns an error.
- Resume payload with invalid `actionId` returns an error and logs failure context.
