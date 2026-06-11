/**
 * Deterministic dimension analyzers.
 *
 * Each analyzer is a pure function (signals + upstream data) → VentureScore.
 * Scores are 0..100. For risk/friction dimensions (`adoptionFriction`,
 * `executionRisk`), higher = worse, and `higherIsBetter` is false; the
 * decision engine inverts these when composing the overall score.
 *
 * Analyzers MUST be deterministic — no Math.random, no Date.now, no LLM calls.
 */
import type {
  BuyingCommitteeDeliberation,
  BuyingCommitteeTranscript,
  PersonaLabPersona,
  ScoreDimension,
  SignalsPayload,
  VentureEvidence,
  VentureLabInput,
  VentureScore,
} from './types';

const URGENCY_KEYWORDS = [
  'urgent', 'urgency', 'asap', 'immediately', 'today', 'this week',
  'losing', 'bleeding', 'every day', 'right now', 'critical', 'firefight',
  'deadline', 'must have', 'need now',
];
const WTP_KEYWORDS = [
  'pay', 'budget', 'roi', 'spend', 'invest', 'price', 'cost', 'worth',
  'value', 'license', 'subscription', '$', 'per month', 'per seat', 'annual contract',
];
const FRICTION_KEYWORDS = [
  'onboarding', 'setup', 'integration', 'configure', 'migrate', 'learning curve',
  'data entry', 'training', 'change management', 'workflow change', 'switching cost',
  'complex', 'too many steps', 'manual', 'painful to set up',
];
const RISK_KEYWORDS = [
  'technical', 'scalability', 'security', 'compliance', 'gdpr', 'hipaa',
  'integration', 'rate limit', 'data residency', 'latency', 'reliability',
  'we don\'t know how', 'unproven',
];

function countKeywordHits(text: string, keywords: readonly string[]): number {
  const t = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) if (t.includes(kw)) hits += 1;
  return hits;
}

function evidenceText(ev: VentureEvidence[]): string {
  return ev.map((e) => e.quote).join(' ');
}

