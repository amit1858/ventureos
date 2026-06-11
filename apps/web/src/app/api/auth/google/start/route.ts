/**
 * POST /api/auth/google/start
 *
 * Initiates Supabase Google OAuth from the server. Reads the desired
 * post-sign-in destination from `?next=`, asks Supabase for the provider
 * authorization URL with `skipBrowserRedirect: true`, then 303-redirects the
 * browser there. The provider returns the user to `/auth/callback?code=...`.
 *
 * No credentials are written to the response. Cookies for the OAuth code
 * exchange are managed by the Supabase server client through next/headers.
 */
import { NextResponse } from 'next/server';

import { serverComponentClient } from '../../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isSafeNextPath(p: string | null): p is string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//');
}

function originFromRequest(req: Request): string {
  const url = new URL(req.url);
  const xfProto = req.headers.get('x-forwarded-proto');
  if (xfProto) url.protocol = `${xfProto}:`;
  const xfHost = req.headers.get('x-forwarded-host');
  if (xfHost) url.host = xfHost;
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const nextParam = url.searchParams.get('next');
  const next = isSafeNextPath(nextParam) ? nextParam : '/ventures';

  if (
    !process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
    !process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  ) {
    return NextResponse.json(
      { error: 'auth_not_configured', message: 'Supabase Auth is not configured on this deployment.' },
      { status: 503 },
    );
  }

  const origin = originFromRequest(req);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  try {
    const sb = serverComponentClient();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      return NextResponse.json(
        { error: 'oauth_init_failed', message: 'Could not start Google sign-in.' },
        { status: 500 },
      );
    }
    return NextResponse.redirect(data.url, 303);
  } catch {
    return NextResponse.json(
      { error: 'oauth_init_failed', message: 'Could not start Google sign-in.' },
      { status: 500 },
    );
  }
}
