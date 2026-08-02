/**
 * VentureLab — orchestrator + analyzer + decision-engine tests.
 *
 * Covers the 13 scenarios called out in the Sprint 1E plan:
 *   1. Strong Proceed
 *   2. Strong Pivot
 *   3. Strong Kill
 *   4. Contradictory Signals
 *   5. Weak Buyer Urgency
 *   6. Weak Willingness to Pay
 *   7. High Adoption Friction
 *   8. High Execution Risk
 *   9. Committee Disagreement
 *  10. Committee Consensus
 *  11. Provider Failure
 *  12. Contract Validation
 *  13. No Secret Leakage
 */
import { describe, expect, it, vi } from 'vitest';
import type {
  BuyingCommitteeTranscript,
  CallContext,
  ChatRequest,
  ChatResponse,
  IdeaBrief,
  PersonaLabBrief,
  PersonaLabPersona,
} from '@foundry/contracts';

import {
  decide,
  computeOverallScore,
  evaluateVentureLab,
  generateNextSteps,
  generateRiskRegister,
  VentureLab,
  type ChatFn,
  type SignalsPayload,
  type VentureAssumption,
  type VentureLabInput,
} from '../src/index';

// ───────────── Fixtures ─────────────

const ctx: CallContext = { tenantId: 't1', traceId: 'trace-1', ventureId: 'v-faceless-crm' };

const brief: PersonaLabBrief = {
  businessIdea: 'A CRM for solo operators and AI-first agencies who never want to see a contact record.',
  targetMarket: 'Solo founders, indie consultants, micro-agencies (1-5 people) running on Gmail/Outlook + a notes app.',
  customerType: 'B2B',
  region: 'global',
  businessSize: '1-5',
  additionalContext: 'Zero forms, zero pipeline stages, zero required fields.',
};

const ideaBrief: IdeaBrief = {
  kind: 'IdeaBrief',
  title: 'Faceless CRM',
  summary: 'A CRM that hides itself behind your inbox.',
  targetMarket: brief.targetMarket,
  wedge: 'Zero forms, zero pipeline stages, zero required fields. Everything is inferred from message history.',
  businessModelHypothesis: 'B2C-style PLG SaaS: $29/mo solo, $79/mo team.',
  founderAssumptions: [
    'Solo operators hate CRM data entry and abandon traditional CRMs within 30 days.',
    'An AI that drafts the next reply is more valuable than a dashboard.',
  ],
  tags: ['crm', 'solo-founder'],
};

function persona(id: string, role: string, overrides: Partial<PersonaLabPersona> = {}): PersonaLabPersona {
  return {
    id,
    name: id,
    role,
    businessContext: 'Solo operator running their own consultancy.',
    goals: ['Spend less time on admin'],
    painPoints: ['Manual CRM data entry takes 30 minutes per day and I keep abandoning the tool'],
    motivations: ['Stay in flow'],
    objections: ['I have tried 4 CRMs and abandoned all of them'],
    buyingTriggers: ['Lost a deal because I forgot to follow up'],
    decisionPower: 'high',
    quote: 'I just want my inbox to tell me what to do next.',
    confidenceScore: 0.85,
    evidenceNotes: ['g2 reviews'],
    ...overrides,
  };
}

const personas: PersonaLabPersona[] = [
  persona('p1', 'Solo consultant'),
  persona('p2', 'Agency owner', {
    painPoints: ['Pipeline forecasting eats my Friday afternoons every single week'],
    buyingTriggers: ['Lost a $40k deal because account context was scattered across 3 tools'],
  }),
  persona('p3', 'Indie SaaS founder', {
    painPoints: ['I just want to stop using a CRM but I need follow-up nudges'],
  }),
];

