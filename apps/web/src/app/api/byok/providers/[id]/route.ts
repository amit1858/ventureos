/**
 * DELETE /api/byok/providers/:id  → soft-deletes the credential.
 *
 * Returns 404 (as ok:false) when the id does not belong to the calling user — the
 * tenant-isolation contract treats foreign ids exactly like missing ones.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../lib/auth';
import { sanitizeApiError } from '../../../../../lib/api-errors';
import { getCredentialService } from '../../../../../lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const res = await getCredentialService().deleteProvider(user.id, ctx.params.id);
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: res.reason ?? 'Not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    const sanitized = sanitizeApiError(e);
    return NextResponse.json(sanitized.body, { status: sanitized.status });
  }
}
