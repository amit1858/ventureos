/**
 * BuildSquad artifact-pack endpoint (Sprint 2A.6).
 *
 * POST { providerCredentialId, modelId, payload: BuildSquadInput, async?: boolean }
 *
 * Always routes through the JobOrchestrator so every BuildSquad run gets
 * persisted observability (provider, model, duration, cost, artifact kind).
 *   - default (async !== true): waits for the job to terminate and returns
 *     the original `{ok, data}` shape so existing lab UI keeps working.
 *   - async === true: returns 202 + `{ok, jobId}` and the caller polls
 *     `/api/jobs/[id]`.
 */
import { NextResponse } from 'next/server';

import type { BuildSquadInput } from '@foundry/buildsquad';

import { requireUser, UnauthorizedError } from '../../../lib/auth';
import { enqueueAndWait, getJobOrchestrator } from '../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PostBody {
  providerCredentialId?: string;
  modelId?: string;
  payload?: BuildSquadInput;
  async?: boolean;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as PostBody;

    if (!body.providerCredentialId || !body.modelId) {
      return NextResponse.json(
        { ok: false, reason: 'providerCredentialId and modelId are required.' },
        { status: 400 },
      );
    }
    const payload = body.payload;
    if (!payload?.recommendation) {
      return NextResponse.json(
        { ok: false, reason: 'payload.recommendation is required.' },
        { status: 400 },
      );
    }
    const rec = payload.recommendation;
    if (rec.kind !== 'VentureRecommendation' || !rec.ventureId || !rec.recommendationId || !rec.decision) {
      return NextResponse.json(
        { ok: false, reason: 'payload.recommendation must be a valid VentureRecommendation.' },
        { status: 400 },
      );
    }
    if (rec.decision !== 'PROCEED' && rec.decision !== 'PIVOT' && rec.decision !== 'KILL') {
      return NextResponse.json(
        { ok: false, reason: 'payload.recommendation.decision must be PROCEED, PIVOT, or KILL.' },
        { status: 400 },
      );
    }

    const jobInput = {
      providerCredentialId: body.providerCredentialId,
      modelId: body.modelId,
      payload,
    };

    if (body.async === true) {
      const job = await getJobOrchestrator().enqueue({
        ownerId: user.id,
        ventureId: rec.ventureId,
        jobKind: 'buildsquad.plan',
        input: jobInput,
        credentialId: body.providerCredentialId,
      });
      return NextResponse.json({ ok: true, jobId: job.jobId }, { status: 202 });
    }

    const { job, artifactPayload } = await enqueueAndWait({
      ownerId: user.id,
      ventureId: rec.ventureId,
      jobKind: 'buildsquad.plan',
      jobInput,
      credentialId: body.providerCredentialId,
    });
    if (job.status !== 'succeeded') {
      return NextResponse.json(
        { ok: false, reason: sanitize(job.errorMessage ?? 'BuildSquad job failed.') },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data: artifactPayload });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : 'BuildSquad call failed.';
    return NextResponse.json({ ok: false, reason: sanitize(message) }, { status: 500 });
  }
}

function sanitize(msg: string): string {
  return msg
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***')
    .slice(0, 500);
}
