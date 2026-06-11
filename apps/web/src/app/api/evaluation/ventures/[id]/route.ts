/**
 * GET /api/evaluation/ventures/[id] — 501 stub (Sprint 2A.6 / PR4).
 *
 * Will return a `VentureSpendSummary` aggregating job rows for the venture.
 * Stubbed until Sprint 2B — see sibling stub `/api/evaluation/jobs`.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      ok: false,
      reason: 'Not implemented yet — venture spend summary lands in Sprint 2B.',
      shape: 'VentureSpendSummary',
    },
    { status: 501 },
  );
}
