import {
  appendLog,
  updateAgentById,
  createMonitor,
  createPendingAction,
  listMonitorsByAgent,
  updateMonitorStatus,
} from "../shared/runtimeAdapters.ts";
import type { AgentRecord, RuntimeRunContext } from "../../../convex/types/contracts.ts";
import { performDuoChallenge, confirmDuoReauthentication } from "./duoHandler.ts";
import { checkDuoSession } from "./duoSession.ts";
import { checkSeatAvailability } from "./seatChecker.ts";
import { DEFAULT_REG_DUO_RETRY_POLICY } from "../shared/retryPolicy.ts";

export interface RegRunResult {
  [key: string]: unknown;
  status: "completed" | "error" | "active" | "waiting_for_duo";
  attempts: number;
  registeredUniqueId?: string;
  watchedUniqueIds: string[];
  /** Set when status is "waiting_for_duo" — the pending action the user must resolve. */
  pendingActionId?: string;
}

export function runRegBot(agent: AgentRecord, context: RuntimeRunContext): RegRunResult {
  appendLog({
    agentId: agent.id,
    event: "start",
    scenarioId: context.scenarioId,
    details: { runId: context.runId, message: "RegBot run started" },
  });

  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  const semester = stringOrDefault(configObj.semester, "Fall 2026");
  const pollIntervalMinutes = numberOrDefault(configObj.pollIntervalMinutes, 10);
  const watchTargets = normalizeWatchTargets(configObj, semester);
  const existingMonitors = listMonitorsByAgent(agent.id);
  const monitorByUniqueId = new Map(existingMonitors.map((monitor) => [monitor.uniqueId, monitor]));
  const monitors = watchTargets.map((target) => {
    const existingMonitor = monitorByUniqueId.get(target.uniqueId);
    if (existingMonitor) {
      return existingMonitor;
    }

    return createMonitor({
      userId: agent.userId,
      agentId: agent.id,
      courseNumber: target.courseNumber,
      uniqueId: target.uniqueId,
      semester: target.semester,
      pollIntervalMinutes,
    });
  });

  // ── Pre-flight: validate Duo remembered-device session ────────────────
  const duoSessionCheck = checkDuoSession(agent.userId);
  const hasAutoRegTargets = watchTargets.some((t) => t.autoRegister);

  if (hasAutoRegTargets && !duoSessionCheck.isValid) {
    appendLog({
      agentId: agent.id,
      event: "step",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        message: duoSessionCheck.hasSession
          ? "Duo remembered-device session expired — pausing for manual re-authentication"
          : "No Duo session found — pausing for manual re-authentication",
        remainingMs: duoSessionCheck.remainingMs,
      },
    });

    // Create a pending action so the UI prompts the user to re-auth.
    const pendingAction = createPendingAction({
      userId: agent.userId,
      agentId: agent.id,
      type: "confirmation",
      prompt:
        "Your Duo session has expired. Please open Chrome, go to " +
        "utdirect.utexas.edu, sign in with your UT EID (approve the Duo push " +
        'and check "Remember me"), then come back here and confirm.',
    });

    updateAgentById(agent.id, {
      status: "paused",
      lastRunStatus: "running",
      lastRunAt: new Date().toISOString(),
    });

    return {
      status: "waiting_for_duo",
      attempts: 0,
      watchedUniqueIds: watchTargets.map((entry) => entry.uniqueId),
      pendingActionId: pendingAction.id,
    };
  }

  if (hasAutoRegTargets && duoSessionCheck.isValid) {
    appendLog({
      agentId: agent.id,
      event: "step",
      scenarioId: context.scenarioId,
      details: {
        runId: context.runId,
        message: `Duo session valid (${Math.round(duoSessionCheck.remainingMs / 60_000)}min remaining)`,
      },
    });
  }

  const maxPollAttempts = numberOrDefault(configObj.maxPollAttempts, 3);

  for (let pollAttempt = 1; pollAttempt <= maxPollAttempts; pollAttempt += 1) {
    for (const target of watchTargets) {
      const monitor = monitors.find((entry) => entry.uniqueId === target.uniqueId);
      const seat = checkSeatAvailability(pollAttempt, {
        seatAvailableOnAttempt: target.seatAvailableOnAttempt,
        uniqueId: target.uniqueId,
        courseNumber: target.courseNumber,
      });

      appendLog({
        agentId: agent.id,
        event: "step",
        scenarioId: context.scenarioId,
        details: {
          runId: context.runId,
          pollAttempt,
          courseNumber: target.courseNumber,
          uniqueId: target.uniqueId,
          seatAvailable: seat.available,
          autoRegister: target.autoRegister,
        },
      });

      if (!seat.available) {
        continue;
      }

      if (!target.autoRegister) {
        appendLog({
          agentId: agent.id,
          event: "step",
          scenarioId: context.scenarioId,
          details: {
            runId: context.runId,
            pollAttempt,
            courseNumber: target.courseNumber,
            uniqueId: target.uniqueId,
            message: "Seat opened but auto-register is disabled for this target",
          },
        });
        continue;
      }

      for (let duoAttempt = 1; duoAttempt <= DEFAULT_REG_DUO_RETRY_POLICY.maxRetries + 1; duoAttempt += 1) {
        const duo = performDuoChallenge(
          duoAttempt,
          {
            userId: agent.userId,
            duoTimeoutAttempts: numberOrDefault(configObj.duoTimeoutAttempts, 0),
            duoSessionDurationHours: numberOrDefault(configObj.duoSessionDurationHours, 24),
            forceFailure: Boolean(configObj.forceFailure),
          },
          DEFAULT_REG_DUO_RETRY_POLICY,
        );

        if (duo.success) {
          if (monitor) {
            updateMonitorStatus(monitor.id, "registered");
          }

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
              courseNumber: target.courseNumber,
              uniqueId: target.uniqueId,
              message: "RegBot completed registration",
              duoMessage: duo.message,
            },
          });

          return {
            status: "completed",
            attempts: pollAttempt,
            registeredUniqueId: target.uniqueId,
            watchedUniqueIds: watchTargets.map((entry) => entry.uniqueId),
          };
        }

        // Duo session expired mid-run — pause for manual re-auth.
        if (duo.requiresManualAuth) {
          const pendingAction = createPendingAction({
            userId: agent.userId,
            agentId: agent.id,
            type: "confirmation",
            prompt:
              `Duo session expired while trying to register for ${target.courseNumber} (${target.uniqueId}). ` +
              "Please open Chrome, sign in at utdirect.utexas.edu with your UT EID " +
              '(approve the Duo push and check "Remember me"), then confirm here to resume.',
          });

          updateAgentById(agent.id, {
            status: "paused",
            lastRunStatus: "running",
            lastRunAt: new Date().toISOString(),
          });

          appendLog({
            agentId: agent.id,
            event: "step",
            scenarioId: context.scenarioId,
            details: {
              runId: context.runId,
              pollAttempt,
              duoAttempt,
              courseNumber: target.courseNumber,
              uniqueId: target.uniqueId,
              message: duo.message,
              pendingActionId: pendingAction.id,
            },
          });

          return {
            status: "waiting_for_duo",
            attempts: pollAttempt,
            watchedUniqueIds: watchTargets.map((entry) => entry.uniqueId),
            pendingActionId: pendingAction.id,
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
              courseNumber: target.courseNumber,
              uniqueId: target.uniqueId,
              retryDelayMs: duo.retryDelayMs,
              reason: duo.message,
            },
          });
          continue;
        }

        if (monitor) {
          updateMonitorStatus(monitor.id, "failed");
        }
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
            courseNumber: target.courseNumber,
            uniqueId: target.uniqueId,
            reason: duo.message,
          },
        });

        return {
          status: "error",
          attempts: pollAttempt,
          watchedUniqueIds: watchTargets.map((entry) => entry.uniqueId),
        };
      }

      if (monitor) {
        updateMonitorStatus(monitor.id, "failed");
      }
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
          courseNumber: target.courseNumber,
          uniqueId: target.uniqueId,
          reason: "Exceeded Duo retry attempts",
        },
      });

      return {
        status: "error",
        attempts: pollAttempt,
        watchedUniqueIds: watchTargets.map((entry) => entry.uniqueId),
      };
    }
  }

  updateAgentById(agent.id, {
    status: "active",
    lastRunStatus: undefined,
    lastRunAt: new Date().toISOString(),
  });

  return {
    status: "active",
    attempts: maxPollAttempts,
    watchedUniqueIds: watchTargets.map((entry) => entry.uniqueId),
  };
}

