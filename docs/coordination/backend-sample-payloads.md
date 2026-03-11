# Backend Sample Payloads

## Purpose

These are deterministic sample payloads for Dev 1, Dev 3, and Dev 4. They align with the Phase 4
run-control model and the Phase 5 fixture pack expectations.

## My Agents `run now`

Operation event:

```json
{
  "agentId": "agents/my_agents_run_now",
  "operation": "run_now",
  "status": "accepted",
  "message": "manual run request accepted for downstream runtime processing",
  "trace": {
    "traceId": "run_now:agents/my_agents_run_now:1773187200000",
    "emittedAt": 1773187200000,
    "source": "my_agents",
    "scenarioId": "my_agents_run_now"
  }
}
```

Runtime handoff:

```json
{
  "agentId": "agents/my_agents_run_now",
  "runType": "manual",
  "source": "my_agents",
  "requestedAt": 1773187200000,
  "requestedByUserId": "users/demo-user",
  "scenarioId": "my_agents_run_now",
  "traceId": "run_now:agents/my_agents_run_now:1773187200000"
}
```

## My Agents schedule update

```json
{
  "agentId": "agents/my_agents_schedule_update",
  "operation": "schedule_update",
  "status": "accepted",
  "message": "schedule change accepted for downstream runtime processing",
  "trace": {
    "traceId": "schedule_update:agents/my_agents_schedule_update:1773187200000",
    "emittedAt": 1773187200000,
    "source": "scheduler",
    "scenarioId": "my_agents_schedule_update"
  },
  "metadata": {
    "schedule": {
      "enabled": true,
      "cron": "*/10 * * * *",
      "timezone": "America/Chicago",
      "jitterMinutes": 2
    }
  }
}
```

## Submission moderation transition

```json
{
  "scenarioId": "submission_pending_to_approved",
  "event": "submission.review.requested",
  "level": "info",
  "details": {
    "from": "pending_review",
    "to": "approved"
  }
}
```

## Runtime webhook retry path

```json
{
  "agentId": "agents/webhook_retry_path",
  "event": "agent.webhook.retry_requested",
  "status": "failed",
  "occurredAt": 1773187260000,
  "traceId": "run_now:agents/webhook_retry_path:1773187200000",
  "runType": "manual",
  "scenarioId": "webhook_retry_path",
  "details": {
    "deliveryAttempt": 2
  }
}
```
