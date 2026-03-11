# Orchestration Webhook Contracts

## Purpose

This document defines the normalized runtime callback envelope that Convex expects from the
orchestration/runtime layer during Phase 4 and Phase 5 work.

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

## Required Fields

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
