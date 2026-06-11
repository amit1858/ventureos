/**
 * POST /api/auth/signout
 *
 * Clears the Supabase session cookies. Also clears the alpha access cookie
 * for good measure so the user is fully signed out regardless of which mode
 * they entered through.
 */
import { NextResponse } from 'next/server';

import { ALPHA_ACCESS_COOKIE } from '../../../../lib/auth';
import { serverComponentClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get('next');
  const target =
    typeof nextParam === 'string' && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/';

  try {
    if (
      process.env['NEXT_PUBLIC_SUPABASE_URL'] &&
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
    ) {
      const sb = serverComponentClient();
      await sb.auth.signOut();
    }
  } catch {
    // signOut failures are non-fatal — we still clear the alpha cookie + redirect
  }

  const res = NextResponse.redirect(new URL(target, req.url), 303);
  res.cookies.set({
    name: ALPHA_ACCESS_COOKIE,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
  });
  return res;
}
