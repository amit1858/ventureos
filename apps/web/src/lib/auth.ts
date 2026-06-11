/**
 * Server-side auth resolution.
 *
 * Strategy:
 *   1. If Supabase env vars are present, ask the session-bound server client for
 *      the current user. Returns null if not signed in.
 *   2. Otherwise (local dev / CI), fall back to the `vos_dev_user` cookie carrying
 *      `{ id, email }` JSON. This is ONLY honoured when Supabase env is missing —
 *      it cannot override a real session.
 *
 * The fallback exists so the BYOK flow can be exercised end-to-end in dev/CI
 * without standing up a Supabase project. It is never reachable in production
 * because production env always sets the Supabase variables.
 */
import 'server-only';
import { cookies } from 'next/headers';

import { serverComponentClient } from './supabase/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

const DEV_COOKIE = 'vos_dev_user';

function supabaseConfigured(): boolean {
  return (
    typeof process.env['NEXT_PUBLIC_SUPABASE_URL'] === 'string' &&
    process.env['NEXT_PUBLIC_SUPABASE_URL'].length > 0 &&
    typeof process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] === 'string' &&
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'].length > 0
  );
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (supabaseConfigured()) {
    try {
      const sb = serverComponentClient();
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (!user) return null;
      return { id: user.id, email: user.email ?? `${user.id}@unknown` };
    } catch {
      return null;
    }
  }

  // Dev / CI fallback.
  const raw = cookies().get(DEV_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthenticatedUser>;
    if (typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return { id: parsed.id, email: parsed.email };
    }
  } catch { /* fall through */ }
  return null;
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const u = await getCurrentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}

export class UnauthorizedError extends Error {
  constructor() { super('Unauthorized'); this.name = 'UnauthorizedError'; }
}
