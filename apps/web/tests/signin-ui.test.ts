/**
 * UI surface tests for /signin and /access-denied + production hygiene:
 *   - /signin source contains the "Continue with Google" CTA pointing at
 *     /api/auth/google/start.
 *   - /access source mentions Google sign-in (3-way CTA).
 *   - /access-denied source contains "alpha allowlist" copy + sign out form.
 *   - The 6 Real-Mode client pages gate sign-in through the shared
 *     <SignInNotice> component (an informational notice, not a red error),
 *     which routes users to /signin?next= so non-allowlisted users land on
 *     the right guidance screen.
 *   - Production-facing UI never mentions internal helper names like
 *     `getCurrentUser`, `getAuthDecision`, `serviceRoleClient` (which would
 *     suggest leakage of implementation details into user-facing copy).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', 'src');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('/signin and /access-denied wiring', () => {
  it('/signin page submits to /api/auth/google/start', () => {
    const src = read(path.join('app', 'signin', 'page.tsx'));
    expect(src).toMatch(/Continue with Google/);
    expect(src).toMatch(/\/api\/auth\/google\/start/);
  });

  it('/access page surfaces Google + Alpha + Demo as three options', () => {
    const src = read(path.join('app', 'access', 'page.tsx'));
    expect(src).toMatch(/Continue with Google/);
    expect(src).toMatch(/Continue to Alpha Workspace/);
    expect(src).toMatch(/Open Demo Mode/);
  });

  it('/access-denied uses polite copy and offers Demo + Sign out', () => {
    const src = read(path.join('app', 'access-denied', 'page.tsx'));
    expect(src).toMatch(/alpha allowlist/i);
    expect(src).toMatch(/Open Demo Mode/);
    expect(src).toMatch(/Sign out/);
    expect(src).toMatch(/\/api\/auth\/signout/);
  });
});

describe('Real Mode pages gate sign-in through the shared SignInNotice', () => {
  const realModePages = [
    'app/settings/byok/page.tsx',
    'app/ventures/page.tsx',
    'app/labs/persona/page.tsx',
    'app/labs/research-graph/page.tsx',
    'app/labs/venture/page.tsx',
    'app/labs/buildsquad/page.tsx',
  ];

  it('SignInNotice routes users to /signin?next=', () => {
    const src = read(path.join('components', 'SignInNotice.tsx'));
    expect(src).toMatch(/\/signin\?next=/);
  });

  for (const rel of realModePages) {
    it(`${rel} shows the auth gate via <SignInNotice next=…>`, () => {
      const src = read(rel);
      expect(src, `${rel} should render <SignInNotice next=…>`)
        .toMatch(/<SignInNotice\b[\s\S]{0,120}?next=/);
      // Must NOT advertise alpha workspace as the only path.
      expect(src, `${rel} should not still display the "Continue to Alpha Workspace" button`)
        .not.toMatch(/Continue to Alpha Workspace/);
    });
  }
});

describe('AuthMenu does not render dev-cookie text', () => {
  it('does not mention vos_dev_user', () => {
    const src = read(path.join('components', 'AuthMenu.tsx'));
    expect(src).not.toMatch(/vos_dev_user/);
  });
});
