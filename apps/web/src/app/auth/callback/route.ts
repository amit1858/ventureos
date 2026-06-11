/**
 * GET /auth/callback
 *
 * OAuth provider returns the user here with a `?code=...`. We exchange the
 * code for a session (which sets the Supabase auth cookies) and redirect to
 * the requested `?next=` Real Mode route, or `/ventures` by default.
 *
 * After the exchange, we check the email against `VENTUREOS_ALLOWED_EMAILS`.
 * Non-allowlisted users are still signed in (Supabase has already issued the
 * session), but they are redirected to `/access-denied` and every Real Mode
 * route surface treats them as denied via `getAuthDecision()`. They can sign
 * out from the denied screen.
 */
import { NextResponse } from 'next/server';

import { isEmailAllowed } from '../../../lib/auth';
import { serverComponentClient } from '../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isSafeNextPath(p: string | null): p is string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');
  const next = isSafeNextPath(nextParam) ? nextParam : '/ventures';

  if (!code) {
    return NextResponse.redirect(new URL('/signin?error=missing_code', req.url), 303);
  }

  if (
    !process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
    !process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  ) {
    return NextResponse.redirect(new URL('/signin?error=auth_not_configured', req.url), 303);
  }

  try {
    const sb = serverComponentClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL('/signin?error=exchange_failed', req.url), 303);
    }
    const { data } = await sb.auth.getUser();
    const email = data.user?.email;
    if (email && !isEmailAllowed(email)) {
      return NextResponse.redirect(new URL('/access-denied', req.url), 303);
    }
    return NextResponse.redirect(new URL(next, req.url), 303);
  } catch {
    return NextResponse.redirect(new URL('/signin?error=callback_error', req.url), 303);
  }
}
