export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RetryDecision {
  shouldRetry: boolean;
  nextDelayMs: number;
}

export const DEFAULT_REG_DUO_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 8_000,
  backoffMultiplier: 2,
};

export function calculateRetryDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_REG_DUO_RETRY_POLICY): number {
  const growth = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, Math.max(0, attempt - 1));
  return Math.min(policy.maxDelayMs, growth);
}

export function decideRetry(
  isRetryableError: boolean,
  attempt: number,
  policy: RetryPolicy = DEFAULT_REG_DUO_RETRY_POLICY,
): RetryDecision {
  if (!isRetryableError) {
    return { shouldRetry: false, nextDelayMs: 0 };
  }

  const shouldRetry = attempt <= policy.maxRetries;
  return {
    shouldRetry,
    nextDelayMs: shouldRetry ? calculateRetryDelayMs(attempt, policy) : 0,
  };
}
