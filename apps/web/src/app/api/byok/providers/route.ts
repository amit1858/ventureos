/**
 * GET  /api/byok/providers          → list current user's safe provider profiles
 * POST /api/byok/providers          → create + validate + encrypt + persist
 *
 * No route ever returns the plaintext secret, the encrypted envelope, or the fingerprint.
 */
import { NextResponse } from 'next/server';
import type { ProviderId } from '@ventureos/contracts';

import { requireUser, UnauthorizedError } from '../../../../lib/auth';
import { getCredentialService } from '../../../../lib/credentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const profiles = await getCredentialService().listProfiles(user.id);
    return NextResponse.json({ profiles });
  } catch (e) {
    return errorResponse(e);
  }
}

interface CreateBody {
  providerType?: ProviderId;
  displayName?: string;
  secret?: string;
  config?: { endpoint?: string; apiVersion?: string };
  setDefault?: boolean;
}

export async function POST(request: Request) {
  let user;
  try { user = await requireUser(); } catch (e) { return errorResponse(e); }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid JSON body.' }, { status: 400 });
  }

  const { providerType, displayName, secret, config, setDefault } = body;
  if (
    typeof providerType !== 'string' ||
    typeof displayName !== 'string' || displayName.length === 0 ||
    typeof secret !== 'string' || secret.length === 0
  ) {
    return NextResponse.json(
      { ok: false, reason: '`providerType`, `displayName`, and `secret` are required.' },
      { status: 400 },
    );
  }

  const result = await getCredentialService().createProvider({
    userId: user.id,
    providerType,
    displayName,
    secret,
    ...(config ? { config } : {}),
    ...(setDefault ? { setDefault } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason ?? 'Create failed.' });
  }
  return NextResponse.json({ ok: true, profile: result.profile });
}

function errorResponse(e: unknown): Response {
  if (e instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, reason: 'Unauthorized.' }, { status: 401 });
  }
  return NextResponse.json({ ok: false, reason: 'Server error.' }, { status: 500 });
}
