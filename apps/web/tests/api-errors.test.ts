import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { sanitizeApiError, redactTokenShapes } from '../src/lib/api-errors';

describe('sanitizeApiError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('maps "Missing required environment variable" to 503 server_not_configured', () => {
    const r = sanitizeApiError(new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL'));
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('server_not_configured');
    expect(r.body.reason).toContain('Demo Mode');
  });

  it('does NOT echo the missing env var name in the body', () => {
    const r = sanitizeApiError(new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY'));
    expect(r.body.reason).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns a generic 500 for any other error and never echoes the message', () => {
    const r = sanitizeApiError(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    expect(r.status).toBe(500);
    expect(r.body.reason).toBe('Internal server error. Please try again.');
    expect(r.body.reason).not.toContain('127.0.0.1');
  });

  it('honours fallbackStatus for non-env errors', () => {
    const r = sanitizeApiError(new Error('Bad input'), 400);
    expect(r.status).toBe(400);
  });

  it('maps encryption-key misconfiguration to a structured 503', () => {
    const r = sanitizeApiError(
      new Error('CredentialCrypto: VENTUREOS_CREDENTIAL_ENCRYPTION_KEY must be 32 bytes encoded as hex (64 chars) or base64.'),
    );
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('byok_encryption_not_configured');
    expect(r.body.reason).toContain('VENTUREOS_CREDENTIAL_ENCRYPTION_KEY');
  });

  it('maps missing BYOK tables / schema to a structured 503', () => {
    const r = sanitizeApiError(
      new Error('SupabaseCredentialStore.create: relation "public.provider_credentials" does not exist'),
    );
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('supabase_not_ready');
    expect(r.body.reason).toContain('provider_credentials');
  });

  it('redacts token-shaped substrings before logging to the server', () => {
    sanitizeApiError(new Error('failed with ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123 attached'));
    const logged = String(consoleSpy.mock.calls[0]?.[1] ?? '');
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123');
  });

  it('accepts non-Error throws (string, undefined) without crashing', () => {
    expect(sanitizeApiError('boom').status).toBe(500);
    expect(sanitizeApiError(undefined).status).toBe(500);
    expect(sanitizeApiError(null).status).toBe(500);
  });
});

describe('redactTokenShapes', () => {
  it.each([
    ['ghp_ABCDEFGHIJKLMNOPQRSTUV', /\[redacted\]/],
    ['github_pat_ABCDEFGHIJKLMNOPQRST', /\[redacted\]/],
    ['sk-abcdefghijklmnopqrstuvwx', /\[redacted\]/],
    ['sk-ant-abcdefghijklmnopqrstuvwx', /\[redacted\]/],
    ['AIzaABCDEFGHIJKLMNOPQRSTUVWXYZ12', /\[redacted\]/],
    ['Bearer abcdefghijklmnopqrstuvwxyz0123', /\[redacted\]/],
  ])('redacts %s', (input, expected) => {
    expect(redactTokenShapes(input)).toMatch(expected);
  });

  it('leaves innocuous strings alone', () => {
    expect(redactTokenShapes('Hello, world.')).toBe('Hello, world.');
  });
});