function buyCommittee(): BuyingCommitteeTranscript {
  return {
    offerSummary: 'AI-first CRM for solo operators at $29/mo.',
    members: [
      { personaId: 'p1', committeeRole: 'Champion', stance: 'champion', rationale: 'Pain matches.', blockingObjections: [] },
      { personaId: 'p2', committeeRole: 'Buyer', stance: 'supporter', rationale: 'Team angle works.', blockingObjections: [] },
      { personaId: 'p3', committeeRole: 'User', stance: 'neutral', rationale: 'Worth a pilot.', blockingObjections: [] },
    ],
    decision: 'buy',
    decisionRationale: 'Pain + pricing align for two of three personas.',
    nextSteps: ['Design partner program'],
    deliberation: {
      phases: {
        initialPositions: [
          { personaId: 'p1', position: 'support', enthusiasm: 0.85, concerns: [], willingnessToAdopt: 'Yes', rationale: 'Pain match.' },
          { personaId: 'p2', position: 'support_with_concerns', enthusiasm: 0.6, concerns: ['team math'], willingnessToAdopt: 'Pilot', rationale: 'Workable.' },
          { personaId: 'p3', position: 'pilot_first', enthusiasm: 0.5, concerns: ['unknown ROI'], willingnessToAdopt: 'Pilot', rationale: 'Want to try.' },
        ],
        challenges: [
          { fromPersonaId: 'p3', toPersonaId: 'p1', topic: 'roi', argument: 'How do you measure ROI?' },
        ],
        responses: [
          { fromPersonaId: 'p1', challengeIndex: 0, argument: 'Time saved per day.', changedOpinion: false },
        ],
        consensus: [
          { personaId: 'p1', position: 'support', enthusiasm: 0.85, concerns: [], willingnessToAdopt: 'Yes', rationale: 'Pain match.' },
          { personaId: 'p2', position: 'support_with_concerns', enthusiasm: 0.6, concerns: [], willingnessToAdopt: 'Pilot', rationale: 'Workable.' },
          { personaId: 'p3', position: 'pilot_first', enthusiasm: 0.5, concerns: [], willingnessToAdopt: 'Pilot', rationale: 'Want to try.' },
        ],
      },
      opinionChanges: [],
      unresolvedObjections: [],
      strongestSupportingArguments: ['Pain match is unambiguous for solo consultants.'],
      strongestOpposingArguments: ['Outlook gap excludes ~25% of SMB market.'],
      whatWouldChangeMinds: ['Outlook integration'],
      consensusLevel: 'strong',
      confidenceScore: 0.8,
    },
  };
}

function baseInput(): VentureLabInput {
  return {
    ventureId: 'v-faceless-crm',
    brief,
    ideaBrief,
    personas,
    committee: buyCommittee(),
  };
}

function ev(quote: string, kind: 'persona' | 'committee' | 'brief' = 'persona', source = 'p1', weight = 0.7): SignalsPayload['problemEvidence'][number] {
  return { kind, source, quote, weight };
}

function signals(partial: Partial<SignalsPayload> = {}): SignalsPayload {
  return {
    problemEvidence: [],
    urgencyEvidence: [],
    willingnessToPayEvidence: [],
    differentiationEvidence: [],
    adoptionFrictionEvidence: [],
    executionRiskEvidence: [],
    marketClarityEvidence: [],
    ...partial,
  };
}

function strongPositiveSignals(): SignalsPayload {
  return signals({
    problemEvidence: [
      ev('I abandon every CRM within 30 days because the data entry kills me'),
      ev('I lose 30 minutes a day on admin', 'persona', 'p2'),
      ev('Lost a $40k deal because account context scattered', 'persona', 'p2', 0.9),
      ev('Tried four CRMs, abandoned them all', 'persona', 'p1', 0.8),
    ],
    urgencyEvidence: [
      ev('I need a fix this week, I am bleeding deals every day right now', 'persona', 'p2', 0.9),
      ev('It is critical for my pipeline this quarter', 'persona', 'p1', 0.8),
    ],
    willingnessToPayEvidence: [
      ev('I will gladly pay $29/mo, that is a no-brainer ROI', 'persona', 'p1', 0.9),
      ev('Budget for tooling is $200/mo per seat, easy', 'persona', 'p2', 0.85),
    ],
    differentiationEvidence: [
      ev('No other CRM ships zero-forms by default', 'brief', 'brief.wedge', 0.9),
    ],
    adoptionFrictionEvidence: [],
    executionRiskEvidence: [],
    marketClarityEvidence: [ev('My ICP is clearly indie consultants', 'persona', 'p1', 0.7)],
  });
}

