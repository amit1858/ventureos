/**
 * VentureLab × Graphify (Sprint 1F) — supplemental tests.
 *
 * Verifies VentureLab degrades gracefully without a ResearchGraph and reacts
 * deterministically when one is provided.
 */
import { describe, expect, it } from 'vitest';
import type { CallContext, PersonaLabBrief, PersonaLabPersona, ResearchGraph } from '@foundry/contracts';

import {
  applyResearchGraphAdjustments,
  applyScoreDeltas,
  decide,
  VentureLab,
  type ChatFn,
  type SignalsPayload,
  type VentureLabInput,
} from '../src/index';

const ctx: CallContext = { tenantId: 't1', traceId: 'trace-1f', ventureId: 'v-faceless-crm' };

const brief: PersonaLabBrief = {
  businessIdea: 'Faceless CRM for SMB',
  targetMarket: 'Solo founders and micro-agencies',
  customerType: 'B2B',
  region: 'global',
  businessSize: '1-5',
};

const persona: PersonaLabPersona = {
  id: 'p1', name: 'Maya', role: 'Solo consultant',
  businessContext: '', goals: [], painPoints: ['abandoned every CRM'], motivations: [],
  objections: [], buyingTriggers: [], decisionPower: 'high', quote: '',
  confidenceScore: 0.85, evidenceNotes: [],
};

function signals(): SignalsPayload {
  return {
    problemEvidence: [{ kind: 'persona', source: 'p1', quote: 'abandoned every CRM within 30 days', weight: 0.85 }],
    urgencyEvidence: [{ kind: 'persona', source: 'p1', quote: 'lost a deal last week because no follow-up', weight: 0.7 }],
    willingnessToPayEvidence: [{ kind: 'persona', source: 'p1', quote: 'happy at $29/mo', weight: 0.65 }],
    differentiationEvidence: [{ kind: 'persona', source: 'p1', quote: 'zero forms is what I want', weight: 0.7 }],
    adoptionFrictionEvidence: [],
    executionRiskEvidence: [],
    marketClarityEvidence: [{ kind: 'brief', source: 'brief', quote: 'solo consultants on Gmail', weight: 0.6 }],
  };
}

function mockChat(payloads: unknown[]): ChatFn {
  let i = 0;
  return async () => ({
    model: 't', content: JSON.stringify(payloads[i++]),
    finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  });
}

const baseInput: VentureLabInput = {
  ventureId: 'v-faceless-crm', brief, personas: [persona],
};

