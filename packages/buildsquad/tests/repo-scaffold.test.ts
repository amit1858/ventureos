/**
 * renderRepoScaffold tests — GitHub export hardening sprint.
 *
 * Covers:
 *   - the exact file list the brief requires (paths + presence, in order)
 *   - README cross-links every other file (so a re-export never produces a
 *     half-empty repo from a user's POV)
 *   - VISION / RISKS / DEMO_SCRIPT / docs/* contents are derived from inputs
 *   - .gitignore protects .env
 *   - render is deterministic (same input → same bytes)
 *   - no secret leakage: a synthetic PAT pasted into otherwise non-PAT input
 *     fields never appears in any rendered file (the renderer only pulls from
 *     declared, safe fields).
 */
import { describe, expect, it } from 'vitest';
import type {
  BuildSquadArtifactPack,
  BuyingCommitteeTranscript,
  PersonaLabPersona,
  ResearchGraph,
  Venture,
  VentureRecommendation,
} from '@foundry/contracts';

import { renderRepoScaffold } from '../src/render';

const FAKE_PAT = 'ghp_FAKE_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1234';

function venture(): Venture {
  return {
    ventureId: 'v-export',
    ownerId: 'u-1',
    title: 'Faceless CRM for SMB',
    description: 'AI-native CRM for solo operators.',
    status: 'building',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    region: 'global',
    customerType: 'smb',
  } as unknown as Venture;
}

function personas(): PersonaLabPersona[] {
  return [
    {
      id: 'p1',
      name: 'Maya Okafor',
      role: 'Solo operator',
      businessContext: 'Runs a 1-person agency.',
      goals: ['Send 50 client emails/week without copy-pasting.'],
      painPoints: ['Loses context every Monday.'],
      motivations: ['Reclaim 6 hours per week.'],
      objections: ['I will not give an AI my inbox.'],
      buyingTriggers: ['Lost a client to a missed reply.'],
      decisionPower: 'high',
      quote: 'I need this five years ago.',
      confidenceScore: 0.78,
      evidenceNotes: [],
    },
  ];
}

function graph(): ResearchGraph {
  return {
    kind: 'ResearchGraph',
    stats: { nodes: 12, edges: 30, communities: 3, confidence: { high: 4, medium: 6, low: 2 } },
    godNodes: [{ label: 'follow-up cadence', degree: 7, community: 1 }],
    contradictions: ['privacy ↔ inbox-access'],
    surprisingConnections: ['inbox-access linked to churn.'],
  };
}

function recommendation(): VentureRecommendation {
  return {
    kind: 'VentureRecommendation',
    recommendationId: 'rec-1',
    ventureId: 'v-export',
    createdAt: '2026-06-01T00:01:00.000Z',
    decision: 'PROCEED',
    overallScore: 74,
    confidenceScore: 0.72,
    executiveSummary: 'Strong pain, weak wedge.',
    scores: [
      {
        dimension: 'problemStrength',
        score: 82,
        higherIsBetter: true,
        explanation: 'Repeated complaints.',
        supportingEvidence: [],
        opposingEvidence: [],
      },
    ],
    evidence: [{ kind: 'note', source: 'interview-1', quote: 'Drowning in replies.', weight: 0.7 }],
    counterSignals: [],
    assumptions: [
      {
        id: 'a1',
        text: 'Solos pay $30+/mo.',
        type: 'risky',
        confidence: 'medium',
        evidence: [],
        riskLevel: 'high',
        validationStrategy: 'smoke test',
      },
    ],
    risks: [
      { id: 'r1', risk: 'Inbox-access fear', impact: 'high', likelihood: 'medium', mitigation: 'Ship read-only mode.' },
    ],
    nextSteps: [
      {
        id: 's1',
        title: 'Run a pricing test.',
        category: 'pricing_test',
        priority: 1,
        rationale: 'Validate willingness.',
        effort: 'medium',
        blocksDecision: true,
      },
    ],
    decisionRationale: ['Pain is concrete.', 'Differentiation needs sharpening.'],
  };
}

function committee(): BuyingCommitteeTranscript {
  return {
    offerSummary: 'AI inbox copilot for solos.',
    members: [],
    decision: 'pilot',
    decisionRationale: 'Pilot with 10 solos.',
    nextSteps: ['Sign 10 design-partner letters.'],
  };
}

