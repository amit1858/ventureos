import {
  ProviderAuthError,
  ProviderContentFilterError,
  ProviderError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
} from '@ventureos/providers-core';

/**
 * Translate an unknown error thrown by the `openai` SDK into the provider-layer taxonomy.
 * Adapters MUST funnel every SDK exception through here so application code never sees
 * raw SDK types.
 */
export function translateError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const e = err as {
    status?: number;
    code?: string;
    type?: string;
    message?: string;
    headers?: Record<string, string | undefined>;
    request_id?: string;
  };

  const requestId = typeof e?.request_id === 'string' ? e.request_id : undefined;
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const code = typeof e?.code === 'string' ? e.code : undefined;
  const message = typeof e?.message === 'string' ? e.message : 'OpenAI error';

  if (status === 401 || status === 403 || code === 'invalid_api_key') {
    return new ProviderAuthError(message, requestId);
  }
  if (status === 429 || code === 'rate_limit_exceeded') {
    const retryHeader = e?.headers?.['retry-after'] ?? e?.headers?.['Retry-After'];
    const retryAfterMs = parseRetryAfterMs(retryHeader);
    return new RateLimited(message, retryAfterMs, requestId);
  }
  if (code === 'model_not_found' || (status === 404 && /model/i.test(message))) {
    return new ProviderModelNotFoundError(message, requestId);
  }
  if (code === 'content_filter' || e?.type === 'content_filter') {
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
