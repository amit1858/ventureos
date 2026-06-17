/**
 * POST /api/byok/providers/:id/validate
 *
 * Server-side decrypts the stored credential and runs the provider's
 * validateCredentials path. Returns only safe profile + ok/reason.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../../lib/auth';
import { sanitizeApiError } from '../../../../../../lib/api-errors';
import { getCredentialService } from '../../../../../../lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const res = await getCredentialService().revalidate(user.id, ctx.params.id);
    return NextResponse.json({
      ok: res.ok,
      reason: res.reason,
      profile: res.profile,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    const sanitized = sanitizeApiError(e);
    return NextResponse.json(sanitized.body, { status: sanitized.status });
  }
}
