import { decideRetry, type RetryPolicy } from "../shared/retryPolicy.ts";
import {
  checkDuoSession,
  recordDuoAuthentication,
  parseDuoSessionDuration,
  type DuoSessionStatus,
} from "./duoSession.ts";

export interface DuoConfig {
  /** Number of initial attempts that are expected to time out (for testing). */
  duoTimeoutAttempts?: number;
  /** Force failure (for testing). */
  forceFailure?: boolean;
  /** User ID to look up remembered-device session. */
  userId?: string;
  /**
   * How many hours a Duo "remember me" session lasts.
   * Defaults to 24h. UT Austin typically allows 7-30 days.
   * Set this to match your Duo "Remember me" duration.
   */
  duoSessionDurationHours?: number;
  /** Chrome profile directory the session was established in. */
  profileDirectory?: string;
}

export interface DuoAttemptResult {
  success: boolean;
  code: "ok" | "timeout" | "failed" | "session_expired";
  message: string;
  retryable: boolean;
  retryDelayMs: number;
  /** When code is "session_expired", the agent should pause and prompt the user. */
  requiresManualAuth?: boolean;
  sessionStatus?: DuoSessionStatus;
}

/**
 * Attempt a Duo challenge. When a remembered-device session exists and is
 * valid, the challenge succeeds immediately (the browser will not be prompted).
 *
 * When the session is expired or missing, returns `code: "session_expired"`
 * so the caller can pause the agent and ask the user to re-authenticate.
 */
export function performDuoChallenge(
  attempt: number,
  config: DuoConfig,
  policy: RetryPolicy,
): DuoAttemptResult {
  // ── Testing overrides (preserve backward compat) ──────────────────────
  if (config.forceFailure) {
    return {
      success: false,
      code: "failed",
      message: "Forced Duo failure",
      retryable: false,
      retryDelayMs: 0,
    };
  }

  // ── Check remembered-device session ───────────────────────────────────
  if (config.userId) {
    const sessionStatus = checkDuoSession(config.userId);

    if (sessionStatus.isValid) {
      // Session cookie is still valid — Duo won't prompt the user.
      return {
        success: true,
        code: "ok",
        message: `Duo bypassed via remembered device (${Math.round(sessionStatus.remainingMs / 60_000)}min remaining)`,
        retryable: false,
        retryDelayMs: 0,
        sessionStatus,
      };
    }

    // Session expired or missing — need manual re-auth.
    if (attempt === 1) {
      return {
        success: false,
        code: "session_expired",
        message: sessionStatus.hasSession
          ? "Duo remembered-device session has expired. Please re-authenticate manually in Chrome, then resume the agent."
          : "No Duo session found. Please authenticate manually in Chrome (check 'Remember me'), then resume the agent.",
        retryable: false,
        retryDelayMs: 0,
        requiresManualAuth: true,
        sessionStatus,
      };
    }

    // On retries after re-auth, check again in case the user authenticated.
    const refreshed = checkDuoSession(config.userId);
    if (refreshed.isValid) {
      return {
        success: true,
        code: "ok",
        message: "Duo session refreshed after manual re-authentication",
        retryable: false,
        retryDelayMs: 0,
        sessionStatus: refreshed,
      };
    }

    // Still no valid session after retry.
    const retry = decideRetry(true, attempt, policy);
    return {
      success: false,
      code: "session_expired",
      message: "Duo session still not valid. Waiting for manual re-authentication.",
      retryable: retry.shouldRetry,
      retryDelayMs: retry.nextDelayMs,
      requiresManualAuth: true,
      sessionStatus: refreshed,
    };
  }

  // ── Legacy mock path (no userId → simulation mode) ────────────────────
  const timeoutAttempts = Math.max(0, config.duoTimeoutAttempts ?? 0);
  if (attempt <= timeoutAttempts) {
    const retry = decideRetry(true, attempt, policy);
    return {
      success: false,
      code: "timeout",
      message: "Duo challenge timed out",
      retryable: retry.shouldRetry,
      retryDelayMs: retry.nextDelayMs,
    };
  }

  return {
    success: true,
    code: "ok",
    message: "Duo challenge approved",
    retryable: false,
    retryDelayMs: 0,
  };
}

/**
 * Call after the user confirms they manually authenticated with Duo.
 * This records the session so subsequent agent runs can bypass Duo.
 */
export function confirmDuoReauthentication(
  userId: string,
  configObj: Record<string, unknown>,
): void {
  const durationMs = parseDuoSessionDuration(configObj);
  const profileDir =
    typeof configObj.profileDirectory === "string"
      ? configObj.profileDirectory
      : "Default";

  recordDuoAuthentication(userId, {
    sessionDurationMs: durationMs,
    profileDirectory: profileDir,
  });
}
