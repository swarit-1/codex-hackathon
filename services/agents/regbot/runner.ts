import {
  appendLog,
  updateAgentById,
  createMonitor,
  listMonitorsByAgent,
  updateMonitorStatus,
} from "../shared/runtimeAdapters.ts";
import type { AgentRecord, RuntimeRunContext } from "../../../convex/types/contracts.ts";
import { performDuoChallenge } from "./duoHandler.ts";
import { checkSeatAvailability } from "./seatChecker.ts";
import { DEFAULT_REG_DUO_RETRY_POLICY } from "../shared/retryPolicy.ts";

export interface RegRunResult {
  [key: string]: unknown;
  status: "completed" | "error" | "active";
  attempts: number;
}

export function runRegBot(agent: AgentRecord, context: RuntimeRunContext): RegRunResult {
  appendLog({
    agentId: agent.id,
    event: "start",
    scenarioId: context.scenarioId,
    details: { runId: context.runId, message: "RegBot run started" },
  });

  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  const courseNumber = stringOrDefault(configObj.courseNumber, "CS 378");
  const uniqueId = stringOrDefault(configObj.uniqueId, "12345");
  const semester = stringOrDefault(configObj.semester, "Fall 2026");
  const pollIntervalMinutes = numberOrDefault(configObj.pollIntervalMinutes, 10);

  const monitor =
    listMonitorsByAgent(agent.id)[0] ??
    createMonitor({
      userId: agent.userId,
      agentId: agent.id,
      courseNumber,
      uniqueId,
      semester,
      pollIntervalMinutes,
    });

  const maxPollAttempts = numberOrDefault(configObj.maxPollAttempts, 3);

  for (let pollAttempt = 1; pollAttempt <= maxPollAttempts; pollAttempt += 1) {
    const seat = checkSeatAvailability(pollAttempt, {
      seatAvailableOnAttempt: numberOrDefault(configObj.seatAvailableOnAttempt, 1),
    });

    appendLog({
      agentId: agent.id,
      event: "step",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        pollAttempt,
        seatAvailable: seat.available,
      },
    });

    if (!seat.available) {
      continue;
    }

    for (let duoAttempt = 1; duoAttempt <= DEFAULT_REG_DUO_RETRY_POLICY.maxRetries + 1; duoAttempt += 1) {
      const duo = performDuoChallenge(duoAttempt, {
        duoTimeoutAttempts: numberOrDefault(configObj.duoTimeoutAttempts, 0),
        forceFailure: Boolean(configObj.forceFailure),
      }, DEFAULT_REG_DUO_RETRY_POLICY);

      if (duo.success) {
        updateMonitorStatus(monitor.id, "registered");
        updateAgentById(agent.id, {
          status: "completed",
          lastRunStatus: "success",
          lastRunAt: new Date().toISOString(),
        });

        appendLog({
          agentId: agent.id,
          event: "success",
          scenarioId: context.scenarioId,
          details: {
            runId: context.runId,
            pollAttempt,
            duoAttempt,
            message: "RegBot completed registration",
          },
        });

        return {
          status: "completed",
          attempts: pollAttempt,
        };
      }

      if (duo.retryable) {
        appendLog({
          agentId: agent.id,
          event: "retry",
          scenarioId: context.scenarioId,
          details: {
            runId: context.runId,
            pollAttempt,
            duoAttempt,
            retryDelayMs: duo.retryDelayMs,
            reason: duo.message,
          },
        });
        continue;
      }

      updateMonitorStatus(monitor.id, "failed");
      updateAgentById(agent.id, {
        status: "error",
        lastRunStatus: "failed",
        lastRunAt: new Date().toISOString(),
      });

      appendLog({
        agentId: agent.id,
        event: "failure",
        scenarioId: context.scenarioId,
        details: {
          runId: context.runId,
          pollAttempt,
          duoAttempt,
          reason: duo.message,
        },
      });

      return {
        status: "error",
        attempts: pollAttempt,
      };
    }

    updateMonitorStatus(monitor.id, "failed");
    updateAgentById(agent.id, {
      status: "error",
      lastRunStatus: "failed",
      lastRunAt: new Date().toISOString(),
    });

    appendLog({
      agentId: agent.id,
      event: "failure",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        pollAttempt,
        reason: "Exceeded Duo retry attempts",
      },
    });

    return {
      status: "error",
      attempts: pollAttempt,
    };
  }

  updateAgentById(agent.id, {
    status: "active",
    lastRunStatus: undefined,
    lastRunAt: new Date().toISOString(),
  });

  return {
    status: "active",
    attempts: maxPollAttempts,
  };
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
