import {
  ProviderAuthError,
  ProviderContentFilterError,
  ProviderError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
} from '@ventureos/providers-core';

/**
 * Translate Azure OpenAI REST response errors. Body shape mirrors OpenAI:
 * `{ error: { code, message } }`, with HTTP status carrying most of the signal.
 */
export interface RawAzureError {
  status: number;
  body?: { error?: { code?: string; message?: string } };
  retryAfter?: string;
  requestId?: string;
}

export function translateError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const e = err as RawAzureError & { message?: string };
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const code = e?.body?.error?.code;
  const message = e?.body?.error?.message ?? e?.message ?? 'Azure OpenAI error';
  const requestId = typeof e?.requestId === 'string' ? e.requestId : undefined;

  if (status === 401 || status === 403 || code === 'invalid_api_key' || code === 'PermissionDenied') {
    return new ProviderAuthError(message, requestId);
  }
  if (status === 429) {
    return new RateLimited(message, parseRetryAfterMs(e?.retryAfter), requestId);
  }
  if (status === 404 || code === 'DeploymentNotFound' || code === 'model_not_found') {
    return new ProviderModelNotFoundError(message, requestId);
  }
  if (code === 'content_filter') {
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
