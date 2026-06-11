import { describe, expect, it } from 'vitest';

import type { ChatRequest, ChatResponse } from '@ventureos/contracts';

import { GraphifyAdapter, createGraphifyAdapter } from '../src/adapter';
import { evaluateGraph } from '../src/evaluation';
import { detectContradictions, shortestPath, topGodNodes } from '../src/graph';
import { projectView, queryGraph } from '../src/query';
import type { ChatFn, GraphifyInput } from '../src/types';
import { GraphifyError } from '../src/types';

const ctx = { tenantId: 't_test', userId: 'u_test', requestId: 'req_test', purpose: 'graphify' } as const;

const FACELESS_NOTES = [
  'Solo consultants report abandoning HubSpot Free within 30 days due to manual data entry; they prefer WhatsApp follow-ups.',
  'Agency owners complain that pipeline hygiene erodes after 2 weeks because their team forgets to update stages.',
  'Existing competitors: HubSpot, Folk, Attio, Pipedrive. All require structured forms.',
  'Market signal: r/sales and Indie Hackers report >40% CRM abandonment in <90 days for solo operators.',
];

function fakeChatJson(payload: unknown): ChatFn {
  return async (_req: ChatRequest): Promise<ChatResponse> => ({
    model: 'test-model',
    content: JSON.stringify(payload),
    finishReason: 'stop',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  });
}

const SAMPLE_PAYLOAD = {
  nodes: [
    { id: 'n_problem_admin',    type: 'problem',       label: 'Manual CRM data entry burden',                 confidence: 0.9, evidence: ['abandoning HubSpot Free within 30 days'], sourceIds: ['s_1'] },
    { id: 'n_problem_pipeline', type: 'problem',       label: 'Pipeline hygiene erodes after 2 weeks',        confidence: 0.85, evidence: ['pipeline hygiene erodes after 2 weeks'], sourceIds: ['s_2'] },
    { id: 'n_segment_solos',    type: 'segment',       label: 'Solo consultants',                              confidence: 0.85, evidence: ['Solo consultants report abandoning'], sourceIds: ['s_1'] },
    { id: 'n_segment_agencies', type: 'segment',       label: 'Micro-agency owners',                           confidence: 0.8, evidence: ['Agency owners complain'], sourceIds: ['s_2'] },
    { id: 'n_comp_hubspot',     type: 'competitor',    label: 'HubSpot Free',                                  confidence: 0.95, evidence: ['HubSpot Free'], sourceIds: ['s_1'] },
    { id: 'n_comp_folk',        type: 'competitor',    label: 'Folk',                                          confidence: 0.7,  evidence: ['Folk'], sourceIds: ['s_3'] },
    { id: 'n_alt_whatsapp',     type: 'alternative',   label: 'WhatsApp follow-ups',                           confidence: 0.7,  evidence: ['prefer WhatsApp follow-ups'], sourceIds: ['s_1'] },
    { id: 'n_signal_abandon',   type: 'market_signal', label: '>40% CRM abandonment in <90 days',              confidence: 0.75, evidence: ['>40% CRM abandonment in <90 days'], sourceIds: ['s_4'] },
    { id: 'n_feat_zeroforms',   type: 'feature',       label: 'Zero forms input',                              confidence: 0.65, evidence: [], sourceIds: ['s_1'] },
    { id: 'n_opp_aifirst',      type: 'opportunity',   label: 'AI-drafted next reply',                         confidence: 0.7,  evidence: [], sourceIds: ['s_1'] },
  ],
  edges: [
    { from: 'n_segment_solos',    to: 'n_problem_admin',    type: 'experiences',  confidence: 0.9,  evidence: ['Solo consultants report abandoning'], sourceIds: ['s_1'] },
    { from: 'n_segment_agencies', to: 'n_problem_pipeline', type: 'experiences',  confidence: 0.85, evidence: ['Agency owners complain'], sourceIds: ['s_2'] },
    { from: 'n_comp_hubspot',     to: 'n_problem_admin',    type: 'competes_with',confidence: 0.7,  evidence: [], sourceIds: ['s_3'] },
    { from: 'n_alt_whatsapp',     to: 'n_comp_hubspot',     type: 'substitutes',  confidence: 0.6,  evidence: [], sourceIds: ['s_1'] },
    { from: 'n_feat_zeroforms',   to: 'n_problem_admin',    type: 'enables',      confidence: 0.7,  evidence: [], sourceIds: ['s_1'] },
    { from: 'n_opp_aifirst',      to: 'n_feat_zeroforms',   type: 'depends_on',   confidence: 0.6,  evidence: [], sourceIds: ['s_1'] },
    { from: 'n_signal_abandon',   to: 'n_problem_admin',    type: 'validates',    confidence: 0.7,  evidence: [], sourceIds: ['s_4'] },
  ],
};

