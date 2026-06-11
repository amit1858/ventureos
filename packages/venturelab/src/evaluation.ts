/**
 * Quality evaluation for a VentureRecommendation. Pure function, deterministic.
 *
 * Five sub-scores (each 0..1):
 *   - recommendationQuality: executive summary length + rationale count
 *   - evidenceQuality:        evidence items are specific + attributed
 *   - assumptionQuality:      assumptions have validation strategies, not boilerplate
 *   - riskQuality:            risks have non-trivial mitigations
 *   - scoreConsistency:       supporting evidence agrees with score direction
 *   - decisionConsistency:    composite score profile matches decision
 *
 * Plus warnings for human review.
 */
import { decide } from './decision';
import type {
  VentureAssumption,
  VentureEvidence,
  VentureRecommendation,
  VentureRecommendationEvaluation,
  VentureRisk,
  VentureScore,
} from './types';

export function evaluateVentureLab(rec: VentureRecommendation): VentureRecommendationEvaluation {
  const warnings: string[] = [];

  const recommendationQuality = scoreRecommendationQuality(rec, warnings);
  const evidenceQuality = scoreEvidenceQuality(rec.evidence.concat(rec.counterSignals), warnings);
  const assumptionQuality = scoreAssumptionQuality(rec.assumptions, warnings);
  const riskQuality = scoreRiskQuality(rec.risks, warnings);
  const scoreConsistency = scoreScoreConsistency(rec.scores, warnings);
  const decisionConsistency = scoreDecisionConsistency(rec, warnings);

  const overallScore = clamp01(
    0.20 * recommendationQuality +
    0.20 * evidenceQuality +
    0.15 * assumptionQuality +
    0.15 * riskQuality +
    0.15 * scoreConsistency +
    0.15 * decisionConsistency,
  );

  return {
    recommendationQuality,
    evidenceQuality,
    assumptionQuality,
    riskQuality,
    scoreConsistency,
    decisionConsistency,
    warnings,
    overallScore,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreRecommendationQuality(rec: VentureRecommendation, warnings: string[]): number {
  let s = 0;
  if (rec.executiveSummary.length > 80) s += 0.4;
  else if (rec.executiveSummary.length > 0) s += 0.2;
  else warnings.push('Executive summary is empty.');

  if (rec.decisionRationale.length >= 3) s += 0.4;
  else if (rec.decisionRationale.length >= 1) s += 0.2;
  else warnings.push('Decision rationale has no entries.');

  if (rec.scores.length >= 6) s += 0.2;
  else warnings.push(`Only ${rec.scores.length} dimensions scored (expected at least 6).`);

  return clamp01(s);
}

function scoreEvidenceQuality(evidence: VentureEvidence[], warnings: string[]): number {
  if (evidence.length === 0) {
    warnings.push('No top-level evidence items.');
    return 0;
  }
  const specific = evidence.filter((e) => e.quote.length >= 15 && e.source.length > 0).length;
  const ratio = specific / evidence.length;
  if (ratio < 0.5) warnings.push('More than half of evidence items lack a specific quote or source.');
  return clamp01(0.5 * ratio + 0.5 * Math.min(1, evidence.length / 6));
}

function scoreAssumptionQuality(assumptions: VentureAssumption[], warnings: string[]): number {
  if (assumptions.length === 0) {
    warnings.push('No assumptions surfaced.');
    return 0;
  }
  const withStrategy = assumptions.filter((a) => a.validationStrategy.length >= 10).length;
  const ratio = withStrategy / assumptions.length;
  if (ratio < 0.7) warnings.push('Many assumptions lack a concrete validation strategy.');
  return clamp01(0.5 * ratio + 0.5 * Math.min(1, assumptions.length / 6));
}

function scoreRiskQuality(risks: VentureRisk[], warnings: string[]): number {
  if (risks.length === 0) {
    warnings.push('Risk register is empty.');
    return 0.3;
  }
  const withMitigation = risks.filter((r) => r.mitigation.length >= 10).length;
  const ratio = withMitigation / risks.length;
  if (ratio < 0.8) warnings.push('Some risks lack a non-trivial mitigation.');
  return clamp01(0.6 * ratio + 0.4 * Math.min(1, risks.length / 4));
}

function scoreScoreConsistency(scores: VentureScore[], warnings: string[]): number {
  if (scores.length === 0) return 0;
  let consistent = 0;
  for (const s of scores) {
    const sup = s.supportingEvidence.length;
    const opp = s.opposingEvidence.length;
    const expectedHigh = s.higherIsBetter ? s.score >= 60 : s.score <= 40;
    if (sup + opp === 0) continue; // no evidence to judge
    if (expectedHigh && sup >= opp) consistent += 1;
    else if (!expectedHigh && opp >= sup) consistent += 1;
    else if (Math.abs(50 - s.score) < 15) consistent += 0.5;
    else warnings.push(`Score ${s.dimension}=${s.score} appears inconsistent with its evidence balance.`);
  }
  return clamp01(consistent / scores.length);
}

function scoreDecisionConsistency(rec: VentureRecommendation, warnings: string[]): number {
  const recomputed = decide(rec.scores);
  if (recomputed.decision === rec.decision) return 1.0;
  warnings.push(
    `Decision ${rec.decision} does not match the rule-engine output ${recomputed.decision} for the given scores.`,
  );
  // PIVOT is the soft middle — half-credit for adjacent decisions.
  const order: Record<string, number> = { KILL: 0, PIVOT: 1, PROCEED: 2 };
  const distance = Math.abs(order[rec.decision]! - order[recomputed.decision]!);
  return distance === 1 ? 0.5 : 0;
}
