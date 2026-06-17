/**
 * POST /api/byok/providers/:id/test-prompt
 *
 * Server-side decrypts the credential, dispatches one chat call, and returns
 * the model output + usage + cost. The plaintext secret never crosses the
 * trust boundary.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../../../lib/auth';
import { sanitizeApiError } from '../../../../../../lib/api-errors';
import { getCredentialService } from '../../../../../../lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  modelId?: string;
  prompt?: string;
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  let user;
  try { user = await requireUser(); }
  catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: 'Server error.' }, { status: 500 });
  }

  let body: Body;
  try { body = (await request.json()) as Body; }
  catch { return NextResponse.json({ ok: false, reason: 'Invalid JSON body.' }, { status: 400 }); }

  const { modelId, prompt } = body;
  if (
    typeof modelId !== 'string' || modelId.length === 0 ||
    typeof prompt !== 'string' || prompt.length === 0
  ) {
    return NextResponse.json(
      { ok: false, reason: '`modelId` and `prompt` are required.' },
      { status: 400 },
    );
  }

  try {
    const res = await getCredentialService().runTestPrompt(user.id, ctx.params.id, { modelId, prompt });
    return NextResponse.json({
      ok: res.ok,
      reason: res.reason,
      content: res.content,
      usage: res.usage,
      costUsd: res.costUsd,
      finishReason: res.finishReason,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
    }
    const sanitized = sanitizeApiError(e);
    return NextResponse.json(sanitized.body, { status: sanitized.status });
  }
}
