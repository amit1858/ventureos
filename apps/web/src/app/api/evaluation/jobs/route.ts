/**
 * GET /api/evaluation/jobs — 501 stub (Sprint 2A.6 / PR4).
 *
 * Locks the surface that the evaluation dashboard will consume in Sprint 2B.
 * The job rows already carry every field this endpoint will aggregate over
 * (`packages/ventures/migrations/0002_jobs.sql`); the aggregation itself is
 * deferred so we can ship the export demo without committing to a dashboard
 * UI in the same sprint.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      ok: false,
      reason: 'Not implemented yet — evaluation aggregation lands in Sprint 2B.',
      shape: 'JobMetricsAggregate',
    },
    { status: 501 },
  );
}
