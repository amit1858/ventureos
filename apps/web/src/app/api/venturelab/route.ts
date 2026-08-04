/**
 * VentureLab analyse endpoint (Sprint 2A.6).
 *
 * Routes through JobOrchestrator. Backward-compatible sync default;
 * `async: true` returns 202 + jobId.
 */
import { NextResponse } from 'next/server';

import type { VentureLabInput } from '@foundry/venturelab';
import { DuplicateActiveJobError } from '@foundry/ventures';

import { requireUser, UnauthorizedError } from '../../../lib/auth';
import { enqueueAndWait, getJobOrchestrator } from '../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

interface PostBody {
  providerCredentialId?: string;
  modelId?: string;
  payload?: VentureLabInput;
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
    if (!payload || !payload.brief || !Array.isArray(payload.personas)) {
      return NextResponse.json(
        { ok: false, reason: 'payload.brief and payload.personas are required.' },
        { status: 400 },
      );
    }
    if (!payload.ventureId || typeof payload.ventureId !== 'string') {
      return NextResponse.json(
        { ok: false, reason: 'payload.ventureId is required.' },
        { status: 400 },
      );
    }

    const jobInput = {
      providerCredentialId: body.providerCredentialId,
      modelId: body.modelId,
      payload,
    };

    if (body.async === true) {
      const activeJob = await getJobOrchestrator().findActiveJob(user.id, payload.ventureId, 'venturelab.recommend');
      if (activeJob) {
        return NextResponse.json(
          { ok: false, reason: 'A recommendation is already running for this venture.', jobId: activeJob.jobId },
          { status: 409 },
        );
      }
      const job = await getJobOrchestrator().enqueue({
        ownerId: user.id,
        ventureId: payload.ventureId,
        jobKind: 'venturelab.recommend',
        input: jobInput,
        credentialId: body.providerCredentialId,
      });
      return NextResponse.json({ ok: true, jobId: job.jobId }, { status: 202 });
    }

    const { job, artifactPayload } = await enqueueAndWait({
      ownerId: user.id,
      ventureId: payload.ventureId,
      jobKind: 'venturelab.recommend',
      jobInput,
      credentialId: body.providerCredentialId,
    });
    if (job.status !== 'succeeded') {
      return NextResponse.json(
        { ok: false, reason: sanitize(job.errorMessage ?? 'VentureLab analyse failed.') },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data: artifactPayload });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    if (e instanceof DuplicateActiveJobError) {
      return NextResponse.json(
        { ok: false, reason: 'A recommendation is already running for this venture.', jobId: e.existingJobId },
        { status: 409 },
      );
    }
    const message = e instanceof Error ? e.message : 'VentureLab call failed.';
    return NextResponse.json({ ok: false, reason: sanitize(message) }, { status: 500 });
  }
}

function sanitize(msg: string): string {
  return msg
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***')
    .slice(0, 500);
}
