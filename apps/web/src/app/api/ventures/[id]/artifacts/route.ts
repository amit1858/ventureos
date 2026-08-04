/**
 * /api/ventures/[id]/artifacts (Sprint 2A.5).
 *
 *   GET → { ok, artifacts: VentureArtifact[] }
 *   GET ?kind=research_graph&latest=1 → { ok, artifact: VentureArtifact | null }
 *   POST → { ok, artifact: VentureArtifact }   body: { artifactKind, summary, payload }
 */
import { NextResponse } from 'next/server';

import type { VentureArtifactKind } from '@foundry/contracts';

import { requireUser, UnauthorizedError } from '../../../../../lib/auth';
import { sanitizeApiError } from '../../../../../lib/api-errors';
import { getVentureService } from '../../../../../lib/ventures';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const KINDS = new Set<VentureArtifactKind>([
  'persona_set',
  'interview_transcript',
  'focus_group_transcript',
  'buying_committee',
  'persona_insights',
  'research_graph',
  'venture_recommendation',
  'buildsquad_pack',
]);

interface AttachBody {
  artifactKind?: VentureArtifactKind;
  summary?: string;
  payload?: unknown;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const kindParam = url.searchParams.get('kind');
    const latest = url.searchParams.get('latest');
    const svc = getVentureService();

    if (kindParam && latest) {
      if (!KINDS.has(kindParam as VentureArtifactKind)) {
        return NextResponse.json({ ok: false, reason: 'unknown kind' }, { status: 400 });
      }
      const list = await svc.listArtifacts(user.id, params.id);
      const filtered = list.filter((a) => a.artifactKind === kindParam);
      const top = filtered.length > 0
        ? filtered.reduce((a, b) => (a.version >= b.version ? a : b))
        : null;
      return NextResponse.json({ ok: true, artifact: top });
    }

    const artifacts = await svc.listArtifacts(user.id, params.id);
    return NextResponse.json({ ok: true, artifacts });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 404);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as AttachBody;
    if (!body.artifactKind || !KINDS.has(body.artifactKind)) {
      return NextResponse.json({ ok: false, reason: 'artifactKind is required.' }, { status: 400 });
    }
    if (!body.summary || typeof body.summary !== 'string') {
      return NextResponse.json({ ok: false, reason: 'summary is required.' }, { status: 400 });
    }
    if (typeof body.payload === 'undefined') {
      return NextResponse.json({ ok: false, reason: 'payload is required.' }, { status: 400 });
    }
    const artifact = await getVentureService().attachArtifact({
      ownerId: user.id,
      ventureId: params.id,
      artifactKind: body.artifactKind,
      summary: body.summary,
      payload: body.payload,
    });
    return NextResponse.json({ ok: true, artifact });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    const sn = sanitizeApiError(e, 400);
    return NextResponse.json(sn.body, { status: sn.status });
  }
}
