/**
 * Rule-based decision engine.
 *
 * Pure function over dimension scores → (overall composite score, decision,
 * decision rationale, confidence). NO LLM. Same input → same output.
 *
 * The decision is intentionally explainable: every rule that fires contributes
 * a plain-English entry to `decisionRationale`.
 */
import type {
  ScoreDimension,
  VentureDecision,
  VentureScore,
} from './types';

// Weights for the composite score. Positive-direction dimensions add, friction/risk subtract.
const WEIGHTS: Record<ScoreDimension, number> = {
  problemStrength: 0.20,
  buyerUrgency: 0.15,
  willingnessToPay: 0.20,
  differentiation: 0.10,
  committeeConfidence: 0.15,
  marketClarity: 0.05,
  adoptionFriction: 0.075,   // applied as (100 - score)
  executionRisk: 0.075,      // applied as (100 - score)
};

export interface DecisionResult {
  decision: VentureDecision;
  overallScore: number;
  confidenceScore: number;
  rationale: string[];
}

function getScore(scores: VentureScore[], dim: ScoreDimension): VentureScore | undefined {
  return scores.find((s) => s.dimension === dim);
}

function val(scores: VentureScore[], dim: ScoreDimension, fallback = 50): number {
  return getScore(scores, dim)?.score ?? fallback;
}

export function computeOverallScore(scores: VentureScore[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of scores) {
    const w = WEIGHTS[s.dimension];
    if (w == null) continue;
    const contribution = s.higherIsBetter ? s.score : (100 - s.score);
    weightedSum += contribution * w;
    totalWeight += w;
  }
  return Math.round(totalWeight === 0 ? 0 : weightedSum / totalWeight);
}

/**
 * Confidence in the score itself (NOT in the decision).
 *
 * Combines:
 * - evidence coverage (how many dimensions have ≥ 2 supporting items)
 * - committee confidence (if available)
 * - score variance (extreme disagreement between dimensions → lower confidence)
 */
export function computeConfidenceScore(scores: VentureScore[]): number {
  const covered = scores.filter(
    (s) => s.supportingEvidence.length + s.opposingEvidence.length >= 2,
  ).length;
  const coverage = covered / Math.max(1, scores.length); // 0..1

  const committee = getScore(scores, 'committeeConfidence');
  const committeeFactor = committee ? committee.score / 100 : 0.5;

  // Score variance across positive-direction dimensions.
  const positives = scores
    .filter((s) => s.higherIsBetter)
    .map((s) => s.score);
  let variancePenalty = 0;
  if (positives.length > 1) {
    const mean = positives.reduce((a, b) => a + b, 0) / positives.length;
    const variance = positives.reduce((a, b) => a + (b - mean) ** 2, 0) / positives.length;
    const stddev = Math.sqrt(variance);
    variancePenalty = Math.min(0.3, stddev / 100);
  }

  const raw = 0.5 * coverage + 0.4 * committeeFactor + 0.1 - variancePenalty;
  return Math.max(0, Math.min(1, raw));
}

export function decide(scores: VentureScore[]): DecisionResult {
  const overallScore = computeOverallScore(scores);
  const confidenceScore = computeConfidenceScore(scores);
  const rationale: string[] = [];

  const problem = val(scores, 'problemStrength');
  const urgency = val(scores, 'buyerUrgency');
  const wtp = val(scores, 'willingnessToPay');
  const diff = val(scores, 'differentiation');
  const friction = val(scores, 'adoptionFriction');
  const committee = val(scores, 'committeeConfidence');
  const risk = val(scores, 'executionRisk');

  // ── KILL rules (any one is sufficient) ──
  const killReasons: string[] = [];
  if (problem < 35) killReasons.push(`Problem strength is too weak (${problem}/100) — there is no clear pain to solve.`);
  if (urgency < 25) killReasons.push(`Buyer urgency is too low (${urgency}/100) — no compelling reason to buy now.`);
  if (committee < 25) killReasons.push(`Buying committee confidence is critically low (${committee}/100).`);
  if (friction > 80 && wtp < 40) killReasons.push(`Severe adoption friction (${friction}/100) combined with weak willingness to pay (${wtp}/100).`);
  if (risk > 85) killReasons.push(`Execution risk is prohibitively high (${risk}/100).`);

  if (killReasons.length > 0) {
    rationale.push(`Recommendation: KILL — composite score ${overallScore}/100.`);
    rationale.push(...killReasons);
    return { decision: 'KILL', overallScore, confidenceScore, rationale };
  }

  // ── PROCEED rules (all must hold) ──
  const proceedHolds =
    overallScore >= 68 &&
    committee >= 60 &&
    risk < 65 &&
    problem >= 50 &&
    urgency >= 40 &&
    wtp >= 45;

  if (proceedHolds) {
    rationale.push(`Recommendation: PROCEED — composite score ${overallScore}/100.`);
    rationale.push(`Problem strength ${problem}/100 and willingness to pay ${wtp}/100 both clear the proceed bar.`);
    rationale.push(`Buying committee confidence ${committee}/100 and execution risk ${risk}/100 are within acceptable bounds.`);
    if (diff >= 60) rationale.push(`Differentiation ${diff}/100 supports a defensible position.`);
    if (friction > 50) rationale.push(`Note: adoption friction is ${friction}/100 — invest in onboarding.`);
    return { decision: 'PROCEED', overallScore, confidenceScore, rationale };
  }

  // ── PIVOT (default for ambiguity) ──
  rationale.push(`Recommendation: PIVOT — composite score ${overallScore}/100, mixed signal profile.`);
  if (problem >= 50 && wtp < 45) rationale.push(`Strong problem (${problem}/100) but weak willingness to pay (${wtp}/100) — revisit pricing or persona.`);
  if (urgency < 40) rationale.push(`Urgency ${urgency}/100 is below the proceed bar — investigate a more time-pressed buyer.`);
  if (diff < 50) rationale.push(`Differentiation ${diff}/100 is weak — sharpen the wedge before scaling.`);
  if (committee < 60) rationale.push(`Buying committee confidence ${committee}/100 is below proceed bar — identify the swing persona.`);
  if (friction > 60) rationale.push(`Adoption friction ${friction}/100 — onboarding needs to be redesigned.`);
  if (risk >= 65) rationale.push(`Execution risk ${risk}/100 — derisk before committing.`);
  return { decision: 'PIVOT', overallScore, confidenceScore, rationale };
}
