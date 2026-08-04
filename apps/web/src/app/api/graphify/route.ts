/**
 * Graphify build endpoint (Sprint 2A.6 — added in the venture-context repair).
 *
 * POST /api/graphify { providerCredentialId, modelId, payload: GraphifyInput, async?: boolean }
 *
 * Routes through the JobOrchestrator so every research-graph build persists to
 * the venture (research_graph artifact + timeline event + readiness) exactly
 * like PersonaLab / VentureLab / BuildSquad. Previously the Research Graph lab
 * POSTed to a graphify endpoint that did not exist, so real research builds
 * 404'd. This closes that gap and keeps the persistence path identical across
 * all four workflows. (Single-segment path mirrors /api/venturelab and
 * /api/buildsquad — and avoids a source directory named `build`, which the
 * repo `.gitignore` excludes as build output.)
 *
 *   - default (async !== true): waits for the job to terminate, returns the
 *     `{ ok, data }` shape the lab UI expects.
 *   - async === true: returns 202 + `{ ok, jobId }`; the caller polls
 *     `/api/jobs/[id]`.
 */
import { NextResponse } from 'next/server';

import type { GraphifyInput } from '@foundry/adapter-graphify';

import { requireUser, UnauthorizedError } from '../../../lib/auth';
import { enqueueAndWait, getJobOrchestrator } from '../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PostBody {
  providerCredentialId?: string;
  modelId?: string;
  payload?: GraphifyInput;
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
    if (!payload || !payload.brief) {
      return NextResponse.json(
        { ok: false, reason: 'payload.brief is required.' },
        { status: 400 },
      );
    }
    if (!payload.ventureId || typeof payload.ventureId !== 'string') {
      return NextResponse.json(
        { ok: false, reason: 'payload.ventureId is required.' },
        { status: 400 },
      );
    }
    const notes = Array.isArray(payload.notes) ? payload.notes : [];
    const hasSources = Array.isArray(payload.sources) && payload.sources.length > 0;
    if (notes.length === 0 && !hasSources) {
      return NextResponse.json(
        { ok: false, reason: 'Provide at least one research note or source.' },
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
        ventureId: payload.ventureId,
        jobKind: 'graphify.build',
        input: jobInput,
        credentialId: body.providerCredentialId,
      });
      return NextResponse.json({ ok: true, jobId: job.jobId }, { status: 202 });
    }

    const { job, artifactPayload } = await enqueueAndWait({
      ownerId: user.id,
      ventureId: payload.ventureId,
      jobKind: 'graphify.build',
      jobInput,
      credentialId: body.providerCredentialId,
    });
    if (job.status !== 'succeeded') {
      return NextResponse.json(
        { ok: false, reason: sanitize(job.errorMessage ?? 'Research graph build failed.') },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data: artifactPayload });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : 'Graphify call failed.';
    return NextResponse.json({ ok: false, reason: sanitize(message) }, { status: 500 });
  }
}

function sanitize(msg: string): string {
  return msg
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, '******')
    .slice(0, 500);
}
