/**
 * PersonaLab orchestration endpoint (Sprint 2A.6).
 *
 * Dispatches one of six actions. The five that produce artifacts
 * (generatePersonas / runInterview / runFocusGroup / runBuyingCommittee /
 * extractInsights) route through the JobOrchestrator so every run records
 * observability + persists to venture_jobs. `validatePersonaSet` is a pure
 * local check that never calls a provider — it runs inline.
 *
 * Backward-compatible sync default; `async: true` returns 202 + jobId for
 * the artifact-producing actions.
 *
 * Authentication is required for all actions. The selected provider credential
 * is decrypted server-side only for the duration of the call.
 */
import { NextResponse } from 'next/server';

import type { VentureJobKind } from '@ventureos/contracts';

import { requireUser, UnauthorizedError } from '../../../lib/auth';
import { runPersonaLabAction, type RunPersonaLabInput, type PersonaLabAction, type PersonaLabEngine } from '../../../lib/personalab';
import { enqueueAndWait, getJobOrchestrator } from '../../../lib/jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ACTIONS: ReadonlySet<PersonaLabAction> = new Set([
  'generatePersonas',
  'runInterview',
  'runFocusGroup',
  'runBuyingCommittee',
  'extractInsights',
  'validatePersonaSet',
]);

const ENGINES: ReadonlySet<PersonaLabEngine> = new Set(['builtin', 'tinytroupe']);

const ACTION_TO_JOB_KIND: Record<Exclude<PersonaLabAction, 'validatePersonaSet'>, VentureJobKind> = {
  generatePersonas: 'personalab.generate_personas',
  runInterview: 'personalab.run_interview',
  runFocusGroup: 'personalab.run_focus_group',
  runBuyingCommittee: 'personalab.run_buying_committee',
  extractInsights: 'personalab.extract_insights',
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as Partial<RunPersonaLabInput> & { ventureId?: string; async?: boolean };

    const action = body.action;
    if (!action || !ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, reason: 'Unknown PersonaLab action.' }, { status: 400 });
    }

    if (!body.brief) {
      return NextResponse.json({ ok: false, reason: 'brief is required.' }, { status: 400 });
    }

    const engine: PersonaLabEngine = body.engine && ENGINES.has(body.engine) ? body.engine : 'builtin';

    // validatePersonaSet runs inline; it's pure-local and produces no artifact.
    if (action === 'validatePersonaSet') {
      const result = await runPersonaLabAction({
        userId: user.id,
        providerCredentialId: '',
        modelId: '',
        brief: body.brief,
        action,
        engine,
        ...(body.personas ? { personas: body.personas } : {}),
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: true, data: result.data });
    }

    if (!body.providerCredentialId || !body.modelId) {
      return NextResponse.json(
        { ok: false, reason: 'providerCredentialId and modelId are required for this action.' },
        { status: 400 },
      );
    }
    const ventureId = typeof body.ventureId === 'string' && body.ventureId.length > 0 ? body.ventureId : null;

    // No ventureId → no persistence target; run inline without orchestrator.
    // (Legacy lab UI mode — caller didn't pick a venture to attach to.)
    if (!ventureId) {
      const result = await runPersonaLabAction({
        userId: user.id,
        providerCredentialId: body.providerCredentialId,
        modelId: body.modelId,
        brief: body.brief,
        action,
        engine,
        ...(body.personas ? { personas: body.personas } : {}),
        ...(body.persona ? { persona: body.persona } : {}),
        ...(body.topic ? { topic: body.topic } : {}),
        ...(body.questions ? { questions: body.questions } : {}),
        ...(body.rounds ? { rounds: body.rounds } : {}),
        ...(body.offerSummary ? { offerSummary: body.offerSummary } : {}),
        ...(body.transcripts ? { transcripts: body.transcripts } : {}),
        ...(body.n ? { n: body.n } : {}),
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, reason: sanitize(result.reason) }, { status: 400 });
      }
      return NextResponse.json({ ok: true, data: result.data });
    }

    const jobKind = ACTION_TO_JOB_KIND[action];
    const jobInput = {
      providerCredentialId: body.providerCredentialId,
      modelId: body.modelId,
      action,
      brief: body.brief,
      engine,
      ...(body.personas ? { personas: body.personas } : {}),
      ...(body.persona ? { persona: body.persona } : {}),
      ...(body.topic ? { topic: body.topic } : {}),
      ...(body.questions ? { questions: body.questions } : {}),
      ...(body.rounds ? { rounds: body.rounds } : {}),
      ...(body.offerSummary ? { offerSummary: body.offerSummary } : {}),
      ...(body.transcripts ? { transcripts: body.transcripts } : {}),
      ...(body.n ? { n: body.n } : {}),
    };

    if (body.async === true) {
      const job = await getJobOrchestrator().enqueue({
        ownerId: user.id,
        ventureId,
        jobKind,
        input: jobInput,
        credentialId: body.providerCredentialId,
      });
      return NextResponse.json({ ok: true, jobId: job.jobId }, { status: 202 });
    }

    const { job, artifactPayload } = await enqueueAndWait({
      ownerId: user.id,
      ventureId,
      jobKind,
      jobInput,
      credentialId: body.providerCredentialId,
    });
    if (job.status !== 'succeeded') {
      return NextResponse.json(
        { ok: false, reason: sanitize(job.errorMessage ?? 'PersonaLab job failed.') },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, data: artifactPayload });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : 'PersonaLab call failed.';
    return NextResponse.json({ ok: false, reason: sanitize(message) }, { status: 500 });
  }
}

function sanitize(msg: string): string {
  return msg
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***')
    .slice(0, 500);
}
