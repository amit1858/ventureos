/**
 * GET /api/auth/me
 *
 * Tiny no-cache JSON endpoint used by the client-side <AuthMenu> in the
 * navigation bar to render auth-aware UI without forcing every page to opt
 * into dynamic rendering.
 *
 * Returns one of:
 *   { kind: 'user',  user: { id, email }, via: 'supabase' }
 *   { kind: 'alpha', user: { id, email } }
 *   { kind: 'dev-cookie', user: { id, email } }
 *   { kind: 'denied', email }
 *   { kind: 'none' }
 *
 * Also includes `alphaEnabled` so the menu can decide whether to surface the
 * Alpha Workspace badge / link.
 */
import { NextResponse } from 'next/server';

import { alphaAccessEnabled, getAuthDecision } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const decision = await getAuthDecision();
  return NextResponse.json(
    { ...decision, alphaEnabled: alphaAccessEnabled() },
    { headers: { 'cache-control': 'no-store' } },
  );
}
