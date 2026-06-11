/**
 * BuildSquad tests — Sprint 2A.
 *
 * Covers:
 *   - artifact output shape (PROCEED)
 *   - PROCEED with normalisation + cross-agent critique
 *   - PIVOT branch
 *   - KILL branch (pure deterministic, zero LLM call)
 *   - missing VentureRecommendation
 *   - provider failure during drafting
 *   - critique LLM failure → deterministic fallback
 *   - deterministic critique catches missing acceptance criteria
 *   - contract validation (BuildSquadArtifactPack.kind set, mode matches decision)
 *   - no secret leakage in serialised pack
 *   - evaluation axes
 */
import { describe, expect, it, vi } from 'vitest';
import type {
  CallContext,
  ChatRequest,
  ChatResponse,
  VentureRecommendation,
} from '@ventureos/contracts';

import {
  BUILDSQUAD_AGENTS,
  BuildSquad,
  BuildSquadError,
  evaluateArtifactPack,
  runDeterministicCritiqueChecks,
  type BuildSquadDraftPayload,
  type BuildSquadInput,
  type ChatFn,
} from '../src/index';

// ─────────────── Fixtures ───────────────────────────────────────────────────

const ctx: CallContext = { tenantId: 't1', traceId: 'trace-bsq', ventureId: 'v-faceless-crm' };

function rec(decision: VentureRecommendation['decision']): VentureRecommendation {
  return {
    kind: 'VentureRecommendation',
    recommendationId: 'rec_001',
    ventureId: 'v-faceless-crm',
    createdAt: '2026-06-01T00:00:00.000Z',
    decision,
    overallScore: decision === 'PROCEED' ? 78 : decision === 'PIVOT' ? 55 : 30,
    confidenceScore: 0.7,
    executiveSummary: 'Faceless CRM has strong urgency in solo operators; differentiation needs a wedge.',
    scores: [
      { dimension: 'problemStrength', score: 80, higherIsBetter: true, explanation: 'p1', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'differentiation', score: 35, higherIsBetter: true, explanation: 'd1', supportingEvidence: [], opposingEvidence: [] },
      { dimension: 'adoptionFriction', score: 70, higherIsBetter: false, explanation: 'a1', supportingEvidence: [], opposingEvidence: [] },
    ],
    evidence: [],
    counterSignals: [
      { kind: 'note', source: 'note:1', quote: 'I will not give an AI my inbox.', weight: 0.6 },
    ],
    assumptions: [
      { id: 'a1', text: 'Solo operators pay $30+/mo for AI-drafted replies.', type: 'risky', confidence: 'medium', evidence: [], riskLevel: 'high', validationStrategy: 'smoke test' },
      { id: 'a2', text: 'No pipeline stages will not hurt forecast quality.', type: 'risky', confidence: 'low', evidence: [], riskLevel: 'critical', validationStrategy: 'pilot' },
    ],
    risks: [
      { id: 'r1', risk: 'Inbox trust ask halves conversion.', impact: 'high', likelihood: 'medium', mitigation: 'Self-hosted BYOK posture.' },
    ],
    nextSteps: [
      { id: 's1', title: 'Run pricing smoke test.', category: 'pricing_test', priority: 1, rationale: 'wtp unclear', effort: 'low', blocksDecision: false },
    ],
    decisionRationale: ['Strong problem + weak differentiation triggers pivot/kill check.'],
  };
}

