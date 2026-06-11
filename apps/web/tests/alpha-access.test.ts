/**
 * Alpha Access identity resolution.
 *
 * Locks in three rules that the deployed app depends on:
 *   1. The legacy `vos_dev_user` cookie is NEVER honoured in production builds,
 *      so the deployed app cannot leak dev-cookie instructions.
 *   2. Alpha access requires BOTH `VENTUREOS_ALPHA_ACCESS=true` on the server
 *      AND the visitor's `ventureos_alpha_access=1` cookie. Either alone fails.
 *   3. A real Supabase session always outranks the alpha fallback.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

// Stub the supabase server module so importing `auth.ts` doesn't reach into a
// real client at test time.
vi.mock('../src/lib/supabase/server', () => ({
  serverComponentClient: vi.fn(() => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  })),
}));

// Stub `server-only` so the module can be imported from a vitest worker.
vi.mock('server-only', () => ({}));

interface FakeCookieStore {
  cookies: Map<string, string>;
  get(name: string): { value: string } | undefined;
}

let cookieStore: FakeCookieStore;

vi.mock('next/headers', () => ({
  cookies: () => cookieStore,
}));

async function loadAuth() {
  // Re-import each time so the module sees the current process.env snapshot.
  vi.resetModules();
  return await import('../src/lib/auth');
}

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('auth identity resolution', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    cookieStore = {
      cookies: new Map(),
      get(name: string) {
        const v = this.cookies.get(name);
        return v === undefined ? undefined : { value: v };
      },
    };
    // Start each test in a clean prod-like env with Supabase unconfigured and
    // alpha disabled. Tests opt in to the conditions they want to exercise.
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    setEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    setEnv('VENTUREOS_ALPHA_ACCESS', undefined);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns null in production when nothing is configured', async () => {
    const { getCurrentUser } = await loadAuth();
    expect(await getCurrentUser()).toBeNull();
  });

  it('ignores the dev `vos_dev_user` cookie in production builds', async () => {
    cookieStore.cookies.set('vos_dev_user', JSON.stringify({ id: 'u1', email: 'a@b.c' }));
    const { getCurrentUser } = await loadAuth();
    expect(await getCurrentUser()).toBeNull();
  });

  it('honours the dev `vos_dev_user` cookie in non-production builds', async () => {
    setEnv('NODE_ENV', 'development');
    cookieStore.cookies.set('vos_dev_user', JSON.stringify({ id: 'u1', email: 'a@b.c' }));
    const { getCurrentUser } = await loadAuth();
    expect(await getCurrentUser()).toEqual({ id: 'u1', email: 'a@b.c' });
  });

  it('requires BOTH env flag AND alpha cookie — env alone is not enough', async () => {
    setEnv('VENTUREOS_ALPHA_ACCESS', 'true');
    const { getCurrentUser } = await loadAuth();
    expect(await getCurrentUser()).toBeNull();
  });

  it('requires BOTH env flag AND alpha cookie — cookie alone is not enough', async () => {
    cookieStore.cookies.set('ventureos_alpha_access', '1');
    const { getCurrentUser } = await loadAuth();
    expect(await getCurrentUser()).toBeNull();
  });

  it('resolves to alpha-user when env flag AND cookie are both present', async () => {
    setEnv('VENTUREOS_ALPHA_ACCESS', 'true');
    cookieStore.cookies.set('ventureos_alpha_access', '1');
    const { getCurrentUser, ALPHA_USER } = await loadAuth();
    expect(await getCurrentUser()).toEqual(ALPHA_USER);
    expect(ALPHA_USER.id).toBe('alpha-user');
  });

  it('alphaAccessEnabled() reflects only the env flag, not the cookie', async () => {
    setEnv('VENTUREOS_ALPHA_ACCESS', 'true');
    const { alphaAccessEnabled, alphaAccessCookiePresent } = await loadAuth();
    expect(alphaAccessEnabled()).toBe(true);
    expect(alphaAccessCookiePresent()).toBe(false);
    cookieStore.cookies.set('ventureos_alpha_access', '1');
    expect(alphaAccessCookiePresent()).toBe(true);
  });

  it('Supabase session outranks alpha fallback (real user wins)', async () => {
    setEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    setEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    setEnv('VENTUREOS_ALPHA_ACCESS', 'true');
    cookieStore.cookies.set('ventureos_alpha_access', '1');

    // Re-mock the supabase module so it returns a real user this time.
    vi.doMock('../src/lib/supabase/server', () => ({
      serverComponentClient: () => ({
        auth: {
          getUser: async () => ({ data: { user: { id: 'real-id', email: 'real@user.com' } } }),
        },
      }),
    }));
    const { getCurrentUser, ALPHA_USER } = await loadAuth();
    const u = await getCurrentUser();
    expect(u).toEqual({ id: 'real-id', email: 'real@user.com' });
    expect(u?.id).not.toBe(ALPHA_USER.id);
  });

  it('falls back to alpha when Supabase is configured but no session exists', async () => {
    setEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    setEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    setEnv('VENTUREOS_ALPHA_ACCESS', 'true');
    cookieStore.cookies.set('ventureos_alpha_access', '1');

    // Explicitly re-mock so the previous test's "real user" mock doesn't bleed in.
    vi.doMock('../src/lib/supabase/server', () => ({
      serverComponentClient: () => ({
        auth: { getUser: async () => ({ data: { user: null } }) },
      }),
    }));
    const { getCurrentUser, ALPHA_USER } = await loadAuth();
    expect(await getCurrentUser()).toEqual(ALPHA_USER);
  });
});
