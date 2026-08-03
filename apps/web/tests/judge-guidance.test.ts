/**
 * Product-positioning UI surface tests.
 *
 * The homepage and README lead with Foundry's product story and operating
 * model. The guided demo, /signin and /access read as a product experience:
 * a "Product tour" banner and a lightweight "prefer to look around first?"
 * notice into the seeded demo — with no hackathon/judge framing. The archived
 * submission docs under docs/ keep their original judge path as historical
 * context. All checks are source-level static reads so they stay fast and
 * DOM-free.
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

describe('Homepage leads with product positioning', () => {
  const src = readWeb(path.join('app', 'page.tsx'));

  it('leads with the Foundry positioning line', () => {
    expect(src).toMatch(/Where ideas become execution-ready ventures/);
    expect(src).toMatch(/An AI-native Venture Operating System/);
  });

  it('makes the operating model visible', () => {
    for (const phase of ['Discover', 'Evaluate', 'Govern', 'Learn']) {
      expect(src).toMatch(new RegExp(phase));
    }
  });

  it('exposes a single primary CTA into the guided demo', () => {
    expect(src).toMatch(/See the guided demo/);
    expect(src).toMatch(/\/demo\/faceless-crm/);
  });

  it('does not foreground hackathon judging as the primary story', () => {
    expect(src).not.toMatch(/For judges/);
    expect(src).not.toMatch(/data-testid="judge-guidance"/);
  });
});

describe('Demo walkthrough reads as a product tour', () => {
  const src = readWeb(path.join('components', 'demo', 'Walkthrough.tsx'));

  it('renders a TourBanner above the Demo banner', () => {
    expect(src).toMatch(/<TourBanner \/>/);
    expect(src).toMatch(/function TourBanner\(/);
    expect(src).toMatch(/Recommended walkthrough/);
    expect(src).toMatch(/data-testid="tour-banner"/);
  });

  it('describes the seeded, no-key demo without judge framing', () => {
    expect(src).toMatch(/needs no sign-in/);
    expect(src).toMatch(/Real Mode adds BYOK/);
    expect(src).not.toMatch(/For judges/);
    expect(src).not.toMatch(/Recommended judge path/);
    expect(src).not.toMatch(/data-testid="judge-banner"/);
    expect(src).not.toMatch(/zero-key demo/);
  });
});

describe('/signin offers a product-tour notice into the seeded demo', () => {
  const src = readWeb(path.join('app', 'signin', 'page.tsx'));

  it('contains a DemoNotice component pointing at the demo', () => {
    expect(src).toMatch(/function DemoNotice\(/);
    expect(src).toMatch(/Prefer to look around first\?/);
    expect(src).toMatch(/Open the guided demo/);
    expect(src).toMatch(/href="\/demo\/faceless-crm"/);
    expect(src).toMatch(/data-testid="demo-notice"/);
  });

  it('renders the notice in every signin branch (signed-in, alpha, signed-out)', () => {
    const matches = src.match(/<DemoNotice \/>/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('carries no judge/hackathon framing', () => {
    expect(src).not.toMatch(/For judges/);
    expect(src).not.toMatch(/Open Judge Demo/);
    expect(src).not.toMatch(/reviewing the submission/);
  });
});

describe('/access offers a product-tour notice into the seeded demo', () => {
  const src = readWeb(path.join('app', 'access', 'page.tsx'));

  it('contains a DemoNotice component pointing at the demo', () => {
    expect(src).toMatch(/function DemoNotice\(/);
    expect(src).toMatch(/Prefer to look around first\?/);
    expect(src).toMatch(/Open the guided demo/);
    expect(src).toMatch(/href="\/demo\/faceless-crm"/);
    expect(src).toMatch(/data-testid="demo-notice"/);
  });

  it('renders the notice in every access branch', () => {
    const matches = src.match(/<DemoNotice \/>/g) ?? [];
    expect(matches.length).toBe(5);
  });

  it('carries no judge/hackathon framing', () => {
    expect(src).not.toMatch(/For judges/);
    expect(src).not.toMatch(/Open Judge Demo/);
    expect(src).not.toMatch(/hackathon judging/);
  });
});

describe('README leads with positioning; submission docs retain the historical judge path', () => {
  it('README surfaces the operating model, the live demo and the naming history', () => {
    const src = readRepo('README.md');
    expect(src).toMatch(/## Operating model/i);
    expect(src).toMatch(/ventureos-dun\.vercel\.app\/demo\/faceless-crm/);
    expect(src).toMatch(/originally .*VentureOS/i);
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

describe('Product-tour copy stays polished (no apology, no internals)', () => {
  const surfaces = [
    readWeb(path.join('components', 'demo', 'Walkthrough.tsx')),
    readWeb(path.join('app', 'signin', 'page.tsx')),
    readWeb(path.join('app', 'access', 'page.tsx')),
  ].join('\n');

  it('never makes the product feel unfinished in the tour banners', () => {
    // Narrow the check to the TourBanner / DemoNotice blocks so we only
    // police the product-tour copy itself.
    const tourBlocks = [
      /TourBanner[\s\S]*?\)\s*;\s*\}/,
      /DemoNotice[\s\S]*?\)\s*;\s*\}/,
    ].map((re) => {
      const m = surfaces.match(re);
      return m ? m[0] : '';
    }).join('\n');

    expect(tourBlocks).not.toMatch(/sorry|apologi[sz]e|unfortunately|broken|TODO|FIXME|hack(?!athon)/i);
    // No raw implementation details.
    expect(tourBlocks).not.toMatch(/getCurrentUser|getAuthDecision|serviceRoleClient|VentureJob/);
  });
});
