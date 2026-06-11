import { describe, expect, it, vi } from 'vitest';

import {
  ProviderAuthError,
  ProviderUnavailableError,
  RateLimited,
  withRetry,
} from '../src/index';

const noSleep = async () => { /* test seam */ };
const fixedRandom = () => 0.5;

describe('withRetry', () => {
  it('returns immediately on first-call success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { sleep: noSleep, random: fixedRandom });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries RateLimited then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimited('busy', 0))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { sleep: noSleep, random: fixedRandom });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries ProviderUnavailableError up to maxAttempts then rethrows', async () => {
    const err = new ProviderUnavailableError('upstream down');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { sleep: noSleep, random: fixedRandom, maxAttempts: 3 }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-transient errors', async () => {
    const err = new ProviderAuthError('bad key');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      withRetry(fn, { sleep: noSleep, random: fixedRandom }),
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('respects RateLimited.retryAfterMs over computed backoff (capped at maxDelayMs)', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimited('slow down', 12_000))
      .mockResolvedValueOnce('ok');
    await withRetry(fn, { sleep, random: fixedRandom, maxDelayMs: 5000 });
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('emits onRetry before each sleep with attempt + delay info', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimited('1', 0))
      .mockRejectedValueOnce(new RateLimited('2', 0))
      .mockResolvedValueOnce('ok');
    await withRetry(fn, { sleep: noSleep, random: fixedRandom, onRetry, baseDelayMs: 100 });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0]![0].attempt).toBe(1);
    expect(onRetry.mock.calls[1]![0].attempt).toBe(2);
  });

  it('honours a custom shouldRetry predicate', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('totally custom transient'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, {
      sleep: noSleep,
      random: fixedRandom,
      shouldRetry: (err) => err instanceof Error && err.message.includes('custom'),
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
