/**
 * Server-side identity resolution.
 *
 * Resolution order (first match wins):
 *   1. If Supabase env is present, ask the session-bound server client for the
 *      real signed-in user. A real session always outranks every fallback.
 *      If `VENTUREOS_ALLOWED_EMAILS` is set, the resolver still treats the
 *      session as present but `getAuthDecision()` reports `kind: 'denied'`
 *      so callers can render the access-denied screen.
 *   2. If VENTUREOS_ALPHA_ACCESS=true is set on the server AND the visitor has
 *      explicitly opted in by visiting `/access` (which sets the
 *      `ventureos_alpha_access` HttpOnly cookie), resolve as the shared
 *      `alpha-user` identity. This is the deployed-hackathon Real Mode path.
 *   3. In non-production builds only, fall back to the legacy `vos_dev_user`
 *      JSON cookie used by local dev and CI. This path is hard-disabled in
 *      production so the deployed app never reveals dev-cookie instructions.
 *   4. Otherwise → null (caller renders the polished "Real Mode requires
 *      sign-in" guidance or redirects to `/signin` / `/access`).
 */
import 'server-only';
import { cookies } from 'next/headers';

import { serverComponentClient } from './supabase/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Discriminated union returned by `getAuthDecision()` for callers that need
 * to distinguish "no session" from "session but not allowlisted".
 */
export type AuthDecision =
  | { kind: 'user'; user: AuthenticatedUser; via: 'supabase' }
  | { kind: 'alpha'; user: AuthenticatedUser }
  | { kind: 'dev-cookie'; user: AuthenticatedUser }
  | { kind: 'denied'; email: string; reason: 'not-allowlisted' }
  | { kind: 'none' };

// Legacy dev cookie. Honoured only when NODE_ENV !== 'production'.
const DEV_COOKIE = 'vos_dev_user';

// Hackathon-alpha cookie set by POST /api/access/alpha.
export const ALPHA_ACCESS_COOKIE = 'ventureos_alpha_access';

// Stable workspace identity used by Alpha Access. Isolated and clearly named so
// that if real multi-user auth is added later, alpha sessions can't masquerade
// as real users.
export const ALPHA_USER: AuthenticatedUser = {
  id: 'alpha-user',
  email: 'alpha@ventureos.local',
};

function supabaseConfigured(): boolean {
  return (
    typeof process.env['NEXT_PUBLIC_SUPABASE_URL'] === 'string' &&
    process.env['NEXT_PUBLIC_SUPABASE_URL'].length > 0 &&
    typeof process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] === 'string' &&
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'].length > 0
  );
}

/**
 * True when the operator has enabled the temporary alpha workspace by setting
 * `VENTUREOS_ALPHA_ACCESS=true` on the server. Required for the alpha cookie
 * to be honoured — opting in client-side alone is not sufficient.
 */
export function alphaAccessEnabled(): boolean {
  return process.env['VENTUREOS_ALPHA_ACCESS'] === 'true';
}

function isProduction(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

/**
 * True when the visitor has clicked "Continue to Alpha Workspace" on `/access`.
 * Note: this does NOT check the env flag — combine with `alphaAccessEnabled()`
 * to decide whether the cookie should actually grant access.
 */
export function alphaAccessCookiePresent(): boolean {
  return cookies().get(ALPHA_ACCESS_COOKIE)?.value === '1';
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const d = await getAuthDecision();
  if (d.kind === 'user' || d.kind === 'alpha' || d.kind === 'dev-cookie') return d.user;
  return null;
}

/**
 * Full identity decision. Use this for route protection where the caller
 * needs to distinguish "no session" (→ /signin) from "signed in but not
 * allowlisted" (→ /access-denied).
 */
export async function getAuthDecision(): Promise<AuthDecision> {
  // 1. Real Supabase session always wins.
  if (supabaseConfigured()) {
    try {
      const sb = serverComponentClient();
      const { data } = await sb.auth.getUser();
      const user = data.user;
      if (user) {
        const email = user.email ?? `${user.id}@unknown`;
        if (!isEmailAllowed(email)) {
          return { kind: 'denied', email, reason: 'not-allowlisted' };
        }
        return { kind: 'user', user: { id: user.id, email }, via: 'supabase' };
      }
    } catch {
      // fall through to alpha / dev fallbacks
    }
  }

  // 2. Alpha workspace — opt-in via env + explicit user action on /access.
  if (alphaAccessEnabled() && alphaAccessCookiePresent()) {
    return { kind: 'alpha', user: ALPHA_USER };
  }

  // 3. Dev cookie — local dev / CI only. Never honoured in production builds,
  //    even if a stray cookie is present, so the deployed app cannot leak
  //    developer-cookie instructions.
  if (!isProduction()) {
    const raw = cookies().get(DEV_COOKIE)?.value;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AuthenticatedUser>;
        if (typeof parsed.id === 'string' && typeof parsed.email === 'string') {
          return { kind: 'dev-cookie', user: { id: parsed.id, email: parsed.email } };
        }
      } catch { /* fall through */ }
    }
  }

  return { kind: 'none' };
}

/**
 * Parse `VENTUREOS_ALLOWED_EMAILS` into a normalised set of lowercase emails.
 * Empty / unset → empty set, which the caller interprets as "allow any
 * authenticated user".
 */
export function allowlistEmails(): Set<string> {
  const raw = process.env['VENTUREOS_ALLOWED_EMAILS'];
  if (typeof raw !== 'string' || raw.trim().length === 0) return new Set();
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/**
 * True if the email is on the allowlist, or if no allowlist is configured.
 * Case-insensitive, whitespace-trimmed.
 */
export function isEmailAllowed(email: string): boolean {
  const list = allowlistEmails();
  if (list.size === 0) return true;
  return list.has(email.trim().toLowerCase());
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const u = await getCurrentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}

export class UnauthorizedError extends Error {
  constructor() { super('Unauthorized'); this.name = 'UnauthorizedError'; }
}
