/**
 * GET /api/ventures/[id]/jobs — list jobs for a venture.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../lib/auth';
import { sanitizeApiError } from '../../../../../lib/api-errors';
import { getJobStore } from '../../../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') ?? '50');
    const jobs = await getJobStore().listJobs({
      ownerId: user.id,
      ventureId: params.id,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50,
    });
    return NextResponse.json({ ok: true, jobs });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 500);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}