const SAMPLE_GRAPH: ResearchGraph = {
  kind: 'ResearchGraph',
  graphId: 'g_test',
  ventureId: 'v-faceless-crm',
  createdAt: '2026-06-01T00:00:00.000Z',
  stats: { nodes: 6, edges: 4, communities: 1, confidence: { EXTRACTED: 4, INFERRED: 2, AMBIGUOUS: 0 } },
  godNodes: [],
  nodes: [
    { id: 'n1', type: 'competitor',    label: 'HubSpot Free',           confidence: 0.9, evidence: ['HubSpot Free'], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'n2', type: 'competitor',    label: 'Folk',                    confidence: 0.7, evidence: ['Folk'], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'n3', type: 'segment',       label: 'Solo consultants',        confidence: 0.85, evidence: ['solos abandon CRMs'], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'n4', type: 'market_signal', label: '>40% CRM abandonment',    confidence: 0.8, evidence: ['>40% abandonment'], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'n5', type: 'assumption',    label: 'Solos accept BYOK',       confidence: 0.5, evidence: [], provenance: { sourceIds: ['s_1'], extractor: 'rule', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'n6', type: 'problem',       label: 'manual data entry',       confidence: 0.85, evidence: ['manual data entry'], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n6', type: 'competes_with', confidence: 0.7, evidence: [], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'e2', from: 'n3', to: 'n6', type: 'experiences',   confidence: 0.85, evidence: [], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'e3', from: 'n4', to: 'n6', type: 'validates',     confidence: 0.7, evidence: [], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
    { id: 'e4', from: 'n4', to: 'n5', type: 'contradicts',   confidence: 0.6, evidence: [], provenance: { sourceIds: ['s_1'], extractor: 'llm', extractedAt: '2026-06-01T00:00:00.000Z' } },
  ],
  sources: [{ id: 's_1', kind: 'note', label: 'note', addedAt: '2026-06-01T00:00:00.000Z' }],
};

describe('VentureLab × ResearchGraph', () => {
  it('runs unchanged when no ResearchGraph is provided', async () => {
    const chat = mockChat([signals(), { assumptions: [] }]);
    const lab = new VentureLab(chat, { model: 'gpt-4', ctx });
    const rec = await lab.analyze(baseInput);
    expect(rec.kind).toBe('VentureRecommendation');
    expect(rec.decisionRationale.some((r) => /ResearchGraph/i.test(r))).toBe(false);
  });

  it('appends graph-derived rationale and counter-signals when a graph is provided', async () => {
    const chat = mockChat([signals(), { assumptions: [] }]);
    const lab = new VentureLab(chat, { model: 'gpt-4', ctx });
    const rec = await lab.analyze({ ...baseInput, researchGraph: { ...SAMPLE_GRAPH, contradictions: ['e3 contradicts e4'] } });
    expect(rec.decisionRationale.some((r) => /ResearchGraph/i.test(r))).toBe(true);
    expect(rec.counterSignals.some((c) => c.source.startsWith('graph:'))).toBe(true);
  });

  it('lowers differentiation and raises marketClarity deterministically', () => {
    const baseScores = [
      { dimension: 'differentiation' as const, score: 70, higherIsBetter: true, explanation: 'x', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'marketClarity' as const,  score: 50, higherIsBetter: true, explanation: 'y', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'executionRisk' as const,  score: 40, higherIsBetter: false, explanation: 'z', supportingEvidence: [], opposingEvidence: [] },
    ];
    const adj = applyResearchGraphAdjustments({ ...SAMPLE_GRAPH, contradictions: ['e3 contradicts e4'] }, baseScores, []);
    const adjusted = applyScoreDeltas(baseScores, adj.scoreDeltas);
    expect(adjusted.find((s) => s.dimension === 'differentiation')!.score).toBeLessThan(70);
    expect(adjusted.find((s) => s.dimension === 'marketClarity')!.score).toBeGreaterThan(50);
    expect(adjusted.find((s) => s.dimension === 'executionRisk')!.score).toBeGreaterThan(40);
  });

  it('does not change the decision when the graph is empty', () => {
    const baseScores = [
      { dimension: 'problemStrength' as const, score: 60, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
    ];
    const empty: ResearchGraph = { kind: 'ResearchGraph', stats: { nodes: 0, edges: 0, communities: 0, confidence: { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 } }, godNodes: [], nodes: [], edges: [] };
    const adj = applyResearchGraphAdjustments(empty, baseScores, []);
    expect(adj.rationale.length).toBe(0);
    expect(Object.keys(adj.scoreDeltas).length).toBe(0);
  });

  it('graph rationale does not flip a decision on its own without supporting score data', async () => {
    // With weak baseline, graph still cannot lift KILL→PROCEED because the
    // PROCEED bars require many independent thresholds. Verifies bounded
    // influence (no runaway adjustment).
    const weakSignals: SignalsPayload = {
      problemEvidence: [],
      urgencyEvidence: [],
      willingnessToPayEvidence: [],
      differentiationEvidence: [],
      adoptionFrictionEvidence: [{ kind: 'persona', source: 'p1', quote: 'I will never adopt', weight: 0.9 }],
      executionRiskEvidence: [{ kind: 'note', source: 'b1', quote: 'risky', weight: 0.9 }],
      marketClarityEvidence: [],
    };
    const chat = mockChat([weakSignals, { assumptions: [] }]);
    const lab = new VentureLab(chat, { model: 'gpt-4', ctx });
    const withGraph = await lab.analyze({ ...baseInput, researchGraph: { ...SAMPLE_GRAPH, contradictions: ['e3 contradicts e4'] } });
    expect(['PIVOT', 'KILL']).toContain(withGraph.decision);
  });
});

describe('VentureLab integration — no secret leakage', () => {
  it('VentureRecommendation serialisation contains no api-key shaped strings', async () => {
    const chat = mockChat([signals(), { assumptions: [] }]);
    const lab = new VentureLab(chat, { model: 'gpt-4', ctx });
    const rec = await lab.analyze({ ...baseInput, researchGraph: SAMPLE_GRAPH });
    const s = JSON.stringify(rec);
    expect(s).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    expect(s).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/=-]+/);
    // sanity check decide() is still pure
    expect(decide(rec.scores).decision).toBe(rec.decision);
  });
});