function dedupeEvidence(...lists: VentureEvidence[][]): VentureEvidence[] {
  const out: VentureEvidence[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const e of list) {
      const key = `${e.source}::${e.quote}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function score(
  dimension: ScoreDimension,
  value: number,
  higherIsBetter: boolean,
  explanation: string,
  supporting: VentureEvidence[],
  opposing: VentureEvidence[],
): VentureScore {
  return {
    dimension,
    score: clamp(value),
    higherIsBetter,
    explanation,
    supportingEvidence: supporting,
    opposingEvidence: opposing,
  };
}

// ───────────── problemStrength ─────────────
export function analyzeProblemStrength(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.problemEvidence;
  const painPointsTotal = input.personas.reduce((n, p) => n + (p.painPoints?.length ?? 0), 0);
  const specificity = input.personas.reduce(
    (n, p) => n + (p.painPoints?.filter((x) => x.length > 40).length ?? 0),
    0,
  );
  // 0..100: evidence (max ~60) + persona pain depth (max ~40)
  const evidenceScore = Math.min(60, ev.length * 10);
  const painScore = Math.min(40, painPointsTotal * 4 + specificity * 3);
  const total = evidenceScore + painScore;
  const explanation = `${ev.length} evidence items, ${painPointsTotal} persona pain points (${specificity} specific).`;
  return score('problemStrength', total, true, explanation, ev, []);
}

// ───────────── buyerUrgency ─────────────
export function analyzeBuyerUrgency(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.urgencyEvidence;
  const triggers = input.personas.reduce((n, p) => n + (p.buyingTriggers?.length ?? 0), 0);
  const keywordHits = countKeywordHits(evidenceText(ev), URGENCY_KEYWORDS);
  // 0..100
  const evidenceScore = Math.min(50, ev.length * 12);
  const triggerScore = Math.min(30, triggers * 6);
  const keywordScore = Math.min(20, keywordHits * 5);
  const total = evidenceScore + triggerScore + keywordScore;
  const explanation = `${ev.length} urgency signals, ${triggers} buying triggers across personas, ${keywordHits} urgency keywords matched.`;
  return score('buyerUrgency', total, true, explanation, ev, []);
}

// ───────────── willingnessToPay ─────────────
export function analyzeWillingnessToPay(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.willingnessToPayEvidence;
  const keywordHits = countKeywordHits(evidenceText(ev), WTP_KEYWORDS);
  const committee = input.committee?.deliberation;
  let committeeBoost = 0;
  let opposing: VentureEvidence[] = [];
  if (committee) {
    const supports = committee.phases.consensus.filter(
      (o) => o.position === 'support' || o.position === 'support_with_concerns' || o.position === 'pilot_first',
    ).length;
    const rejects = committee.phases.consensus.filter((o) => o.position === 'reject').length;
    const total = committee.phases.consensus.length || 1;
    committeeBoost = (supports / total) * 30 - (rejects / total) * 20;
    if (rejects > 0) {
      opposing = committee.unresolvedObjections.slice(0, 3).map((q, i) => ({
        kind: 'committee' as const,
        source: `committee.unresolvedObjections[${i}]`,
        quote: q,
        weight: 0.6,
      }));
    }
  }
  const evidenceScore = Math.min(45, ev.length * 10);
  const keywordScore = Math.min(25, keywordHits * 4);
  const total = evidenceScore + keywordScore + committeeBoost;
  const explanation = `${ev.length} WTP signals, ${keywordHits} pricing keywords, committee adjustment ${committeeBoost.toFixed(0)}.`;
  return score('willingnessToPay', total, true, explanation, ev, opposing);
}

// ───────────── differentiation ─────────────
export function analyzeDifferentiation(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.differentiationEvidence;
  const wedge = input.ideaBrief?.wedge?.trim() ?? '';
  const wedgeLen = wedge.length;
  // 0..100
  const evidenceScore = Math.min(50, ev.length * 12);
  const wedgeScore = wedgeLen === 0 ? 0 : wedgeLen < 40 ? 15 : wedgeLen < 120 ? 30 : 40;
  const additional = input.brief.additionalContext ? 10 : 0;
  const total = evidenceScore + wedgeScore + additional;
  const explanation = `${ev.length} differentiation signals; wedge length ${wedgeLen} chars${additional ? '; additional context provided' : ''}.`;
  return score('differentiation', total, true, explanation, ev, []);
}

// ───────────── adoptionFriction (higher = worse) ─────────────
export function analyzeAdoptionFriction(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.adoptionFrictionEvidence;
  const keywordHits = countKeywordHits(evidenceText(ev), FRICTION_KEYWORDS);
  // Objections that mention onboarding / workflow / migration push friction up.
  const objectionHits = input.personas.reduce((n, p) => {
    const objText = (p.objections || []).join(' ').toLowerCase();
    let h = 0;
    for (const kw of FRICTION_KEYWORDS) if (objText.includes(kw)) h += 1;
    return n + h;
  }, 0);
  const evidenceScore = Math.min(50, ev.length * 12);
  const keywordScore = Math.min(30, keywordHits * 5);
  const objectionScore = Math.min(20, objectionHits * 5);
  const total = evidenceScore + keywordScore + objectionScore;
  const explanation = `${ev.length} friction signals, ${keywordHits} friction keywords in evidence, ${objectionHits} friction-themed persona objections.`;
  return score('adoptionFriction', total, false, explanation, ev, []);
}

// ───────────── committeeConfidence (deterministic from deliberation) ─────────────
export function analyzeCommitteeConfidence(
  _signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const committee = input.committee;
  if (!committee || !committee.deliberation) {
    return score(
      'committeeConfidence',
      50,
      true,
      'No buying committee deliberation provided; neutral baseline of 50.',
      [],
      [],
    );
  }
  return scoreCommittee(committee, committee.deliberation);
}

function scoreCommittee(
  committee: BuyingCommitteeTranscript,
  d: BuyingCommitteeDeliberation,
): VentureScore {
  const base = {
    strong: 85,
    moderate: 65,
    weak: 45,
    split: 25,
  }[d.consensusLevel];
  const confidenceFactor = Math.max(0, Math.min(1, d.confidenceScore));
  const unresolvedPenalty = Math.min(40, d.unresolvedObjections.length * 10);
  const decisionBoost = committee.decision === 'buy' ? 5 : committee.decision === 'pilot' ? 0 : -15;
  const raw = base * (0.5 + 0.5 * confidenceFactor) - unresolvedPenalty + decisionBoost;

  const supporting: VentureEvidence[] = d.strongestSupportingArguments.slice(0, 3).map((q, i) => ({
    kind: 'committee',
    source: `committee.strongestSupportingArguments[${i}]`,
    quote: q,
    weight: 0.8,
  }));
  const opposing: VentureEvidence[] = d.strongestOpposingArguments.slice(0, 3).map((q, i) => ({
    kind: 'committee',
    source: `committee.strongestOpposingArguments[${i}]`,
    quote: q,
    weight: 0.8,
  }));
  const explanation = `Consensus=${d.consensusLevel}, model confidence=${d.confidenceScore.toFixed(2)}, ${d.unresolvedObjections.length} unresolved objections, decision=${committee.decision}.`;
  return score('committeeConfidence', raw, true, explanation, supporting, opposing);
}

// ───────────── executionRisk (higher = worse) ─────────────
export function analyzeExecutionRisk(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.executionRiskEvidence;
  const keywordHits = countKeywordHits(evidenceText(ev), RISK_KEYWORDS);
  // Committee dependency / technical / integration challenges push risk up.
  let challengeRisk = 0;
  if (input.committee?.deliberation) {
    const d = input.committee.deliberation;
    challengeRisk = d.phases.challenges.filter((c) =>
      c.topic === 'workflow' || c.topic === 'trust' || c.topic === 'onboarding',
    ).length * 4;
  }
  const evidenceScore = Math.min(50, ev.length * 12);
  const keywordScore = Math.min(30, keywordHits * 5);
  const challengeScore = Math.min(20, challengeRisk);
  const total = evidenceScore + keywordScore + challengeScore;
  const explanation = `${ev.length} execution-risk signals, ${keywordHits} risk keywords, committee challenges contributing ${challengeScore}.`;
  return score('executionRisk', total, false, explanation, ev, []);
}

// ───────────── marketClarity ─────────────
export function analyzeMarketClarity(
  signals: SignalsPayload,
  input: VentureLabInput,
): VentureScore {
  const ev = signals.marketClarityEvidence;
  const briefScore = scoreBriefCompleteness(input);
  const personaRoles = new Set(input.personas.map((p) => p.role.toLowerCase()));
  const roleDiversity = Math.min(30, personaRoles.size * 7);
  const evidenceScore = Math.min(30, ev.length * 8);
  const total = briefScore + roleDiversity + evidenceScore;
  const explanation = `Brief completeness ${briefScore}/40, ${personaRoles.size} distinct roles, ${ev.length} clarity signals.`;
  return score('marketClarity', total, true, explanation, ev, []);
}

function scoreBriefCompleteness(input: VentureLabInput): number {
  const b = input.brief;
  let s = 0;
  if (b.businessIdea?.length > 40) s += 10;
  if (b.targetMarket?.length > 30) s += 10;
  if (b.customerType?.length > 0) s += 5;
  if (b.region?.length > 0) s += 5;
  if (b.businessSize?.length > 0) s += 5;
  if (b.additionalContext && b.additionalContext.length > 0) s += 5;
  return Math.min(40, s);
}

// ───────────── analyze-all helper ─────────────
export function analyzeAll(signals: SignalsPayload, input: VentureLabInput): VentureScore[] {
  return [
    analyzeProblemStrength(signals, input),
    analyzeBuyerUrgency(signals, input),
    analyzeWillingnessToPay(signals, input),
    analyzeDifferentiation(signals, input),
    analyzeAdoptionFriction(signals, input),
    analyzeCommitteeConfidence(signals, input),
    analyzeExecutionRisk(signals, input),
    analyzeMarketClarity(signals, input),
  ];
}

export { dedupeEvidence };
