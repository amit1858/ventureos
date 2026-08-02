/**
 * /api/ventures (Sprint 2A.5).
 *
 *   GET  → { ok, ventures: VentureSummary[] }
 *   POST → { ok, venture: Venture }   body: CreateVentureInput (without ownerId)
 */
import { NextResponse } from 'next/server';

import type { VentureStatus } from '@foundry/contracts';

import { requireUser, UnauthorizedError } from '../../../lib/auth';
import { sanitizeApiError } from '../../../lib/api-errors';
import { getVentureService } from '../../../lib/ventures';
import { ensureUserProfile } from '../../../lib/ensure-user-profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CreateBody {
  title?: string;
  description?: string;
  problemStatement?: string;
  targetMarket?: string;
  customerType?: string;
  region?: string;
  businessSize?: string;
  status?: VentureStatus;
}

export async function GET() {
  try {
    const user = await requireUser();
    const svc = getVentureService();
    const ventures = await svc.listVentures({ ownerId: user.id });
    const summaries = await Promise.all(
      ventures.map((v) => svc.getSummary(user.id, v.ventureId)),
    );
    return NextResponse.json({ ok: true, ventures: summaries });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 500);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as CreateBody;
    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json({ ok: false, reason: 'title is required.' }, { status: 400 });
    }
    await ensureUserProfile(user);
    const v = await getVentureService().createVenture({
      ownerId: user.id,
      title: body.title,
      ...(body.description ? { description: body.description } : {}),
      ...(body.problemStatement ? { problemStatement: body.problemStatement } : {}),
      ...(body.targetMarket ? { targetMarket: body.targetMarket } : {}),
      ...(body.customerType ? { customerType: body.customerType } : {}),
      ...(body.region ? { region: body.region } : {}),
      ...(body.businessSize ? { businessSize: body.businessSize } : {}),
      ...(body.status ? { status: body.status } : {}),
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
