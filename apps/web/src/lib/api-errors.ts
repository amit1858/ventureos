/**
 * sanitizeApiError — single place to turn an internal exception into a
 * client-safe JSON body and HTTP status.
 *
 * The previous pattern leaked `e.message` straight to the browser, which:
 *   1. Exposes which env vars are missing on a misconfigured server
 *      ("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY"),
 *   2. Surfaces stack-trace-style strings to end users on transient errors,
 *   3. Risks leaking token-shaped substrings if a provider adapter ever
 *      echoes a header value back through Error.message.
 *
 * The sanitizer detects the well-known "Missing required environment variable"
 * shape thrown by `lib/supabase/server.ts#readEnv` and turns it into a stable
 * server-misconfigured response (HTTP 503) the UI can render gracefully.
 * Anything else becomes a generic "Internal error" with the original message
 * server-logged once via console.error so operators can still diagnose.
 *
 * NOTE: keep this file framework-agnostic (no NextResponse import) so it can
 * be unit-tested without spinning up Next.
 */

export interface SanitizedError {
  status: number;
  body: { ok: false; reason: string; code?: string };
}

/** Token shapes that must never appear in a client-facing message. */
const TOKEN_PATTERNS: RegExp[] = [
  /ghp_[A-Za-z0-9]{16,}/g,
  /github_pat_[A-Za-z0-9_]{16,}/g,
  /sk-(?:ant-)?[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._-]{20,}/g,
  /AIza[A-Za-z0-9_-]{20,}/g,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

/** Strip any token-shaped substring before any string goes to the client. */
export function redactTokenShapes(msg: string): string {
  let out = msg;
  for (const p of TOKEN_PATTERNS) out = out.replace(p, '[redacted]');
  return out;
}

const ENV_MISSING_PREFIX = 'Missing required environment variable:';
const CRYPTO_PREFIX = 'CredentialCrypto:';
const SUPABASE_SETUP_MARKERS = [
  'provider_credentials',
  'audit_events',
  'does not exist',
  'schema cache',
  'PGRST',
];

export function sanitizeApiError(e: unknown, fallbackStatus = 500): SanitizedError {
  const raw = e instanceof Error ? e.message : String(e);

  if (raw.startsWith(ENV_MISSING_PREFIX)) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'server_not_configured',
        reason:
          'Server is not configured for Real Mode. The deployment is missing required environment variables (see docs/setup-local.md). Demo Mode at /demo/faceless-crm works without configuration.',
      },
    };
  }

  if (raw.startsWith(CRYPTO_PREFIX)) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'byok_encryption_not_configured',
        reason:
          'Server BYOK encryption is not configured correctly. Set VENTUREOS_CREDENTIAL_ENCRYPTION_KEY to a 32-byte key encoded as 64-character hex or base64, then redeploy.',
      },
    };
  }

  if (SUPABASE_SETUP_MARKERS.some((m) => raw.includes(m))) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'supabase_not_ready',
        reason:
          'Supabase is not ready for BYOK writes. Verify service-role access and run the required database schema/migrations for provider_credentials and audit_events.',
      },
    };
  }

  // Log the real message once for operators; never echo it to the client.
  if (typeof console !== 'undefined' && console.error) {
    console.error('[api]', redactTokenShapes(raw));
  }

  return {
    status: fallbackStatus,
    body: { ok: false, reason: 'Internal server error. Please try again.' },
  };
}
