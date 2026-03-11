# Dev 4 `v1-freeze` Record

Freeze status: Pending implementation handoff
Freeze owner: Dev 4
Created: March 11, 2026

## Frozen Contract Scope

### Shared enums

- `AgentStatus = active | paused | completed | error`
- `ScholarshipStatus = found | applying | paused | submitted | expired`
- `MonitorStatus = watching | registered | failed`
- `PendingActionType = essay | detail | confirmation`
- `TemplateSource = dev | student`
- `SubmissionStatus = draft | pending_review | approved | rejected`
- `TemplateVisibility = private | public`

### Frozen endpoint surface

- Existing:
  - `dashboard.getOverview(userId)`
  - `users.upsertProfile(payload)`
  - `users.getProfile()`
  - `agents.create(type, config)`
  - `agents.updateStatus(agentId, status)`
  - `agents.listByUser()`
  - `scholarships.listByUser(filters)`
  - `scholarships.upsertFromRun(payload)`
  - `registrationMonitors.create(payload)`
  - `registrationMonitors.listByUser()`
  - `pendingActions.create(payload)`
  - `pendingActions.resolve(actionId, response)`
  - `customWorkflows.create(payload)`
  - `customWorkflows.update(agentId, patch)`
  - `agentLogs.append(payload)`
  - `agentLogs.list(agentId, pagination)`
- Added:
  - `marketplace.listTemplates(filters)`
  - `marketplace.getTemplate(templateId)`
  - `marketplace.installTemplate(templateId, config)`
  - `marketplace.submitTemplate(payload)`
  - `marketplace.reviewSubmission(submissionId, decision)`
  - `agents.runNow(agentId)`
  - `agents.updateSchedule(agentId, schedule)`
  - `agents.delete(agentId)`

### Frozen runtime interfaces

- `orchestrator.triggerAgentRun(agentId, runType)`
- `orchestrator.handleWebhook(eventPayload)`
- `orchestrator.resumeFromPendingAction(actionId)`
- `flowforge.generateWorkflowSpec(nlDescription)`
- `flowforge.generateAgentScript(spec)`

### Approved alias policy

- Product/UI name: `Model-to-Agent Studio`
- Internal compatibility aliases allowed:
  - `flowforge.generateWorkflowSpec`
  - `flowforge.generateAgentScript`
- Legacy `FlowForge` wording is not allowed in user-facing UI, payload examples, or release evidence

### Scenario coverage required before freeze completion

- `marketplace_install_dev_template`
- `marketplace_install_student_template`
- `my_agents_run_now`
- `my_agents_schedule_update`

## Freeze Gate Conditions

`v1-freeze` may move from pending to issued only when:

- Dev 1, Dev 2, and Dev 3 handoff checklists are acknowledged
- open Sev-1 drift items are resolved
- any remaining Sev-2 items are explicitly waived with retest owner
- compliance report is updated to reflect final status

## Post-freeze Change Control

- No contract changes without a Dev 4 ticket.
- Every approved change must include compatibility impact and impacted scenario IDs.
- Every approved change must trigger targeted revalidation before merge.
