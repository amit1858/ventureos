/**
 * Judge guidance UI surface tests.
 *
 * These guarantee that judge-facing call-outs stay visible on the four
 * routes a hackathon judge is likely to land on (homepage, demo, signin,
 * access) and in the two docs they're likely to read (README, hackathon
 * submission write-up). All checks are source-level static reads so they
 * stay fast and don't depend on a rendered DOM.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const WEB_ROOT = path.resolve(__dirname, '..', 'src');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function readWeb(rel: string): string {
  return fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8');
}

function readRepo(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

describe('Homepage shows a judge-facing guidance card', () => {
  const src = readWeb(path.join('app', 'page.tsx'));

  it('renders a labeled judge guidance section', () => {
    expect(src).toMatch(/For judges/);
    expect(src).toMatch(/Start with the zero-key demo/);
    expect(src).toMatch(/data-testid="judge-guidance"/);
  });

  it('primary CTA links to the Faceless CRM demo', () => {
    expect(src).toMatch(/Open Judge Demo/);
    // Two links to /demo/faceless-crm are expected (hero "Try the demo →"
    // and the new judge card primary CTA).
    const matches = src.match(/\/demo\/faceless-crm/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('also exposes GitHub repo and a Real Mode escape link', () => {
    expect(src).toMatch(/View GitHub repo/);
    // Tertiary link routes to /access for sign-in / Alpha Workspace.
    expect(src).toMatch(/Sign in \/ Alpha Workspace for Real Mode/);
    expect(src).toMatch(/href="\/access"/);
  });
});

describe('Demo walkthrough labels itself as the recommended judge path', () => {
  const src = readWeb(path.join('components', 'demo', 'Walkthrough.tsx'));

  it('renders a JudgeBanner above the Demo banner', () => {
    expect(src).toMatch(/JudgeBanner/);
    expect(src).toMatch(/Recommended judge path/);
    expect(src).toMatch(/data-testid="judge-banner"/);
  });

  it('explicitly names zero-key, no sign-in, no provider keys', () => {
    expect(src).toMatch(/zero-key demo/);
    expect(src).toMatch(/does not require/);
    // The Real Mode option is mentioned but not as the primary CTA.
    expect(src).toMatch(/Real Mode supports BYOK/);
  });
});

describe('/signin gives judges an escape hatch to the zero-key demo', () => {
  const src = readWeb(path.join('app', 'signin', 'page.tsx'));

  it('contains a JudgeEscape component pointing at the demo', () => {
    expect(src).toMatch(/JudgeEscape/);
    expect(src).toMatch(/Just reviewing the submission\?/);
    expect(src).toMatch(/Open Judge Demo/);
    expect(src).toMatch(/href="\/demo\/faceless-crm"/);
  });

  it('renders the escape in every signin branch (signed-in, alpha, signed-out)', () => {
    // Three <JudgeEscape /> render sites (one per `return (` branch).
    const matches = src.match(/<JudgeEscape \/>/g) ?? [];
    expect(matches.length).toBe(3);
  });
});

describe('/access gives judges an escape hatch to the zero-key demo', () => {
  const src = readWeb(path.join('app', 'access', 'page.tsx'));

  it('contains a JudgeEscape component pointing at the demo', () => {
    expect(src).toMatch(/JudgeEscape/);
    expect(src).toMatch(/Just reviewing the submission\?/);
    expect(src).toMatch(/Open Judge Demo/);
    expect(src).toMatch(/href="\/demo\/faceless-crm"/);
  });

  it('renders the escape in every access branch', () => {
    // Five branches: real-user, alpha-cookie, alpha-no-cookie, supabase-only, setup-required.
    const matches = src.match(/<JudgeEscape \/>/g) ?? [];
    expect(matches.length).toBe(5);
  });
});

describe('README and submission docs surface the judge path', () => {
  it('README has a "For judges" section with the demo link', () => {
    const src = readRepo('README.md');
    expect(src).toMatch(/## For judges/);
    expect(src).toMatch(/Open Judge Demo/);
    expect(src).toMatch(/ventureos-dun\.vercel\.app\/demo\/faceless-crm/);
    expect(src).toMatch(/no sign-in, no provider key, no GitHub PAT/);
  });

  it('docs/hackathon-submission.md has a Recommended judge path section', () => {
    const src = readRepo(path.join('docs', 'hackathon-submission.md'));
    expect(src).toMatch(/## Recommended judge path/);
    expect(src).toMatch(/ventureos-dun\.vercel\.app\/demo\/faceless-crm/);
  });

  it('docs/hackathon/demo-script.md has a Recommended judge path section', () => {
    const src = readRepo(path.join('docs', 'hackathon', 'demo-script.md'));
    expect(src).toMatch(/## Recommended judge path/);
    expect(src).toMatch(/ventureos-dun\.vercel\.app\/demo\/faceless-crm/);
  });
});

describe('Judge copy stays polished (no apology, no internals)', () => {
  const surfaces = [
    readWeb(path.join('app', 'page.tsx')),
    readWeb(path.join('components', 'demo', 'Walkthrough.tsx')),
    readWeb(path.join('app', 'signin', 'page.tsx')),
    readWeb(path.join('app', 'access', 'page.tsx')),
  ].join('\n');

  it('never makes the product feel unfinished in judge banners', () => {
    // The banner-area copy itself must not apologize. We narrow the
    // check to the JudgeBanner/JudgeEscape/judge guidance blocks.
    const judgeBlocks = [
      /JudgeBanner[\s\S]*?\)\s*;\s*\}/,
      /JudgeEscape[\s\S]*?\)\s*;\s*\}/,
      /data-testid="judge-guidance"[\s\S]*?<\/section>/,
    ].map((re) => {
      const m = surfaces.match(re);
      return m ? m[0] : '';
    }).join('\n');

    expect(judgeBlocks).not.toMatch(/sorry|apologi[sz]e|unfortunately|broken|TODO|FIXME|hack(?!athon)/i);
    // No raw implementation details.
    expect(judgeBlocks).not.toMatch(/getCurrentUser|getAuthDecision|serviceRoleClient|VentureJob/);
  });
});
