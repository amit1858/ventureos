/**
 * Google sign-in allowlist + auth decision API.
 *
 * Locks in:
 *   1. Empty/unset `VENTUREOS_ALLOWED_EMAILS` allows any authenticated user.
 *   2. The allowlist is case-insensitive and whitespace-trimmed.
 *   3. Non-allowlisted Supabase users surface as `kind: 'denied'` from
 *      `getAuthDecision()`, with the email available for the access-denied UI.
 *   4. Allowlisted Supabase users surface as `kind: 'user'`.
 *   5. Alpha workspace and dev cookie continue to work, and the allowlist
 *      does NOT apply to them (they have their own opt-in gates).
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

interface FakeCookieStore {
  cookies: Map<string, string>;
  get(name: string): { value: string } | undefined;
}

let cookieStore: FakeCookieStore;

vi.mock('next/headers', () => ({
  cookies: () => cookieStore,
}));

// Default supabase stub returns no user. Individual tests override with vi.doMock.
vi.mock('../src/lib/supabase/server', () => ({
  serverComponentClient: vi.fn(() => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  })),
}));

async function loadAuth() {
  vi.resetModules();
  return await import('../src/lib/auth');
}

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function mockSupabaseUser(user: { id: string; email: string } | null) {
  vi.doMock('../src/lib/supabase/server', () => ({
    serverComponentClient: () => ({
      auth: { getUser: async () => ({ data: { user } }) },
    }),
  }));
}

describe('Google sign-in allowlist', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    cookieStore = {
      cookies: new Map(),
      get(name: string) {
        const v = this.cookies.get(name);
        return v === undefined ? undefined : { value: v };
      },
    };
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    setEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    setEnv('VENTUREOS_ALPHA_ACCESS', undefined);
    setEnv('VENTUREOS_ALLOWED_EMAILS', undefined);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  // ── allowlistEmails parsing ───────────────────────────────────────────────

  it('returns empty set when VENTUREOS_ALLOWED_EMAILS is unset', async () => {
    const { allowlistEmails } = await loadAuth();
    expect(allowlistEmails().size).toBe(0);
  });

  it('returns empty set when VENTUREOS_ALLOWED_EMAILS is whitespace', async () => {
    setEnv('VENTUREOS_ALLOWED_EMAILS', '   ');
    const { allowlistEmails } = await loadAuth();
    expect(allowlistEmails().size).toBe(0);
  });

  it('parses comma-separated list, trims whitespace, lowercases each entry', async () => {
    setEnv('VENTUREOS_ALLOWED_EMAILS', '  Alice@Example.com , bob@x.io ,  ');
    const { allowlistEmails } = await loadAuth();
    const list = allowlistEmails();
    expect(list.size).toBe(2);
    expect(list.has('alice@example.com')).toBe(true);
    expect(list.has('bob@x.io')).toBe(true);
  });

  // ── isEmailAllowed semantics ──────────────────────────────────────────────

  it('isEmailAllowed returns true for any email when no allowlist is set', async () => {
    const { isEmailAllowed } = await loadAuth();
    expect(isEmailAllowed('anyone@anywhere.com')).toBe(true);
  });

  it('isEmailAllowed is case-insensitive and trims whitespace on input', async () => {
    setEnv('VENTUREOS_ALLOWED_EMAILS', 'alice@example.com,bob@x.io');
    const { isEmailAllowed } = await loadAuth();
    expect(isEmailAllowed('Alice@Example.COM')).toBe(true);
    expect(isEmailAllowed('  bob@x.io  ')).toBe(true);
    expect(isEmailAllowed('eve@nope.com')).toBe(false);
  });

  // ── getAuthDecision integration ──────────────────────────────────────────

  it('allowlisted Supabase user → kind: user, with via: supabase', async () => {
    setEnv('VENTUREOS_ALLOWED_EMAILS', 'allowed@x.io');
    mockSupabaseUser({ id: 'real-1', email: 'Allowed@x.io' });
    const { getAuthDecision } = await loadAuth();
    const d = await getAuthDecision();
    expect(d.kind).toBe('user');
    if (d.kind === 'user') {
      expect(d.user).toEqual({ id: 'real-1', email: 'Allowed@x.io' });
      expect(d.via).toBe('supabase');
    }
  });

  it('non-allowlisted Supabase user → kind: denied, exposes email for the UI', async () => {
    setEnv('VENTUREOS_ALLOWED_EMAILS', 'someone-else@x.io');
    mockSupabaseUser({ id: 'real-2', email: 'eve@nope.com' });
    const { getAuthDecision, getCurrentUser } = await loadAuth();
    const d = await getAuthDecision();
    expect(d.kind).toBe('denied');
    if (d.kind === 'denied') {
      expect(d.email).toBe('eve@nope.com');
      expect(d.reason).toBe('not-allowlisted');
    }
    // getCurrentUser must return null for denied so route handlers reject the request.
    expect(await getCurrentUser()).toBeNull();
  });

  it('with no allowlist, any Google user is allowed', async () => {
    mockSupabaseUser({ id: 'real-3', email: 'noone-cares@x.io' });
    const { getAuthDecision } = await loadAuth();
    const d = await getAuthDecision();
    expect(d.kind).toBe('user');
  });

  // ── alpha + dev cookie unaffected by allowlist ───────────────────────────

  it('allowlist does NOT gate alpha workspace (separate opt-in)', async () => {
    setEnv('VENTUREOS_ALLOWED_EMAILS', 'someone-else@x.io');
    setEnv('VENTUREOS_ALPHA_ACCESS', 'true');
    cookieStore.cookies.set('ventureos_alpha_access', '1');
    // No Supabase session, so alpha is consulted.
    mockSupabaseUser(null);
    const { getAuthDecision, ALPHA_USER } = await loadAuth();
    const d = await getAuthDecision();
    expect(d.kind).toBe('alpha');
    if (d.kind === 'alpha') expect(d.user).toEqual(ALPHA_USER);
  });

  it('allowlist does NOT gate dev cookie in non-production', async () => {
    setEnv('NODE_ENV', 'development');
    setEnv('VENTUREOS_ALLOWED_EMAILS', 'someone-else@x.io');
    setEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    setEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    cookieStore.cookies.set('vos_dev_user', JSON.stringify({ id: 'dev-1', email: 'dev@local' }));
    const { getAuthDecision } = await loadAuth();
    const d = await getAuthDecision();
    expect(d.kind).toBe('dev-cookie');
  });

  it('signed out + no fallbacks → kind: none', async () => {
    mockSupabaseUser(null);
    const { getAuthDecision } = await loadAuth();
    const d = await getAuthDecision();
    expect(d.kind).toBe('none');
  });
});
