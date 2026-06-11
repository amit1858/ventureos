/**
 * POST /api/jobs/[id]/cancel — cooperative cancellation.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../lib/auth';
import { getJobOrchestrator } from '../../../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const job = await getJobOrchestrator().cancel(user.id, params.id);
    if (!job) return NextResponse.json({ ok: false, reason: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 500 });
  }
}