function strongKillSignals(): SignalsPayload {
  return signals({
    problemEvidence: [ev('It is mildly annoying I guess', 'persona', 'p1', 0.2)],
    urgencyEvidence: [],
    willingnessToPayEvidence: [],
    differentiationEvidence: [],
    adoptionFrictionEvidence: [
      ev('Onboarding looks like a nightmare, too many steps', 'persona', 'p1', 0.9),
      ev('I would have to migrate from 4 tools, painful to set up', 'persona', 'p2', 0.9),
      ev('Setup, integration, training — too much change management', 'persona', 'p3', 0.85),
      ev('Manual data entry to import everything', 'persona', 'p2', 0.8),
      ev('Complex workflow change', 'persona', 'p3', 0.8),
    ],
    executionRiskEvidence: [
      ev('We don\'t know how to make this scale technically', 'note', 'founder', 0.8),
      ev('Compliance/GDPR is unproven', 'note', 'founder', 0.8),
      ev('Integration with Gmail has rate limit issues', 'note', 'founder', 0.7),
    ],
    marketClarityEvidence: [],
  });
}

function assumptionSet(): VentureAssumption[] {
  return [
    {
      id: 'a1',
      text: 'Solo operators will pay $29/mo for an AI-drafted-reply experience.',
      type: 'risky',
      confidence: 'medium',
      riskLevel: 'high',
      validationStrategy: 'Run a Stripe-backed smoke-test landing page for 14 days.',
      evidence: [],
    },
  ];
}

function mockChatJson(jsonResponses: unknown[]): ChatFn {
  const fn = vi.fn();
  for (const r of jsonResponses) {
    fn.mockResolvedValueOnce({
      content: JSON.stringify(r),
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      cost: { usd: 0.001, provider: 'openai', model: 'gpt-4' },
      cached: false,
    } satisfies ChatResponse);
  }
  return fn as unknown as ChatFn;
}

// ───────────── 1. Strong Proceed ─────────────
describe('VentureLab — strong proceed', () => {
  it('returns PROCEED when problem, urgency, WTP and committee all clear the bar', async () => {
    const chat = mockChatJson([
      strongPositiveSignals(),
      { assumptions: assumptionSet() },
    ]);
    const lab = new VentureLab(chat, { model: 'gpt-4', ctx });
    const rec = await lab.analyze(baseInput());
    expect(rec.decision).toBe('PROCEED');
    expect(rec.overallScore).toBeGreaterThanOrEqual(68);
    expect(rec.scores.find((s) => s.dimension === 'problemStrength')!.score).toBeGreaterThanOrEqual(50);
    expect(rec.scores.find((s) => s.dimension === 'committeeConfidence')!.score).toBeGreaterThanOrEqual(60);
    expect(rec.decisionRationale[0]).toMatch(/PROCEED/);
  });
});

