/**
 * POST /api/byok/providers/:id/default → mark as the user's default provider.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../../lib/auth';
import { getCredentialService } from '../../../../../../lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const res = await getCredentialService().setDefault(user.id, ctx.params.id);
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: res.reason ?? 'Not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: 'Server error.' }, { status: 500 });
  }
}
