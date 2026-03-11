# Orchestration Webhook Contracts

## Purpose
Defines accepted webhook payload shape and normalization behavior for runtime ingestion.

## Inbound Payload
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

## Validation Rules
- `agentId` is required.
- Missing optional fields are normalized with deterministic defaults:
  - `runId = "webhook_run"`
  - `scenarioId = "webhook_retry_path"`
  - `status = "active"`
  - `event = "step"`
  - `timestamp = now()`
  - `details = {}`

## Processing Rules
1. Normalize payload to runtime event model.
2. Append scenario-tagged log entry to `agentLogs`.
3. Update agent `status` and internal `currentRunState` mapping if status changed.
4. If payload contains `details.actionId` with `event="resume"`, route to `orchestrator.resumeFromPendingAction(actionId)`.

## Error Contract
- Unknown `agentId` returns an error and does not append logs.
- Invalid payload shape (missing `agentId`) returns an error.
- Resume payload with invalid `actionId` returns an error and logs failure context.