function fakeDraft(): BuildSquadDraftPayload {
  return {
    productVision: {
      problem: 'Solo operators abandon CRMs in 30 days.',
      targetUsers: ['Solo consultants', 'Micro-agencies'],
      productPromise: 'Your inbox becomes your CRM.',
      whyNow: 'AI can draft the next reply reliably.',
      differentiation: ['Zero forms', 'No pipeline stages'],
      successMetrics: ['Activation in <5 min', '60-day retention >50%'],
    },
    prd: {
      overview: 'Faceless CRM PRD',
      goals: ['Replace CRM with AI inbox'],
      nonGoals: ['Replace email client'],
      personas: [{ id: 'p1', name: 'Maya', summary: 'Solo consultant.' }],
      requirements: [
        { id: 'r1', text: 'Ingest Gmail thread on connect.', type: 'functional' },
        { id: 'r2', text: 'P95 reply suggestion latency < 4s.', type: 'non_functional' },
      ],
      userJourneys: [
        { id: 'j1', personaId: 'p1', title: 'First inbox connect', steps: ['OAuth', 'Index threads', 'See first nudge'] },
      ],
      metrics: ['DAU/MAU > 0.4'],
      risks: ['Inbox-trust ask reduces conversion.'],
    },
    mvpScope: {
      mustHave: ['Inbox ingest', 'Reply draft', 'Nudge feed'],
      shouldHave: ['WhatsApp ingest'],
      later: ['Team collaboration'],
      explicitCuts: [{ item: 'Pipeline view', reason: 'Defeats the "no pipeline" promise.' }],
    },
    userStories: [
      { id: 'us1', title: 'Connect inbox', personaId: 'p1', story: 'As a solo consultant I want to connect my inbox so that nudges are accurate.', acceptanceCriteria: ['OAuth completes in <60s', 'First nudge appears within 5 minutes'], priority: 'must' },
      { id: 'us2', title: 'Draft reply', personaId: 'p1', story: 'As a solo consultant I want a drafted reply so that I can send it in one click.', acceptanceCriteria: ['Draft uses the right addressee', 'Tone matches recent replies'], priority: 'must' },
      { id: 'us3', title: 'Snooze nudge', personaId: 'p1', story: 'As a solo consultant I want to snooze a nudge so that I can act later.', acceptanceCriteria: ['Snooze persists across refresh', 'Snoozed nudges re-appear at chosen time'], priority: 'must' },
      { id: 'us4', title: 'Bulk dismiss', personaId: 'p1', story: 'As a solo consultant I want to dismiss many nudges at once so that I can clear noise.', acceptanceCriteria: ['Multi-select toggles state'], priority: 'should' },
    ],
    architectureBrief: {
      components: [
        { name: 'Inbox connector', responsibility: 'Pull Gmail/Outlook threads via OAuth.' },
        { name: 'Nudge engine', responsibility: 'Rank threads by next-best-action.' },
        { name: 'Draft generator', responsibility: 'Produce reply drafts via LLM.' },
      ],
      dataFlow: ['Inbox → ingest queue → embedding store → nudge engine → UI.'],
      integrations: ['Gmail API', 'Outlook Graph API'],
      storage: ['Postgres for thread metadata', 'Vector store for embeddings'],
      security: ['OAuth refresh tokens at rest encrypted with per-tenant DEK', 'No raw inbox content in logs'],
      scalabilityAssumptions: ['<100k threads per tenant in first 6 months.'],
    },
    roadmap: {
      weeks: [
        { week: 1, theme: 'Connect', deliverables: ['Gmail OAuth flow', 'Thread sync MVP'] },
        { week: 2, theme: 'Nudge', deliverables: ['First ranked nudge feed'] },
        { week: 3, theme: 'Draft', deliverables: ['LLM-drafted reply'] },
        { week: 4, theme: 'Polish', deliverables: ['Onboarding + analytics events'] },
      ],
      futureBacklog: ['WhatsApp ingest', 'Team mode'],
    },
    prototypeBrief: {
      pages: [
        { name: 'Onboarding', purpose: 'OAuth + first-run.' },
        { name: 'Nudge feed', purpose: 'Daily list of next actions.' },
        { name: 'Draft pane', purpose: 'Edit and send a drafted reply.' },
      ],
      flows: [
        { name: 'First connect', steps: ['Sign up', 'OAuth Gmail', 'See first nudge'] },
        { name: 'Send a reply', steps: ['Open nudge', 'Review draft', 'Send'] },
      ],
      uiComponents: ['NudgeCard', 'DraftEditor', 'OAuthButton'],
      demoScenario: 'Maya signs up, connects Gmail, sees a drafted reply within 5 minutes.',
    },
  };
}

function chatStub(...payloads: unknown[]): ChatFn {
  const fn = vi.fn();
  for (const p of payloads) {
    fn.mockResolvedValueOnce({
      content: JSON.stringify(p),
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      cost: { usd: 0.001, provider: 'openai', model: 'gpt-4' },
      cached: false,
    } satisfies ChatResponse);
  }
  return fn as unknown as ChatFn;
}

function fixedOpts(extra: Partial<ConstructorParameters<typeof BuildSquad>[1]> = {}) {
  return {
    model: 'gpt-4o-mini',
    ctx,
    now: () => new Date('2026-06-01T00:00:00.000Z'),
    generateId: () => 'bsq_test_001',
    ...extra,
  };
}

// ─────────────── Tests ──────────────────────────────────────────────────────

