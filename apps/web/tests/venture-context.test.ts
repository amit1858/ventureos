import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PersonaLabPersona, Venture } from '@foundry/contracts';
import { researchNotesFrom, ventureBriefFrom } from '../src/lib/venture-context';

/**
 * Guards the venture-context repair: labs derive their brief from the ACTIVE
 * venture (never a demo/sample constant), and no lab page hard-codes the guided
 * demo ("Faceless CRM") brief. See lib/venture-context.ts for the contract.
 */

function makeVenture(partial: Partial<Venture>): Venture {
  return {
    kind: 'Venture',
    ventureId: 'v-1',
    ownerId: 'owner-1',
    title: '',
    description: '',
    problemStatement: '',
    targetMarket: '',
    customerType: '',
    region: '',
    businessSize: '',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('ventureBriefFrom', () => {
  it('folds title + description into businessIdea', () => {
    const brief = ventureBriefFrom(
      makeVenture({ title: 'Acme Analytics', description: 'BI for SMBs' }),
    );
    expect(brief.businessIdea).toBe('Acme Analytics — BI for SMBs');
  });

  it('uses the title alone when there is no description', () => {
    const brief = ventureBriefFrom(makeVenture({ title: 'Acme Analytics' }));
    expect(brief.businessIdea).toBe('Acme Analytics');
  });

  it('passes market/customer/region/size through, trimmed', () => {
    const brief = ventureBriefFrom(
      makeVenture({
        title: 'T',
        targetMarket: '  SMB retail  ',
        customerType: ' Owner-operators ',
        region: ' North America ',
        businessSize: ' 1-50 ',
      }),
    );
    expect(brief.targetMarket).toBe('SMB retail');
    expect(brief.customerType).toBe('Owner-operators');
    expect(brief.region).toBe('North America');
    expect(brief.businessSize).toBe('1-50');
  });

  it('includes the problem statement in additionalContext without duplicating description', () => {
    const brief = ventureBriefFrom(
      makeVenture({
        title: 'T',
        description: 'Same text',
        problemStatement: 'Same text',
      }),
    );
    // description is already folded into businessIdea; dedupe keeps one copy.
    expect(brief.additionalContext).toBe('Same text');
  });

  it('never fabricates demo/sample content', () => {
    const brief = ventureBriefFrom(makeVenture({ title: 'Real Venture' }));
    const blob = JSON.stringify(brief).toLowerCase();
    expect(blob).not.toContain('faceless');
  });
});

describe('researchNotesFrom', () => {
  const brief = {
    businessIdea: 'Acme',
    targetMarket: 'SMB',
    customerType: 'Owners',
    region: 'NA',
    businessSize: '1-50',
    additionalContext: 'Ctx',
  };

  it('derives notes from the brief alone (personas optional)', () => {
    const notes = researchNotesFrom(brief, null);
    expect(notes).toContain('Business idea: Acme');
    expect(notes).toContain('Target market: SMB');
    expect(notes.some((n) => n.includes('faceless'))).toBe(false);
  });

  it('enriches with persona pains/goals when available', () => {
    const persona: PersonaLabPersona = {
      id: 'p1',
      name: 'Dana',
      role: 'Ops lead',
      businessContext: '',
      goals: ['Scale ops'],
      painPoints: ['Manual work'],
      motivations: [],
      objections: [],
      buyingTriggers: [],
      decisionPower: 'high',
      quote: '',
      confidenceScore: 0.5,
      evidenceNotes: [],
    };
    const notes = researchNotesFrom(brief, [persona]);
    expect(notes.some((n) => n.includes('Dana') && n.includes('Manual work'))).toBe(true);
  });

  it('de-duplicates repeated notes', () => {
    const notes = researchNotesFrom(brief, null);
    expect(new Set(notes).size).toBe(notes.length);
  });
});

describe('no demo leak in workflow lab pages', () => {
  const labPages = [
    'persona/page.tsx',
    'research-graph/page.tsx',
    'venture/page.tsx',
    'buildsquad/page.tsx',
  ];
  // Guard against the demo brief leaking into executable code (a hard-coded
  // constant or string literal). Comments that *document* the removal of the
  // demo default are fine, so we scan with comments stripped.
  const forbidden = [/FACELESS/, /v-faceless-crm/, /Faceless CRM/i, /SAMPLE_PERSONAS/];

  const stripComments = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments (incl. JSX {/* ... */})
      .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments (keep '://' in URLs)

  for (const rel of labPages) {
    it(`labs/${rel} contains no hard-coded demo brief`, () => {
      const file = path.join(__dirname, '..', 'src', 'app', 'labs', rel);
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of forbidden) {
        expect(pattern.test(src), `${rel} should not contain ${pattern}`).toBe(false);
      }
    });
  }
});