function makeAdapter(payload: unknown = SAMPLE_PAYLOAD): GraphifyAdapter {
  return createGraphifyAdapter(fakeChatJson(payload), {
    model: 'test-model',
    ctx,
    now: () => new Date('2026-06-01T00:00:00Z'),
    generateId: (prefix) => `${prefix}_test`,
  });
}

const BASE_INPUT: GraphifyInput = {
  ventureId: 'v-faceless-crm',
  brief: {
    businessIdea: 'Faceless CRM for SMB',
    targetMarket: 'Solo founders, indie consultants, micro-agencies',
    customerType: 'Owner-led / solo operator',
    region: 'Global',
    businessSize: '1 to 5 employees',
  },
  notes: FACELESS_NOTES,
};

describe('GraphifyAdapter.buildResearchGraph', () => {
  it('produces a typed ResearchGraph with the expected shape', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    expect(g.kind).toBe('ResearchGraph');
    expect(g.graphId).toBeDefined();
    expect(g.createdAt).toBe('2026-06-01T00:00:00.000Z');
    expect(g.stats.nodes).toBeGreaterThan(0);
    expect(g.stats.edges).toBeGreaterThan(0);
    expect(g.nodes!.length).toBe(g.stats.nodes);
    expect(g.edges!.length).toBe(g.stats.edges);
    expect(g.sources!.length).toBeGreaterThan(0);
    expect(g.godNodes.length).toBeGreaterThan(0);
  });

  it('populates provenance with valid source ids on every node', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const validIds = new Set(g.sources!.map((s) => s.id));
    for (const n of g.nodes!) {
      for (const sid of n.provenance.sourceIds) {
        expect(validIds.has(sid)).toBe(true);
      }
      expect(['llm', 'rule', 'manual']).toContain(n.provenance.extractor);
    }
  });

  it('drops LLM edges with unknown node ids or invalid types', async () => {
    const dirty = {
      nodes: [
        { id: 'a', type: 'problem',    label: 'A', confidence: 0.5, evidence: [], sourceIds: ['s_1'] },
        { id: 'b', type: 'competitor', label: 'B', confidence: 0.5, evidence: [], sourceIds: ['s_1'] },
      ],
      edges: [
        { from: 'a', to: 'b',       type: 'competes_with', confidence: 0.8, sourceIds: ['s_1'] }, // valid
        { from: 'a', to: 'ghost',   type: 'enables',       confidence: 0.5, sourceIds: ['s_1'] }, // unknown target
        { from: 'a', to: 'b',       type: 'made_up_type',  confidence: 0.5, sourceIds: ['s_1'] }, // invalid type
        { from: 'a', to: 'a',       type: 'enables',       confidence: 0.5, sourceIds: ['s_1'] }, // self loop
      ],
    };
    const g = await makeAdapter(dirty).buildResearchGraph(BASE_INPUT);
    expect(g.edges!.length).toBe(1);
    expect(g.edges![0].type).toBe('competes_with');
  });

  it('throws GraphifyError when the LLM call fails', async () => {
    const failing: ChatFn = async () => {
      throw new Error('upstream 500');
    };
    const adapter = createGraphifyAdapter(failing, {
      model: 'test-model', ctx, now: () => new Date('2026-06-01T00:00:00Z'),
    });
    await expect(adapter.buildResearchGraph(BASE_INPUT)).rejects.toBeInstanceOf(GraphifyError);
  });

  it('returns an empty graph (no LLM call) when there is no source text', async () => {
    let called = 0;
    const chat: ChatFn = async () => {
      called++;
      return { model: 't', content: '{}', finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    };
    const adapter = createGraphifyAdapter(chat, { model: 't', ctx, now: () => new Date('2026-06-01T00:00:00Z') });
    const g = await adapter.buildResearchGraph({ ventureId: 'v-x' });
    expect(called).toBe(0);
    expect(g.stats.nodes).toBe(0);
    expect(g.stats.edges).toBe(0);
  });

  it('derives persona / assumption / risk nodes deterministically', async () => {
    const adapter = makeAdapter();
    const g = await adapter.buildResearchGraph({
      ...BASE_INPUT,
      personas: [
        { id: 'p1', name: 'Maya', role: 'Solo consultant', businessContext: '', goals: [], painPoints: ['hates data entry'], motivations: [], objections: ['tried 4 CRMs'], buyingTriggers: [], decisionPower: 'high', quote: '', confidenceScore: 0.85, evidenceNotes: [] },
      ],
      assumptions: [
        { id: 'a1', text: 'Solos accept BYOK', type: 'risky', confidence: 'low', evidence: [], riskLevel: 'high', validationStrategy: 'pilot' },
      ],
      risks: [
        { id: 'r1', risk: 'Outlook gap', impact: 'medium', likelihood: 'high', mitigation: 'ship by m6' },
      ],
    });
    const ids = new Set(g.nodes!.map((n) => n.id));
    expect(ids.has('persona:p1')).toBe(true);
    expect(ids.has('assumption:a1')).toBe(true);
    expect(ids.has('risk:r1')).toBe(true);
  });
});

