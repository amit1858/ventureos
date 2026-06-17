export interface ByokMutationResponse {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
}

export const BYOK_INVALID_RESPONSE_REASON =
  'BYOK setup failed because the server returned an invalid response. Check production environment variables and Supabase setup.';

interface ResponseLike {
  text(): Promise<string>;
  status: number;
}

export async function parseJsonBody<T>(response: Pick<ResponseLike, 'text'>): Promise<T | null> {
  const raw = await response.text();
  if (raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function parseByokMutationResponse(
  response: ResponseLike,
  fallbackReason: string,
): Promise<ByokMutationResponse> {
  const parsed = await parseJsonBody<ByokMutationResponse>(response);
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: BYOK_INVALID_RESPONSE_REASON };
  }
  if (typeof parsed.ok !== 'boolean') {
    return { ok: false, reason: BYOK_INVALID_RESPONSE_REASON };
  }
  if (parsed.ok) return parsed;
  return {
    ok: false,
    reason:
      typeof parsed.reason === 'string' && parsed.reason.length > 0
        ? parsed.reason
        : fallbackReason,
  };
}
