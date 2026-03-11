/**
 * Duo "remembered device" session management.
 *
 * Strategy: The browser automation already launches Chrome with the user's
 * profile (user_data_dir / profile_directory), so Duo's "Remember me for N days"
 * cookie is inherited automatically. This module tracks the *expected* session
 * validity window so the agent can decide upfront whether the user needs to
 * re-authenticate before an automated run.
 *
 * Flow:
 *  1. User authenticates manually in Chrome → checks "Remember me" on Duo.
 *  2. User tells the app they authenticated → we store `validUntil`.
 *  3. Before an agent run, we check if the session is still valid.
 *  4. If expired, the agent pauses and creates a pending action prompting
 *     the user to re-authenticate manually, then resume.
 */

import { getRuntimeStore, nextId, type DuoSessionStoreRecord } from "../../../convex/runtimeStore.ts";

// Duo "Remember me" typically lasts 30 days, but UT may configure it shorter.
// Default to 24 hours to be conservative; users can override via config.
const DEFAULT_DUO_SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export type DuoSessionRecord = DuoSessionStoreRecord;

export interface DuoSessionStatus {
  hasSession: boolean;
  isValid: boolean;
  /** Milliseconds remaining, or 0 if expired / no session. */
  remainingMs: number;
  session?: DuoSessionRecord;
}

// ── In-memory store ─────────────────────────────────────────────────────────

function getSessionStore(): Map<string, DuoSessionStoreRecord> {
  return getRuntimeStore().duoSessions;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether the given user has a valid (non-expired) Duo session.
 */
export function checkDuoSession(userId: string): DuoSessionStatus {
  const session = findSessionByUser(userId);
  if (!session) {
    return { hasSession: false, isValid: false, remainingMs: 0 };
  }

  const now = Date.now();
  const remainingMs = Math.max(0, session.validUntil - now);
  const isValid = remainingMs > 0;

  return { hasSession: true, isValid, remainingMs, session };
}

/**
 * Record that the user just completed a manual Duo authentication.
 * Call this after the user confirms they authenticated in their browser.
 */
export function recordDuoAuthentication(
  userId: string,
  opts?: {
    sessionDurationMs?: number;
    profileDirectory?: string;
  },
): DuoSessionRecord {
  const now = Date.now();
  const durationMs = opts?.sessionDurationMs ?? DEFAULT_DUO_SESSION_DURATION_MS;
  const profileDir = opts?.profileDirectory ?? "Default";

  const existing = findSessionByUser(userId);
  if (existing) {
    existing.authenticatedAt = now;
    existing.validUntil = now + durationMs;
    existing.sessionDurationMs = durationMs;
    existing.profileDirectory = profileDir;
    existing.updatedAt = now;
    return existing;
  }

  const id = nextId("duo");
  const record: DuoSessionStoreRecord = {
    id,
    userId,
    authenticatedAt: now,
    validUntil: now + durationMs,
    sessionDurationMs: durationMs,
    profileDirectory: profileDir,
    createdAt: now,
    updatedAt: now,
  };
  getSessionStore().set(id, record);
  return record;
}

/**
 * Mark a Duo session as explicitly expired (e.g. user logged out).
 */
export function invalidateDuoSession(userId: string): void {
  const session = findSessionByUser(userId);
  if (session) {
    session.validUntil = 0;
    session.updatedAt = Date.now();
  }
}

/**
 * Return the recommended session duration in ms based on agent config.
 * Duo "remember me" at UT is typically 7-30 days. We let the user override.
 */
export function parseDuoSessionDuration(configObj: Record<string, unknown>): number {
  const hours = configObj.duoSessionDurationHours;
  if (typeof hours === "number" && Number.isFinite(hours) && hours > 0) {
    return hours * 60 * 60 * 1000;
  }
  return DEFAULT_DUO_SESSION_DURATION_MS;
}

// ── Internal ────────────────────────────────────────────────────────────────

function findSessionByUser(userId: string): DuoSessionStoreRecord | undefined {
  for (const session of getSessionStore().values()) {
    if (session.userId === userId) {
      return session;
    }
  }
  return undefined;
}
