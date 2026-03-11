import { decideRetry, type RetryPolicy } from "../shared/retryPolicy.ts";

export interface DuoConfig {
  duoTimeoutAttempts?: number;
  forceFailure?: boolean;
}

export interface DuoAttemptResult {
  success: boolean;
  code: "ok" | "timeout" | "failed";
  message: string;
  retryable: boolean;
  retryDelayMs: number;
}

export function performDuoChallenge(attempt: number, config: DuoConfig, policy: RetryPolicy): DuoAttemptResult {
  if (config.forceFailure) {
    return {
      success: false,
      code: "failed",
      message: "Forced Duo failure",
      retryable: false,
      retryDelayMs: 0,
    };
  }

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
