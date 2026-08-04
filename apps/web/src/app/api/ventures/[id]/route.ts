/**
 * /api/ventures/[id] (Sprint 2A.5).
 *
 *   GET    → { ok, summary: VentureSummary }
 *   PATCH  → { ok, venture: Venture }   body: { patch: Partial<Venture> }
 *   DELETE → { ok, venture: Venture }   (archive — never hard-delete)
 */
import { NextResponse } from 'next/server';

import type { Venture } from '@foundry/contracts';

import { requireUser, UnauthorizedError } from '../../../../lib/auth';
import { sanitizeApiError } from '../../../../lib/api-errors';
import { getVentureService } from '../../../../lib/ventures';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PatchBody {
  patch?: Partial<Omit<Venture, 'kind' | 'ventureId' | 'ownerId' | 'createdAt' | 'updatedAt'>>;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const summary = await getVentureService().getSummary(user.id, params.id);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 404);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as PatchBody;
    if (!body.patch || typeof body.patch !== 'object') {
      return NextResponse.json({ ok: false, reason: 'patch is required.' }, { status: 400 });
    }
    const v = await getVentureService().updateVenture({
      ownerId: user.id,
      ventureId: params.id,
      patch: body.patch,
    });
    return NextResponse.json({ ok: true, venture: v });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 400);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const v = await getVentureService().archiveVenture(user.id, params.id);
    return NextResponse.json({ ok: true, venture: v });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 400);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}
