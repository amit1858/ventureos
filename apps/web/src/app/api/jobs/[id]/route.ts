/**
 * GET /api/jobs/[id] — poll job status.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../lib/auth';
import { getJobStore } from '../../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const job = await getJobStore().getJob(user.id, params.id);
    if (!job) return NextResponse.json({ ok: false, reason: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: (e as Error).message }, { status: 500 });
  }
}
