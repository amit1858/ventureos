/**
 * GET /api/ventures/[id]/export/github/preview
 *
 * Returns the exact ScaffoldFile[] the GitHub export *would* push, with no
 * PAT required. Used by the workspace's Preview Files modal so users see what
 * will be committed before they confirm. Pure read of venture artifacts +
 * deterministic renderer; no network I/O to GitHub.
 *
 * 200 { ok: true, files: [{path, bytes, preview}], totalBytes }
 * 400 { ok: false, reason, reasonCode } — e.g. no BuildSquad pack yet.
 * 401 { ok: false, reason: 'Unauthorized.' }
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../../../lib/auth';
import { previewExportFiles } from '../../../../../../../lib/github-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  let user;
  try { user = await requireUser(); } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: 'Server error.' }, { status: 500 });
  }

  const result = await previewExportFiles({ userId: user.id, ventureId: params.id });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason, reasonCode: result.reasonCode },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { ok: true, files: result.files, totalBytes: result.totalBytes },
    { status: 200 },
  );
}