describe('graph operations', () => {
  it('topGodNodes returns nodes sorted by degree desc', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const top = topGodNodes(g.nodes!, g.edges!, 3);
    expect(top.length).toBe(3);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].degree).toBeGreaterThanOrEqual(top[i].degree);
  });

  it('shortestPath finds an undirected path between two connected nodes', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const path = shortestPath(g.nodes!, g.edges!, 'n_opp_aifirst', 'n_segment_solos');
    expect(path).not.toBeNull();
    expect(path!.hops).toBeGreaterThan(0);
    expect(path!.nodes[0].id).toBe('n_opp_aifirst');
    expect(path!.nodes[path!.nodes.length - 1].id).toBe('n_segment_solos');
  });

  it('shortestPath returns null for disconnected ids', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    expect(shortestPath(g.nodes!, g.edges!, 'n_segment_solos', 'does_not_exist')).toBeNull();
  });

  it('detectContradictions surfaces validates↔contradicts pairs', () => {
    const nodes = [
      { id: 'a', type: 'problem' as const, label: 'A', confidence: 0.5, evidence: [], provenance: { sourceIds: [], extractor: 'llm' as const, extractedAt: 'x' } },
      { id: 'b', type: 'problem' as const, label: 'B', confidence: 0.5, evidence: [], provenance: { sourceIds: [], extractor: 'llm' as const, extractedAt: 'x' } },
    ];
    const edges = [
      { id: 'e1', from: 'a', to: 'b', type: 'validates' as const,   confidence: 0.6, evidence: [], provenance: { sourceIds: [], extractor: 'llm' as const, extractedAt: 'x' } },
      { id: 'e2', from: 'a', to: 'b', type: 'contradicts' as const, confidence: 0.6, evidence: [], provenance: { sourceIds: [], extractor: 'llm' as const, extractedAt: 'x' } },
    ];
    const c = detectContradictions(edges);
    expect(c.length).toBe(1);
    expect(c[0]).toContain('e1');
  });
});

describe('queries and views', () => {
  it('queryGraph ranks matching nodes higher', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const r = queryGraph(g, 'pipeline hygiene erodes', 5);
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.matches[0].label.toLowerCase()).toContain('pipeline');
  });

  it('projectView returns only the configured node types', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const v = projectView(g, 'competitor');
    for (const n of v.nodes) expect(['competitor', 'alternative']).toContain(n.type);
  });
});

describe('exportNeo4j', () => {
  it('produces CREATE statements without sending network traffic', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const cypher = makeAdapter().exportNeo4j(g);
    expect(cypher).toContain('CREATE (:Problem');
    expect(cypher).toContain('CREATE (:Competitor');
    expect(cypher).toContain('-[:EXPERIENCES');
  });
});

describe('addSource (no LLM)', () => {
  it('appends a source without calling chat', async () => {
    let calls = 0;
    const adapter = createGraphifyAdapter(async () => {
      calls++;
      return { model: 't', content: '{}', finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    }, { model: 't', ctx, now: () => new Date('2026-06-01T00:00:00Z'), generateId: (p) => `${p}_2` });
    const seed = await adapter.buildResearchGraph({ ventureId: 'v', notes: ['seed'] });
    const before = calls;
    const g = adapter.addSource(seed, { label: 'Founder note', text: 'Manual entry kills 30 min/day.' });
    expect(calls).toBe(before);
    expect(g.sources!.length).toBe(seed.sources!.length + 1);
    expect(g.sources![g.sources!.length - 1].label).toBe('Founder note');
  });
});

describe('evaluateGraph', () => {
  it('scores a good graph well and a degenerate graph poorly', async () => {
    const good = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const goodEval = evaluateGraph(good);
    expect(goodEval.nodeRelevance).toBe(1);
    expect(goodEval.edgeUsefulness).toBe(1);
    expect(goodEval.evidenceCoverage).toBeGreaterThan(0.4);
    expect(goodEval.densitySanity).toBeGreaterThan(0.5);

    const empty = await createGraphifyAdapter(fakeChatJson({}), { model: 't', ctx, now: () => new Date('2026-06-01T00:00:00Z') })
      .buildResearchGraph(BASE_INPUT);
    const emptyEval = evaluateGraph(empty);
    expect(emptyEval.overallScore).toBeLessThan(goodEval.overallScore);
  });
});

describe('safety / no leakage', () => {
  it('does not include the raw chat req in the returned graph', async () => {
    const g = await makeAdapter().buildResearchGraph(BASE_INPUT);
    const serialised = JSON.stringify(g);
    expect(serialised).not.toContain('sk-');
    expect(serialised).not.toContain('Bearer ');
  });
});