// ───────────── 2. Strong Pivot ─────────────
describe('VentureLab — strong pivot', () => {
  it('returns PIVOT when problem is strong but WTP is weak', async () => {
    const sig = signals({
      problemEvidence: strongPositiveSignals().problemEvidence,
      urgencyEvidence: strongPositiveSignals().urgencyEvidence,
      willingnessToPayEvidence: [ev('I might pay $5/mo', 'persona', 'p1', 0.3)],
      differentiationEvidence: strongPositiveSignals().differentiationEvidence,
    });
    const chat = mockChatJson([sig, { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze({ ...baseInput(), committee: undefined });
    expect(rec.decision).toBe('PIVOT');
    expect(rec.decisionRationale.join(' ')).toMatch(/pricing|willingness/i);
  });
});

// ───────────── 3. Strong Kill ─────────────
describe('VentureLab — strong kill', () => {
  it('returns KILL when problem is weak, urgency is absent and friction is severe', async () => {
    const chat = mockChatJson([strongKillSignals(), { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze({
      ...baseInput(),
      committee: undefined,
    });
    expect(rec.decision).toBe('KILL');
    expect(rec.decisionRationale[0]).toMatch(/KILL/);
  });
});

// ───────────── 4. Contradictory Signals ─────────────
describe('VentureLab — contradictory signals', () => {
  it('lowers confidence when positive-dimension scores have high variance', async () => {
    const sig = signals({
      problemEvidence: Array.from({ length: 6 }, (_, i) => ev('Strong pain ' + i, 'persona', 'p1', 0.9)),
      urgencyEvidence: [],
      willingnessToPayEvidence: Array.from({ length: 6 }, (_, i) => ev('Will pay $29/mo no problem ' + i, 'persona', 'p1', 0.9)),
      differentiationEvidence: [],
      marketClarityEvidence: [],
    });
    const chat = mockChatJson([sig, { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput());
    // High variance + missing dimensions → calibrated low confidence.
    expect(rec.confidenceScore).toBeLessThan(0.75);
  });
});

// ───────────── 5. Weak Buyer Urgency ─────────────
describe('VentureLab — weak buyer urgency', () => {
  it('penalises decision when urgency is low even if problem is strong', async () => {
    const sig = signals({
      problemEvidence: strongPositiveSignals().problemEvidence,
      urgencyEvidence: [],
      willingnessToPayEvidence: strongPositiveSignals().willingnessToPayEvidence,
    });
    const chat = mockChatJson([sig, { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze({
      ...baseInput(),
      personas: personas.map((p) => ({ ...p, buyingTriggers: [] })),
    });
    expect(['PIVOT', 'KILL']).toContain(rec.decision);
    expect(rec.scores.find((s) => s.dimension === 'buyerUrgency')!.score).toBeLessThan(45);
  });
});

// ───────────── 6. Weak Willingness to Pay ─────────────
describe('VentureLab — weak WTP', () => {
  it('puts a pricing-test step at priority 1 when WTP is weak', async () => {
    const sig = signals({
      problemEvidence: strongPositiveSignals().problemEvidence,
      urgencyEvidence: strongPositiveSignals().urgencyEvidence,
      willingnessToPayEvidence: [],
    });
    const chat = mockChatJson([sig, { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze({ ...baseInput(), committee: undefined });
    const pricingStep = rec.nextSteps.find((s) => s.category === 'pricing_test');
    expect(pricingStep).toBeDefined();
    expect(pricingStep!.priority).toBe(1);
    expect(pricingStep!.blocksDecision).toBe(true);
  });
});

// ───────────── 7. High Adoption Friction ─────────────
describe('VentureLab — high adoption friction', () => {
  it('emits an onboarding step and a high-impact friction risk', async () => {
    const sig = signals({
      problemEvidence: strongPositiveSignals().problemEvidence,
      adoptionFrictionEvidence: strongKillSignals().adoptionFrictionEvidence,
    });
    const chat = mockChatJson([sig, { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput());
    expect(rec.scores.find((s) => s.dimension === 'adoptionFriction')!.score).toBeGreaterThan(60);
    expect(rec.nextSteps.some((s) => s.category === 'onboarding_test')).toBe(true);
    expect(rec.risks.some((r) => r.relatedDimension === 'adoptionFriction')).toBe(true);
  });
});

// ───────────── 8. High Execution Risk ─────────────
describe('VentureLab — high execution risk', () => {
  it('emits a technical_spike step at high priority', async () => {
    const sig = signals({
      problemEvidence: strongPositiveSignals().problemEvidence,
      executionRiskEvidence: strongKillSignals().executionRiskEvidence,
    });
    const chat = mockChatJson([sig, { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput());
    expect(rec.scores.find((s) => s.dimension === 'executionRisk')!.score).toBeGreaterThan(50);
    expect(rec.nextSteps.some((s) => s.category === 'technical_spike')).toBe(true);
  });
});

// ───────────── 9. Committee Disagreement ─────────────
describe('VentureLab — committee disagreement', () => {
  it('produces low committeeConfidence when consensus is split and there are unresolved objections', async () => {
    const split: BuyingCommitteeTranscript = {
      ...buyCommittee(),
      decision: 'reject',
      deliberation: {
        ...buyCommittee().deliberation!,
        consensusLevel: 'split',
        confidenceScore: 0.3,
        unresolvedObjections: [
          'Pricing is too high for solos.',
          'Data residency story is missing.',
          'No Outlook support.',
        ],
        phases: {
          ...buyCommittee().deliberation!.phases,
          consensus: [
            { personaId: 'p1', position: 'support_with_concerns', enthusiasm: 0.4, concerns: ['price'], willingnessToAdopt: 'Maybe', rationale: 'Costly.' },
            { personaId: 'p2', position: 'reject', enthusiasm: 0.1, concerns: ['data residency'], willingnessToAdopt: 'No', rationale: 'Blocker.' },
            { personaId: 'p3', position: 'reject', enthusiasm: 0.1, concerns: ['no outlook'], willingnessToAdopt: 'No', rationale: 'Missing tool.' },
          ],
        },
      },
    };
    const chat = mockChatJson([strongPositiveSignals(), { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze({ ...baseInput(), committee: split });
    expect(rec.scores.find((s) => s.dimension === 'committeeConfidence')!.score).toBeLessThan(50);
    expect(rec.risks.some((r) => /unresolved committee objection/i.test(r.risk))).toBe(true);
  });
});

// ───────────── 10. Committee Consensus ─────────────
describe('VentureLab — committee consensus', () => {
  it('produces high committeeConfidence on strong consensus + buy decision', async () => {
    const chat = mockChatJson([strongPositiveSignals(), { assumptions: [] }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput());
    expect(rec.scores.find((s) => s.dimension === 'committeeConfidence')!.score).toBeGreaterThanOrEqual(60);
  });
});

// ───────────── 11. Provider Failure ─────────────
describe('VentureLab — provider failure', () => {
  it('propagates the underlying provider error', async () => {
    const chat = vi.fn().mockRejectedValueOnce(new Error('rate limited')) as unknown as ChatFn;
    await expect(
      new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput()),
    ).rejects.toThrow(/rate limited/);
  });

  it('throws a VentureLabParseError when the LLM returns non-JSON garbage', async () => {
    const chat = vi.fn().mockResolvedValueOnce({
      content: 'not json at all',
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { usd: 0, provider: 'openai', model: 'gpt-4' },
      cached: false,
    } satisfies ChatResponse).mockResolvedValueOnce({
      content: '{}',
      finishReason: 'stop',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: { usd: 0, provider: 'openai', model: 'gpt-4' },
      cached: false,
    } satisfies ChatResponse) as unknown as ChatFn;
    await expect(
      new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput()),
    ).rejects.toThrow(/json/i);
  });
});

// ───────────── 12. Contract Validation ─────────────
describe('VentureLab — contract validation', () => {
  it('emits a VentureRecommendation with all required fields populated', async () => {
    const chat = mockChatJson([strongPositiveSignals(), { assumptions: assumptionSet() }]);
    const rec = await new VentureLab(chat, { model: 'gpt-4', ctx, generateId: () => 'rec_test_1', now: () => new Date('2025-01-01T00:00:00Z') }).analyze(baseInput());
    expect(rec.kind).toBe('VentureRecommendation');
    expect(rec.recommendationId).toBe('rec_test_1');
    expect(rec.ventureId).toBe('v-faceless-crm');
    expect(rec.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(rec.scores).toHaveLength(8);
    expect(rec.overallScore).toBeGreaterThanOrEqual(0);
    expect(rec.overallScore).toBeLessThanOrEqual(100);
    expect(rec.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(rec.confidenceScore).toBeLessThanOrEqual(1);
    expect(rec.executiveSummary.length).toBeGreaterThan(40);
    expect(rec.decisionRationale.length).toBeGreaterThanOrEqual(1);

    const evalResult = evaluateVentureLab(rec);
    expect(evalResult.overallScore).toBeGreaterThan(0.4);
    expect(evalResult.decisionConsistency).toBe(1);
  });

  it('deterministic synthesis: same inputs → same outputs (modulo timestamp/id)', async () => {
    const lab = new VentureLab(mockChatJson([]), {
      model: 'gpt-4', ctx,
      now: () => new Date('2025-01-01T00:00:00Z'),
      generateId: () => 'rec_test',
    });
    const sig = strongPositiveSignals();
    const a = lab.synthesise(baseInput(), sig, assumptionSet());
    const b = lab.synthesise(baseInput(), sig, assumptionSet());
    expect(a).toEqual(b);
  });
});

// ───────────── 13. No Secret Leakage ─────────────
describe('VentureLab — no secret leakage', () => {
  it('does not include any secret-looking string in chat requests', async () => {
    const captured: ChatRequest[] = [];
    const chat = vi.fn().mockImplementation(async (req: ChatRequest) => {
      captured.push(req);
      return {
        content: JSON.stringify(captured.length === 1 ? strongPositiveSignals() : { assumptions: [] }),
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: { usd: 0, provider: 'openai', model: 'gpt-4' },
        cached: false,
      } satisfies ChatResponse;
    }) as unknown as ChatFn;
    await new VentureLab(chat, { model: 'gpt-4', ctx }).analyze(baseInput());
    const all = JSON.stringify(captured);
    expect(all).not.toMatch(/sk-[a-z0-9]{12,}/i);
    expect(all).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
    expect(all).not.toMatch(/[A-Za-z0-9+/]{40,}={0,2}/);
  });
});

// ───────────── Pure-engine sanity ─────────────
describe('decision engine — pure-engine sanity', () => {
  it('computeOverallScore inverts friction/risk dimensions', () => {
    const baseScores = [
      { dimension: 'problemStrength' as const, score: 90, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'adoptionFriction' as const, score: 90, higherIsBetter: false, explanation: '', supportingEvidence: [], opposingEvidence: [] },
    ];
    const overall = computeOverallScore(baseScores);
    // problem is great, but friction is terrible — composite should be middling, not 90.
    expect(overall).toBeLessThan(80);
  });

  it('decide returns deterministic rationale for the same inputs', () => {
    const sig = strongPositiveSignals();
    const lab = new VentureLab(mockChatJson([]), { model: 'gpt-4', ctx });
    const rec1 = lab.synthesise(baseInput(), sig, []);
    const rec2 = lab.synthesise(baseInput(), sig, []);
    expect(rec1.decisionRationale).toEqual(rec2.decisionRationale);
    expect(rec1.scores.map((s) => [s.dimension, s.score])).toEqual(rec2.scores.map((s) => [s.dimension, s.score]));
  });

  it('generateRiskRegister surfaces low-score risks even without assumptions', () => {
    const lowScores = [
      { dimension: 'problemStrength' as const, score: 20, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'willingnessToPay' as const, score: 20, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'adoptionFriction' as const, score: 95, higherIsBetter: false, explanation: '', supportingEvidence: [], opposingEvidence: [] },
    ];
    const risks = generateRiskRegister(lowScores, [], baseInput());
    expect(risks.length).toBeGreaterThanOrEqual(3);
    expect(risks.some((r) => r.relatedDimension === 'problemStrength')).toBe(true);
    expect(risks.some((r) => r.relatedDimension === 'adoptionFriction')).toBe(true);
  });

  it('generateNextSteps always returns at least one step', () => {
    const allStrong = [
      { dimension: 'problemStrength' as const, score: 95, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'buyerUrgency' as const, score: 95, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'willingnessToPay' as const, score: 95, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'differentiation' as const, score: 95, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'committeeConfidence' as const, score: 95, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'marketClarity' as const, score: 95, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'adoptionFriction' as const, score: 5, higherIsBetter: false, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'executionRisk' as const, score: 5, higherIsBetter: false, explanation: '', supportingEvidence: [], opposingEvidence: [] },
    ];
    const steps = generateNextSteps(allStrong, []);
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });

  it('decide PROCEED requires all bars cleared', () => {
    const strong = [
      { dimension: 'problemStrength' as const, score: 85, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'buyerUrgency' as const, score: 80, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'willingnessToPay' as const, score: 80, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'differentiation' as const, score: 75, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'committeeConfidence' as const, score: 75, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'marketClarity' as const, score: 70, higherIsBetter: true, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'adoptionFriction' as const, score: 30, higherIsBetter: false, explanation: '', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'executionRisk' as const, score: 30, higherIsBetter: false, explanation: '', supportingEvidence: [], opposingEvidence: [] },
    ];
    expect(decide(strong).decision).toBe('PROCEED');
  });
});


