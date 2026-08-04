/**
 * GET /api/jobs/[id] — poll job status.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../lib/auth';
import { sanitizeApiError } from '../../../../lib/api-errors';
import { getJobOrchestrator } from '../../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    // Reconcile-on-read: an orphaned job (its serverless invocation was killed
    // before it could finalise) is failed here rather than polled forever.
    const job = await getJobOrchestrator().getJobReconciled(user.id, params.id);
    if (!job) return NextResponse.json({ ok: false, reason: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 500);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}
