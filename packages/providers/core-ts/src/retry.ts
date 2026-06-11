/**
 * Provider-call retry/backoff helper (Sprint 2A.6 / PR5).
 *
 * Adapters surface transient failures as `RateLimited` (with `retryAfterMs`)
 * or `ProviderUnavailableError` (translated from 5xx / network errors).
 * `withRetry` wraps a single adapter call and re-tries those classes only —
 * other errors (auth, content filter, etc.) propagate immediately.
 *
 * Defaults: 3 attempts total, exponential backoff (500ms × 2^n) with
 * full jitter, capped at 8s. `RateLimited.retryAfterMs` (when > 0) overrides
 * the computed delay. The clock and PRNG are injectable so tests are
 * deterministic.
 */
import { ProviderUnavailableError, RateLimited } from './errors';

export interface RetryOptions {
  /** Total attempts including the first one. Default 3. */
  maxAttempts?: number;
  /** Base delay for exponential backoff. Default 500ms. */
  baseDelayMs?: number;
  /** Hard cap on a single backoff delay. Default 8000ms. */
  maxDelayMs?: number;
  /**
   * Custom retry predicate. When provided, replaces the default
   * (RateLimited + ProviderUnavailableError).
   */
  shouldRetry?: (err: unknown) => boolean;
  /** Injectable sleep (default `setTimeout`). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable PRNG in [0,1). */
  random?: () => number;
  /**
   * Observability hook fired before each retry sleep. Receives the error,
   * the upcoming delay, and the 1-based attempt number that just failed.
   */
  onRetry?: (info: { error: unknown; delayMs: number; attempt: number }) => void;
}

const DEFAULTS = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8000,
} as const;

function defaultShouldRetry(err: unknown): boolean {
  return err instanceof RateLimited || err instanceof ProviderUnavailableError;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute `fn`, retrying on transient provider failures.
 *
 * Returns whatever `fn` returns on the first success. Rethrows the last
 * caught error after `maxAttempts` (or immediately if `shouldRetry` says no).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseDelayMs = options.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      if (!shouldRetry(err)) throw err;

      let delayMs: number;
      if (err instanceof RateLimited && err.retryAfterMs > 0) {
        delayMs = Math.min(err.retryAfterMs, maxDelayMs);
      } else {
        const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
        // Full jitter — uniform in [0, exp].
        delayMs = Math.floor(random() * exp);
      }
      options.onRetry?.({ error: err, delayMs, attempt });
      await sleep(delayMs);
    }
  }
  throw lastError;
}
