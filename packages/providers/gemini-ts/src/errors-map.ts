import {
  ProviderAuthError,
  ProviderContentFilterError,
  ProviderError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
} from '@foundry/providers-core';

/**
 * Translate Gemini SDK errors. The SDK throws `GoogleGenerativeAIError` and
 * `GoogleGenerativeAIFetchError` with `status` + `statusText` + `errorDetails`.
 */
export function translateError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const e = err as {
    status?: number;
    statusText?: string;
    message?: string;
    errorDetails?: unknown;
  };

  const status = typeof e?.status === 'number' ? e.status : undefined;
  const message = e?.message ?? 'Gemini error';
  const lower = (message + ' ' + (e?.statusText ?? '')).toLowerCase();

  if (status === 401 || status === 403 || /api[_ ]key|unauthorized|forbidden/.test(lower)) {
    return new ProviderAuthError(message);
  }
  if (status === 429 || /rate.?limit|quota/.test(lower)) {
    return new RateLimited(message, 1000);
  }
  if (status === 404 || /model.*not.*found|not.*supported/.test(lower)) {
    return new ProviderModelNotFoundError(message);
  }
  if (/safety|blocked|content/i.test(lower)) {
    return new ProviderContentFilterError(message);
  }
  if (status !== undefined && status >= 500) {
    return new ProviderUnavailableError(message);
  }
  return new ProviderError(message);
}