function pack(): BuildSquadArtifactPack {
  return {
    kind: 'BuildSquadArtifactPack',
    artifactId: 'pack-1',
    ventureId: 'v-export',
    createdAt: '2026-06-01T00:02:00.000Z',
    mode: 'proceed',
    inputReferences: { ventureId: 'v-export', recommendationId: 'rec-1' },
    productVision: {
      problem: 'Solos drown in client replies.',
      targetUsers: ['Solo operators'],
      productPromise: 'Reply twice as fast without losing voice.',
      whyNow: 'LLMs are good enough.',
      differentiation: ['Inbox-first', 'Read-only default'],
      successMetrics: ['Replies/week +50%', 'NPS ≥ 40'],
    },
    prd: {
      overview: 'AI-drafted replies in a side panel.',
      goals: ['Cut reply time in half.'],
      nonGoals: ['Replace human judgement.'],
      personas: [{ id: 'p1', name: 'Maya', summary: 'Solo operator.' }],
      requirements: [{ id: 'R1', text: 'Draft a reply.', type: 'functional' }],
      userJourneys: [{ id: 'j1', title: 'First draft', steps: ['Open thread', 'Click draft'] }],
      metrics: ['Reply latency'],
      risks: ['Hallucinated tone'],
    },
    mvpScope: { mustHave: ['Draft'], shouldHave: ['Tone'], later: ['Mobile'], explicitCuts: [] },
    userStories: [
      {
        id: 'US1',
        title: 'Draft a reply',
        story: 'As a solo I want a draft so that I can reply faster.',
        acceptanceCriteria: ['Draft visible in <2s'],
        priority: 'must',
      },
    ],
    architectureBrief: {
      components: [{ name: 'Side panel', responsibility: 'Render drafts.' }],
      dataFlow: ['Inbox → LLM → panel'],
      integrations: ['Gmail OAuth'],
      storage: ['No PII'],
      security: ['Read-only by default'],
      scalabilityAssumptions: ['<1k DAU at launch'],
    },
    roadmap: {
      weeks: [
        { week: 1, theme: 'Spike', deliverables: ['OAuth'] },
        { week: 2, theme: 'Draft', deliverables: ['LLM call'] },
        { week: 3, theme: 'UX', deliverables: ['Panel'] },
        { week: 4, theme: 'Beta', deliverables: ['Telemetry'] },
      ],
      futureBacklog: ['Mobile'],
    },
    prototypeBrief: {
      pages: [{ name: 'Side panel', purpose: 'Drafts' }],
      flows: [{ name: 'Draft flow', steps: ['Open', 'Click'] }],
      uiComponents: ['Button', 'List'],
      demoScenario: 'Open Gmail and draft a reply.',
    },
    agentCritiques: [
      { role: 'pm', targetSection: 'mvp_scope', severity: 'warning', comment: 'Tone is must-have, not should.' },
    ],
    rationale: ['Pack drafted from PROCEED recommendation.'],
  };
}

const REQUIRED_PATHS = [
  'README.md',
  'PRD.md',
  'ARCHITECTURE.md',
  'ROADMAP.md',
  'USER_STORIES.md',
  'VISION.md',
  'RISKS.md',
  'EVALUATION_REPORT.md',
  'DEMO_SCRIPT.md',
  'docs/personas.md',
  'docs/research-graph.md',
  'docs/validation.md',
  'docs/build-plan.md',
  '.gitignore',
] as const;

function build(): ReturnType<typeof renderRepoScaffold> {
  return renderRepoScaffold({
    venture: venture(),
    pack: pack(),
    recommendation: recommendation(),
    personas: personas(),
    graph: graph(),
    committee: committee(),
    evaluationMarkdown: '# Evaluation report — Faceless CRM for SMB\n\n_synthesised in test_\n',
  });
}

