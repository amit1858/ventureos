/**
 * POST /api/ventures/[id]/export/github (Sprint 2A.6 / PR4).
 *
 * Enqueues a `github.export` job. Always async — the export hits the
 * external GitHub API and the user gets live job progress via the standard
 * JobProgress component.
 *
 * Body: { providerCredentialId, repoName, org?, description?, private? }
 * Returns: 202 { ok: true, jobId } | 400 { ok: false, reason }
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../../lib/auth';
import { getJobOrchestrator } from '../../../../../../lib/jobs';
import type { GitHubExportInput } from '../../../../../../lib/github-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  providerCredentialId?: string;
  repoName?: string;
  org?: string;
  description?: string;
  private?: boolean;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  let user;
  try { user = await requireUser(); } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: 'Server error.' }, { status: 500 });
  }

  let body: Body;
  try { body = (await request.json()) as Body; }
  catch { return NextResponse.json({ ok: false, reason: 'Invalid JSON body.' }, { status: 400 }); }

  const { providerCredentialId, repoName, org, description } = body;
  if (typeof providerCredentialId !== 'string' || providerCredentialId.length === 0) {
    return NextResponse.json({ ok: false, reason: '`providerCredentialId` is required.' }, { status: 400 });
  }
  if (typeof repoName !== 'string' || repoName.length === 0) {
    return NextResponse.json({ ok: false, reason: '`repoName` is required.' }, { status: 400 });
  }

  const input: GitHubExportInput = {
    providerCredentialId,
    repoName,
    ...(org ? { org } : {}),
    ...(description ? { description } : {}),
    ...(body.private !== undefined ? { private: body.private } : {}),
  };

  const job = await getJobOrchestrator().enqueue({
    ownerId: user.id,
    ventureId: params.id,
    jobKind: 'github.export',
    input,
    credentialId: providerCredentialId,
  });

  return NextResponse.json({ ok: true, jobId: job.jobId }, { status: 202 });
}
