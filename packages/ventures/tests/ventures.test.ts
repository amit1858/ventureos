import { describe, expect, it } from 'vitest';

import type {
  BuildSquadArtifactPack,
  PersonaLabPersona,
  ResearchGraph,
  VentureRecommendation,
} from '@ventureos/contracts';

import {
  InMemoryVentureStore,
  VentureNotFoundError,
  VentureService,
  calculateVentureProgress,
  calculateVentureReadiness,
} from '../src/index.js';

const OWNER_A = 'user_a';
const OWNER_B = 'user_b';

function svc() {
  let n = 0;
  const store = new InMemoryVentureStore();
  return new VentureService(store, {
    now: () => new Date('2026-06-01T00:00:00.000Z'),
    generateId: (prefix) => {
      n += 1;
      return `${prefix}_${n.toString().padStart(3, '0')}`;
    },
  });
}

function persona(id: string): PersonaLabPersona {
  return {
    id,
    name: id,
    role: 'Solo consultant',
    businessContext: 'Independent.',
    goals: ['ship'],
    painPoints: ['admin time'],
    motivations: ['flow'],
    objections: [],
    buyingTriggers: ['lost a deal'],
    decisionPower: 'high',
    quote: 'just tell me what to say next',
    confidenceScore: 0.8,
    evidenceNotes: [],
  } as PersonaLabPersona;
}

function recommendation(decision: 'PROCEED' | 'PIVOT' | 'KILL'): VentureRecommendation {
  return {
    kind: 'VentureRecommendation',
    recommendationId: 'rec_001',
    ventureId: 'ven_001',
    createdAt: '2026-06-01T00:00:00.000Z',
    decision,
    overallScore: decision === 'PROCEED' ? 78 : decision === 'PIVOT' ? 55 : 30,
    confidenceScore: 0.8,
    executiveSummary: 'sum',
    scores: [],
    evidence: [],
    counterSignals: [],
    assumptions: [],
    risks: [
      { id: 'r1', risk: 'Adoption', impact: 'high', likelihood: 'medium', mitigation: 'pilot' },
      { id: 'r2', risk: 'BYOK trust', impact: 'high', likelihood: 'medium', mitigation: 'docs' },
      { id: 'r3', risk: 'Pricing', impact: 'medium', likelihood: 'medium', mitigation: 'A/B test' },
    ],
    nextSteps: [],
    decisionRationale: ['three valid evidence items support proceed.'],
  } as VentureRecommendation;
}

