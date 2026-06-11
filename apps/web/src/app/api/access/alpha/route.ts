/**
 * POST /api/access/alpha
 *   Sets the `ventureos_alpha_access=1` HttpOnly cookie that lets the visitor
 *   resolve as the shared `alpha-user` identity in Real Mode. Only honoured
 *   when the server has `VENTUREOS_ALPHA_ACCESS=true` — without the env flag
 *   the cookie is a no-op (see `apps/web/src/lib/auth.ts`).
 *
 * DELETE /api/access/alpha
 *   Revokes the cookie. Always allowed.
 */
import { NextResponse } from 'next/server';

import { ALPHA_ACCESS_COOKIE, alphaAccessEnabled } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 30 days. Short-lived enough that a forgotten cookie eventually expires;
// long enough that judges can come back next day without re-clicking.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Browsers can't natively submit DELETE from a form, so we accept
  // POST?revoke=1 from the /access/revoke confirmation page as a revoke action.
  if (url.searchParams.get('revoke') === '1') {
    return clearCookieResponse(url);
  }

  if (!alphaAccessEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          'Alpha workspace is not enabled on this deployment. Try Demo Mode at /demo.',
      },
      { status: 503 },
    );
  }

  // Optional ?next=/path lets the access screen send the user back where they
  // were trying to go. We only honour same-origin paths to avoid open redirects.
  const nextParam = url.searchParams.get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/settings/byok';

  const response = NextResponse.redirect(new URL(safeNext, url.origin), {
    status: 303,
  });
  response.cookies.set(ALPHA_ACCESS_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE(request: Request): Promise<Response> {
  return clearCookieResponse(new URL(request.url));
}

function clearCookieResponse(url: URL): Response {
  const response = NextResponse.redirect(new URL('/access', url.origin), {
    status: 303,
  });
  response.cookies.set(ALPHA_ACCESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
