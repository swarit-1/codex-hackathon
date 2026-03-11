# Orchestration v1 Freeze Evidence (Phase 1)

## Scope Covered
- Install-driven runtime instantiation for first-party dev templates.
- ScholarBot pause/resume state progression with pending action checkpoint.
- RegBot retry behavior for Duo timeout path.
- Scenario-tagged telemetry for required Phase 1 scenarios.

## Scenario Trace Summaries
### `marketplace_install_dev_template`
1. `marketplace.installTemplate` validates dev template source/type.
2. Agent is created with `templateId`, `ownerType`, and runtime config.
3. Install kickoff log emitted with marketplace scenario tag.
4. Runtime run is triggered through `orchestrator.triggerAgentRun(..., "install")`.

### `scholarbot_happy_path`
1. ScholarBot run emits `start`.
2. Scholarship record transitions to `applying`.
3. Pending action is created and scholarship transitions to `paused`.
4. Resume action emits `resume`, then scholarship transitions to `submitted`.
5. Run emits `success` and agent status becomes `completed`.

### `regbot_happy_path`
1. RegBot run emits `start` and monitor enters `watching`.
2. Seat checks emit `step` events.
3. Retry path emits `retry` for Duo timeout attempts.
4. Registration success emits `success`, monitor becomes `registered`, agent `completed`.

## Required Log Fields Verified
- `agentId`
- `timestamp`
- `event`
- `scenarioId`
- `details.runId`

## Payload Examples
### Install kickoff log details
```json
{
  "templateId": "tpl_dev_scholarbot",
  "templateTitle": "ScholarBot",
  "message": "Template installed and run kickoff requested"
}
```

### Retry log details (RegBot)
```json
{
  "runId": "<uuid>",
  "pollAttempt": 1,
  "duoAttempt": 1,
  "retryDelayMs": 1000,
  "reason": "Duo challenge timed out"
}
```