function graph(): ResearchGraph {
  return {
    kind: 'ResearchGraph',
    graphId: 'g_001',
    ventureId: 'ven_001',
    createdAt: '2026-06-01T00:00:00.000Z',
    nodes: Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`,
      label: `n${i}`,
      type: 'problem',
      confidence: 0.7,
      community: 0,
      degree: 3,
      evidence: [],
    })),
    edges: [],
    sources: [],
    godNodes: [
      { id: 'n0', label: 'pipeline hygiene erodes', community: 0, degree: 5 },
      { id: 'n1', label: 'manual data entry', community: 0, degree: 4 },
      { id: 'n2', label: 'whatsapp follow-ups', community: 1, degree: 4 },
    ],
    contradictions: ['Users say they want pipeline but abandon stages.'],
    stats: { nodes: 12, edges: 14, communities: 2, confidence: { EXTRACTED: 8, INFERRED: 4 } },
  } as unknown as ResearchGraph;
}

function pack(mode: 'proceed' | 'pivot' | 'kill'): BuildSquadArtifactPack {
  const base: BuildSquadArtifactPack = {
    kind: 'BuildSquadArtifactPack',
    artifactId: 'bsq_001',
    ventureId: 'ven_001',
    createdAt: '2026-06-01T00:00:00.000Z',
    mode,
    inputReferences: { ventureId: 'ven_001', recommendationId: 'rec_001' },
    productVision: {
      problem: 'p', targetUsers: ['solo'], productPromise: 'pp', whyNow: 'w', differentiation: ['d'], successMetrics: ['m'],
    },
    agentCritiques: [
      { role: 'pm', targetSection: 'mvp_scope', severity: 'info', comment: 'ok' },
      { role: 'ux', targetSection: 'user_stories', severity: 'info', comment: 'ok' },
      { role: 'qa', targetSection: 'user_stories', severity: 'warning', comment: 'add AC' },
    ],
    rationale: ['ok'],
  };
  if (mode === 'proceed') {
    base.prd = { overview: 'o', goals: ['g'], nonGoals: [], personas: [], requirements: [], userJourneys: [], metrics: [], risks: [] };
    base.mvpScope = { mustHave: ['a'], shouldHave: [], later: [], explicitCuts: [{ item: 'x', reason: 'y' }] };
    base.userStories = [
      { id: 's1', title: 's1', story: 'as a user…', acceptanceCriteria: ['ac1', 'ac2'], priority: 'must' },
      { id: 's2', title: 's2', story: 'as a user…', acceptanceCriteria: ['ac1', 'ac2'], priority: 'must' },
      { id: 's3', title: 's3', story: 'as a user…', acceptanceCriteria: ['ac1', 'ac2'], priority: 'must' },
    ];
    base.architectureBrief = {
      components: [
        { name: 'web', responsibility: 'ui' },
        { name: 'api', responsibility: 'svc' },
        { name: 'db', responsibility: 'data' },
      ],
      dataFlow: ['x'], integrations: ['gmail'], storage: ['pg'], security: ['byok'], scalabilityAssumptions: ['10 rps'],
    };
    base.roadmap = { weeks: [
      { week: 1, theme: 'connect', deliverables: ['a'] },
      { week: 2, theme: 'nudge', deliverables: ['a'] },
      { week: 3, theme: 'draft', deliverables: ['a'] },
      { week: 4, theme: 'polish', deliverables: ['a'] },
    ] } as BuildSquadArtifactPack['roadmap'];
    base.prototypeBrief = { pages: ['inbox'], flows: ['reply'], uiComponents: ['button'], demoScenario: 'd' } as BuildSquadArtifactPack['prototypeBrief'];
  }
  return base;
}

describe('VentureService — lifecycle', () => {
  it('creates a venture, lists it, and emits a venture_created event', async () => {
    const s = svc();
    const v = await s.createVenture({
      ownerId: OWNER_A,
      title: 'Faceless CRM',
      description: 'AI-first CRM for solo operators',
    });
    expect(v.ventureId).toMatch(/^ven_/);
    expect(v.status).toBe('draft');
    expect(v.ownerId).toBe(OWNER_A);

    const list = await s.listVentures({ ownerId: OWNER_A });
    expect(list).toHaveLength(1);

    const events = await s.listEvents(OWNER_A, v.ventureId);
    expect(events).toHaveLength(1);
    expect(events[0]!.eventKind).toBe('venture_created');
  });

  it('rejects empty titles', async () => {
    const s = svc();
    await expect(
      s.createVenture({ ownerId: OWNER_A, title: '   ' }),
    ).rejects.toThrow(/title is required/i);
  });

  it('updates status and emits an event', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'X' });
    const next = await s.updateVenture({
      ownerId: OWNER_A,
      ventureId: v.ventureId,
      patch: { status: 'researching' },
    });
    expect(next.status).toBe('researching');
    expect(next.createdAt).toBe(v.createdAt);
    const events = await s.listEvents(OWNER_A, v.ventureId);
    expect(events[events.length - 1]!.eventKind).toBe('venture_updated');
  });

  it('archives a venture', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'X' });
    const archived = await s.archiveVenture(OWNER_A, v.ventureId);
    expect(archived.status).toBe('archived');
    const events = await s.listEvents(OWNER_A, v.ventureId);
    expect(events[events.length - 1]!.eventKind).toBe('venture_archived');
  });
});

describe('VentureService — tenant isolation', () => {
  it('hides ventures from other owners', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'Secret' });
    expect(await s.listVentures({ ownerId: OWNER_B })).toEqual([]);
    await expect(s.getVenture(OWNER_B, v.ventureId)).rejects.toBeInstanceOf(VentureNotFoundError);
    await expect(
      s.attachArtifact({
        ownerId: OWNER_B,
        ventureId: v.ventureId,
        artifactKind: 'persona_set',
        summary: 'x',
        payload: [persona('p1')],
      }),
    ).rejects.toBeInstanceOf(VentureNotFoundError);
  });
});

describe('VentureService — artifact versioning', () => {
  it('assigns monotonic versions per kind and preserves history', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'X' });
    const a1 = await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'persona_set', summary: 'first', payload: [persona('p1')],
    });
    const a2 = await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'persona_set', summary: 'second', payload: [persona('p1'), persona('p2')],
    });
    expect(a1.version).toBe(1);
    expect(a2.version).toBe(2);
    const all = await s.listArtifacts(OWNER_A, v.ventureId);
    expect(all.filter((a) => a.artifactKind === 'persona_set')).toHaveLength(2);
  });

  it('counts versions independently per kind', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'X' });
    const p1 = await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'persona_set', summary: 'p', payload: [persona('p1')],
    });
    const g1 = await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'research_graph', summary: 'g', payload: graph(),
    });
    expect(p1.version).toBe(1);
    expect(g1.version).toBe(1);
  });
});

describe('VentureService — status auto-advance + summary', () => {
  it('advances draft → researching when persona_set attaches', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'X' });
    await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'persona_set', summary: 'p', payload: [persona('p1'), persona('p2'), persona('p3')],
    });
    const after = await s.getVenture(OWNER_A, v.ventureId);
    expect(after.status).toBe('researching');
  });

  it('computes a summary with progress + readiness', async () => {
    const s = svc();
    const v = await s.createVenture({ ownerId: OWNER_A, title: 'X' });
    await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'persona_set', summary: 'p',
      payload: [persona('p1'), persona('p2'), persona('p3')],
    });
    await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'research_graph', summary: 'g', payload: graph(),
    });
    await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'venture_recommendation', summary: 'PROCEED', payload: recommendation('PROCEED'),
    });
    await s.attachArtifact({
      ownerId: OWNER_A, ventureId: v.ventureId,
      artifactKind: 'buildsquad_pack', summary: 'pack', payload: pack('proceed'),
    });
    const sum = await s.getSummary(OWNER_A, v.ventureId);
    expect(sum.artifactCount).toBe(4);
    expect(sum.latestRecommendation?.decision).toBe('PROCEED');
    expect(sum.progress.research).toBeGreaterThan(50);
    expect(sum.progress.buildReadiness).toBeGreaterThan(50);
    expect(sum.readiness.overall).toBeGreaterThan(50);
    expect(sum.venture.status).toBe('approved');
  });
});

describe('readiness — pure functions', () => {
  it('returns zeros for an empty ledger and lists warnings', () => {
    const r = calculateVentureReadiness([]);
    expect(r.overall).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
    const p = calculateVentureProgress([]);
    expect(p.research).toBe(0);
    expect(p.buildReadiness).toBe(0);
  });
});
