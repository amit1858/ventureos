/**
 * /api/ventures/[id]/timeline (Sprint 2A.5).
 *
 * GET → { ok, events: VentureTimelineEvent[] }  (chronological order)
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../lib/auth';
import { sanitizeApiError } from '../../../../../lib/api-errors';
import { getVentureService } from '../../../../../lib/ventures';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const events = await getVentureService().listEvents(user.id, params.id);
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 404);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}
