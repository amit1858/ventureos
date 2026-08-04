import {
  ProviderAuthError,
  ProviderContentFilterError,
  ProviderError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
} from '@foundry/providers-core';

/**
 * Translate an unknown error from the Anthropic SDK into the provider taxonomy.
 * Anthropic SDK errors expose `{status, error: {type, message}, headers, request_id}`.
 */
export function translateError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const e = err as {
    status?: number;
    error?: { type?: string; message?: string };
    message?: string;
    headers?: Record<string, string | undefined>;
    request_id?: string;
  };

  const requestId = typeof e?.request_id === 'string' ? e.request_id : undefined;
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const type = e?.error?.type;
  const message = e?.error?.message ?? e?.message ?? 'Anthropic error';

  if (status === 401 || status === 403 || type === 'authentication_error' || type === 'permission_error') {
    return new ProviderAuthError(message, requestId);
  }
  if (status === 429 || type === 'rate_limit_error' || type === 'overloaded_error') {
    const retryAfterMs = parseRetryAfterMs(e?.headers?.['retry-after'] ?? e?.headers?.['Retry-After']);
    return new RateLimited(message, retryAfterMs, requestId);
  }
  if (type === 'not_found_error' || (status === 404 && /model/i.test(message))) {
    return new ProviderModelNotFoundError(message, requestId);
  }
  if (type === 'invalid_request_error' && /model/i.test(message)) {
    return new ProviderModelNotFoundError(message, requestId);
  }
  if (type === 'content_policy_violation') {
    return new ProviderContentFilterError(message, requestId);
  }
  if (status !== undefined && status >= 500) {
    return new ProviderUnavailableError(message, requestId);
  }
  return new ProviderError(message, requestId);
}

function parseRetryAfterMs(header: string | undefined): number {
  if (!header) return 1000;
  const seconds = Number.parseFloat(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return 1000;
}