describe('BuildSquad — PROCEED', () => {
  it('produces a typed BuildSquadArtifactPack with all required PROCEED sections', async () => {
    const chat = chatStub(fakeDraft(), { critiques: [
      { role: 'pm', targetSection: 'mvp_scope', severity: 'info', comment: 'Explicit cuts are sharp; consider also cutting bulk import.', suggestion: 'Add bulk import to explicit cuts.' },
      { role: 'ux', targetSection: 'prototype_brief', severity: 'info', comment: 'Onboarding flow could surface privacy stance earlier.' },
      { role: 'architect', targetSection: 'architecture_brief', severity: 'warning', comment: 'Embedding store choice is not justified.' },
      { role: 'qa', targetSection: 'user_stories', severity: 'info', comment: 'Snooze story should specify timezone behaviour.' },
      { role: 'gtm', targetSection: 'product_vision', severity: 'info', comment: 'Success metrics need a leading indicator for week 1.' },
    ] });
    const bsq = new BuildSquad(chat, fixedOpts());
    const input: BuildSquadInput = { recommendation: rec('PROCEED') };
    const pack = await bsq.run(input);

    expect(pack.kind).toBe('BuildSquadArtifactPack');
    expect(pack.mode).toBe('proceed');
    expect(pack.artifactId).toBe('bsq_test_001');
    expect(pack.ventureId).toBe('v-faceless-crm');
    expect(pack.inputReferences.recommendationId).toBe('rec_001');
    expect(pack.prd?.requirements.length).toBeGreaterThanOrEqual(2);
    expect(pack.mvpScope?.explicitCuts.length).toBeGreaterThanOrEqual(1);
    expect((pack.userStories ?? []).filter((s) => s.priority === 'must').length).toBeGreaterThanOrEqual(3);
    expect(pack.architectureBrief?.components.length).toBeGreaterThanOrEqual(3);
    expect(pack.roadmap?.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(pack.prototypeBrief?.pages.length).toBeGreaterThanOrEqual(2);
    expect(pack.kill).toBeUndefined();
    expect(pack.pivot).toBeUndefined();
    expect(pack.agentCritiques.length).toBeGreaterThanOrEqual(5);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('always returns deterministic critiques even when the critique LLM fails', async () => {
    const chat = vi.fn()
      .mockResolvedValueOnce({
        content: JSON.stringify(fakeDraft()),
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        cost: { usd: 0, provider: 'openai', model: 'gpt-4o-mini' },
        cached: false,
      } satisfies ChatResponse)
      .mockRejectedValueOnce(new Error('critique timeout')) as unknown as ChatFn;
    const bsq = new BuildSquad(chat, fixedOpts());
    const pack = await bsq.run({ recommendation: rec('PROCEED') });
    expect(pack.mode).toBe('proceed');
    expect(pack.rationale.some((r) => /critique LLM call failed/i.test(r))).toBe(true);
    // The deterministic pass returns an empty list when nothing fails — verify it ran without throwing.
    expect(Array.isArray(pack.agentCritiques)).toBe(true);
  });

  it('the deterministic critique pass flags missing acceptance criteria', () => {
    const draft = fakeDraft();
    draft.userStories![0]!.acceptanceCriteria = [];
    const crits = runDeterministicCritiqueChecks(draft);
    expect(crits.some((c) => c.role === 'pm' && c.severity === 'blocker' && /acceptance criteria/i.test(c.comment))).toBe(true);
  });

  it('throws BuildSquadError when the drafting LLM fails', async () => {
    const chat = vi.fn().mockRejectedValueOnce(new Error('rate limited')) as unknown as ChatFn;
    const bsq = new BuildSquad(chat, fixedOpts());
    await expect(bsq.run({ recommendation: rec('PROCEED') })).rejects.toBeInstanceOf(BuildSquadError);
  });
});

describe('BuildSquad — PIVOT', () => {
  it('produces pivot output via a single LLM call and skips PRD/MVP/etc.', async () => {
    const chat = chatStub({
      pivotBrief: 'Pivot toward a higher-touch service before product.',
      revisedProblemStatement: 'Solo operators want done-for-you follow-up, not a tool.',
      revisedMvpDirection: 'Run a 4-week concierge pilot with 10 solo founders.',
      validationPlan: [
        { id: 'vp1', title: 'Concierge pilot', rationale: 'Validate willingness to pay for outcome.' },
        { id: 'vp2', title: 'Price ladder test', rationale: 'Find the right anchor.' },
        { id: 'vp3', title: 'Channel test on Indie Hackers', rationale: 'Validate acquisition.' },
      ],
    });
    const bsq = new BuildSquad(chat, fixedOpts());
    const pack = await bsq.run({ recommendation: rec('PIVOT') });
    expect(pack.mode).toBe('pivot');
    expect(pack.pivot?.validationPlan.length).toBeGreaterThanOrEqual(3);
    expect(pack.pivot?.pivotBrief).toMatch(/concierge|service/i);
    expect(pack.prd).toBeUndefined();
    expect(pack.userStories).toBeUndefined();
    expect(pack.architectureBrief).toBeUndefined();
    expect(pack.kill).toBeUndefined();
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it('falls back to deterministic pivot brief if the LLM fails', async () => {
    const chat = vi.fn().mockRejectedValueOnce(new Error('boom')) as unknown as ChatFn;
    const bsq = new BuildSquad(chat, fixedOpts());
    const pack = await bsq.run({ recommendation: rec('PIVOT') });
    expect(pack.mode).toBe('pivot');
    expect(pack.pivot?.pivotBrief.length).toBeGreaterThan(0);
    expect(pack.pivot?.validationPlan.length).toBeGreaterThan(0);
    expect(pack.rationale.some((r) => /Pivot LLM call failed/i.test(r))).toBe(true);
  });
});

describe('BuildSquad — KILL', () => {
  it('produces kill output without a single LLM call', async () => {
    const chat = vi.fn() as unknown as ChatFn;
    const bsq = new BuildSquad(chat, fixedOpts());
    const pack = await bsq.run({ recommendation: rec('KILL') });
    expect(pack.mode).toBe('kill');
    expect(pack.kill?.killRationale.length).toBeGreaterThan(0);
    expect(pack.kill?.alternativeIdeas.length).toBeGreaterThan(0);
    expect(pack.kill?.validationGaps.length).toBeGreaterThan(0);
    expect(pack.prd).toBeUndefined();
    expect(pack.pivot).toBeUndefined();
    expect(pack.userStories).toBeUndefined();
    expect((chat as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});

describe('BuildSquad — guards & contract', () => {
  it('throws when no recommendation is supplied', async () => {
    const bsq = new BuildSquad(vi.fn() as unknown as ChatFn, fixedOpts());
    // @ts-expect-error intentionally missing
    await expect(bsq.run({})).rejects.toBeInstanceOf(BuildSquadError);
  });

  it('every agent in BUILDSQUAD_AGENTS has a non-empty checklist and review list', () => {
    expect(BUILDSQUAD_AGENTS.length).toBe(7);
    for (const a of BUILDSQUAD_AGENTS) {
      expect(a.checklist.length).toBeGreaterThan(0);
      expect(a.reviewsSections.length).toBeGreaterThan(0);
    }
  });

  it('no secrets in serialised artifact pack', async () => {
    const chat = chatStub(fakeDraft(), { critiques: [] });
    const bsq = new BuildSquad(chat, fixedOpts());
    const pack = await bsq.run({ recommendation: rec('PROCEED') });
    const json = JSON.stringify(pack);
    expect(json).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    expect(json).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
  });
});

describe('BuildSquad — evaluation', () => {
  it('rates a well-formed PROCEED pack highly', async () => {
    const chat = chatStub(fakeDraft(), { critiques: [
      { role: 'pm', targetSection: 'mvp_scope', severity: 'info', comment: 'good' },
      { role: 'ux', targetSection: 'prototype_brief', severity: 'info', comment: 'good' },
      { role: 'architect', targetSection: 'architecture_brief', severity: 'info', comment: 'good' },
      { role: 'qa', targetSection: 'user_stories', severity: 'info', comment: 'good' },
      { role: 'gtm', targetSection: 'product_vision', severity: 'info', comment: 'good' },
    ] });
    const bsq = new BuildSquad(chat, fixedOpts());
    const pack = await bsq.run({ recommendation: rec('PROCEED') });
    const ev = evaluateArtifactPack(pack);
    expect(ev.overallScore).toBeGreaterThan(0.8);
    expect(ev.completeness).toBe(1);
    expect(ev.storyQuality).toBeCloseTo(1);
  });

  it('rates a sparse PROCEED pack low', () => {
    const sparse = {
      kind: 'BuildSquadArtifactPack' as const,
      artifactId: 'x',
      ventureId: 'v',
      createdAt: 'now',
      mode: 'proceed' as const,
      inputReferences: { ventureId: 'v', recommendationId: 'r' },
      productVision: { problem: '', targetUsers: [], productPromise: '', whyNow: '', differentiation: [], successMetrics: [] },
      agentCritiques: [],
      rationale: [],
    };
    const ev = evaluateArtifactPack(sparse);
    expect(ev.completeness).toBeLessThan(0.5);
    expect(ev.overallScore).toBeLessThan(0.5);
    expect(ev.warnings.length).toBeGreaterThan(0);
  });
});