/**
 * Call this when the user resolves a "waiting_for_duo" pending action
 * to record their fresh Duo session before resuming the agent.
 */
export function handleDuoReauthConfirmation(agent: AgentRecord): void {
  const configObj = (agent.config.currentConfig ?? agent.config.defaultConfig) as Record<string, unknown>;
  confirmDuoReauthentication(agent.userId, configObj);
}

interface WatchTarget {
  courseNumber: string;
  uniqueId: string;
  semester: string;
  autoRegister: boolean;
  seatAvailableOnAttempt: number;
}

function normalizeWatchTargets(configObj: Record<string, unknown>, fallbackSemester: string): WatchTarget[] {
  const watchList = configObj.watchList;
  if (Array.isArray(watchList)) {
    const normalized = watchList
      .map((entry) => normalizeWatchTarget(entry, fallbackSemester))
      .filter((entry): entry is WatchTarget => entry !== undefined);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [
    {
      courseNumber: stringOrDefault(configObj.courseNumber, "CS 378"),
      uniqueId: stringOrDefault(configObj.uniqueId, "12345"),
      semester: stringOrDefault(configObj.semester, fallbackSemester),
      autoRegister: booleanOrDefault(configObj.autoRegister, true),
      seatAvailableOnAttempt: numberOrDefault(configObj.seatAvailableOnAttempt, 1),
    },
  ];
}

function normalizeWatchTarget(entry: unknown, fallbackSemester: string): WatchTarget | undefined {
  if (!entry || typeof entry !== "object") {
    return undefined;
  }

  const record = entry as Record<string, unknown>;
  const uniqueId = stringOrDefault(record.uniqueId, "");
  if (!uniqueId) {
    return undefined;
  }

  return {
    courseNumber: stringOrDefault(record.courseNumber, "Unknown Course"),
    uniqueId,
    semester: stringOrDefault(record.semester, fallbackSemester),
    autoRegister: booleanOrDefault(record.autoRegister, true),
    seatAvailableOnAttempt: numberOrDefault(record.seatAvailableOnAttempt, 1),
  };
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