describe('renderRepoScaffold', () => {
  it('emits every required file path, no duplicates', () => {
    const files = build();
    const paths = files.map((f) => f.path);
    for (const p of REQUIRED_PATHS) {
      expect(paths, `missing ${p}`).toContain(p);
    }
    expect(new Set(paths).size, 'duplicate paths').toBe(paths.length);
  });

  it('README cross-links every other file', () => {
    const readme = build().find((f) => f.path === 'README.md')!;
    for (const p of REQUIRED_PATHS) {
      if (p === 'README.md' || p === '.gitignore') continue;
      expect(readme.content, `README missing link to ${p}`).toContain(`./${p}`);
    }
  });

  it('VISION.md mirrors productVision fields', () => {
    const vision = build().find((f) => f.path === 'VISION.md')!;
    expect(vision.content).toContain('Reply twice as fast without losing voice.');
    expect(vision.content).toContain('Solos drown in client replies.');
    expect(vision.content).toContain('Inbox-first');
    expect(vision.content).toContain('Replies/week +50%');
  });

  it('RISKS.md folds recommendation risks + contradictions + critiques', () => {
    const risks = build().find((f) => f.path === 'RISKS.md')!;
    expect(risks.content).toContain('Inbox-access fear');
    expect(risks.content).toContain('privacy ↔ inbox-access');
    expect(risks.content).toContain('mvp_scope');
  });

  it('DEMO_SCRIPT.md references personas, must-have stories, and decision', () => {
    const demo = build().find((f) => f.path === 'DEMO_SCRIPT.md')!;
    expect(demo.content).toContain('Maya Okafor');
    expect(demo.content).toContain('US1');
    expect(demo.content).toContain('PROCEED');
  });

  it('docs/personas.md, docs/research-graph.md, docs/validation.md, docs/build-plan.md are populated', () => {
    const files = build();
    const personasDoc = files.find((f) => f.path === 'docs/personas.md')!;
    const graphDoc = files.find((f) => f.path === 'docs/research-graph.md')!;
    const validationDoc = files.find((f) => f.path === 'docs/validation.md')!;
    const buildPlanDoc = files.find((f) => f.path === 'docs/build-plan.md')!;
    expect(personasDoc.content).toContain('Maya Okafor');
    expect(graphDoc.content).toContain('follow-up cadence');
    expect(validationDoc.content).toContain('PROCEED');
    expect(validationDoc.content).toContain('a1'); // assumption id visible in validation doc
    expect(buildPlanDoc.content).toContain('Side panel');
  });

  it('.gitignore protects .env and common build outputs', () => {
    const gi = build().find((f) => f.path === '.gitignore')!;
    expect(gi.content).toMatch(/^\.env$/m);
    expect(gi.content).toMatch(/^node_modules\/$/m);
    expect(gi.content).toMatch(/^dist\/$/m);
  });

  it('is deterministic — same input emits identical bytes', () => {
    const a = build();
    const b = build();
    expect(a.map((f) => `${f.path}::${f.content}`)).toEqual(
      b.map((f) => `${f.path}::${f.content}`),
    );
  });

  it('does not leak a PAT pasted into a non-PAT input field', () => {
    // The renderer only reads declared, safe fields. Putting a PAT into an
    // extra/unused property must not surface anywhere in the output.
    const tainted = personas();
    (tainted[0] as unknown as Record<string, unknown>).secret = FAKE_PAT;
    const files = renderRepoScaffold({
      venture: venture(),
      pack: pack(),
      recommendation: recommendation(),
      personas: tainted,
      graph: graph(),
      committee: committee(),
      evaluationMarkdown: '# Evaluation report\n',
    });
    for (const f of files) {
      expect(f.content, `${f.path} leaked PAT`).not.toContain(FAKE_PAT);
      expect(f.content, `${f.path} leaked partial PAT prefix`).not.toContain('ghp_FAKE');
    }
  });

  it('still emits the full path list when optional inputs are null', () => {
    const files = renderRepoScaffold({
      venture: venture(),
      pack: pack(),
      recommendation: null,
      personas: null,
      graph: null,
      committee: null,
      evaluationMarkdown: '# Evaluation report\n_not produced_\n',
    });
    const paths = files.map((f) => f.path);
    for (const p of REQUIRED_PATHS) {
      expect(paths).toContain(p);
    }
    const personasDoc = files.find((f) => f.path === 'docs/personas.md')!;
    expect(personasDoc.content).toContain('_No persona set attached');
  });
});
