/**
 * PersonaLab engine capability endpoint (Sprint 1D).
 *
 * Lets the browser decide whether to show a TinyTroupe engine selector. The
 * server only reveals a boolean — never the path of the configured
 * interpreter, never any other host detail.
 */
import { NextResponse } from 'next/server';

import { requireUser, UnauthorizedError } from '../../../../lib/auth';
import { isTinyTroupeBridgeEnabled } from '../../../../lib/tinytroupe-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({
      ok: true,
      engines: {
        builtin: true,
        tinytroupe: isTinyTroupeBridgeEnabled(),
      },
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, reason: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, reason: 'Engine probe failed.' }, { status: 500 });
  }
}
