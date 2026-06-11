/**
 * Deterministic risk-register generator.
 *
 * Combines:
 *   1. Low-scoring positive dimensions → risk of failure on that axis.
 *   2. High-scoring friction/risk dimensions → adoption / execution risk.
 *   3. Unresolved committee objections → category-specific risks.
 *   4. Risky-typed assumptions → "if this assumption is wrong" risk.
 */
import type {
  VentureAssumption,
  VentureLabInput,
  VentureRisk,
  VentureScore,
} from './types';

function getScore(scores: VentureScore[], dimension: VentureScore['dimension']) {
  return scores.find((s) => s.dimension === dimension);
}

export function generateRiskRegister(
  scores: VentureScore[],
  assumptions: VentureAssumption[],
  input: VentureLabInput,
): VentureRisk[] {
  const risks: VentureRisk[] = [];
  let idCounter = 1;
  const newId = () => `r${idCounter++}`;

  const dim = (d: VentureScore['dimension']) => getScore(scores, d);

  const problem = dim('problemStrength');
  if (problem && problem.score < 50) {
    risks.push({
      id: newId(),
      risk: `Insufficient evidence the problem is acute. Personas may not actually feel this pain at the intensity required.`,
      impact: problem.score < 35 ? 'high' : 'medium',
      likelihood: 'high',
      mitigation: 'Run 8–12 structured discovery interviews specifically probing pain intensity, frequency, and current workarounds.',
      relatedDimension: 'problemStrength',
    });
  }

  const urgency = dim('buyerUrgency');
  if (urgency && urgency.score < 45) {
    risks.push({
      id: newId(),
      risk: 'Buyer has no compelling event — purchase is "nice to have", not "now".',
      impact: 'high',
      likelihood: 'medium',
      mitigation: 'Identify the trigger event that forces a buy decision; reposition messaging around that trigger.',
      relatedDimension: 'buyerUrgency',
    });
  }

  const wtp = dim('willingnessToPay');
  if (wtp && wtp.score < 50) {
    risks.push({
      id: newId(),
      risk: 'Insufficient signal that buyers will pay the proposed price.',
      impact: 'high',
      likelihood: wtp.score < 35 ? 'high' : 'medium',
      mitigation: 'Run a Van Westendorp or smoke-test landing page with concrete pricing; collect payment intent (not opinions).',
      relatedDimension: 'willingnessToPay',
    });
  }

  const friction = dim('adoptionFriction');
  if (friction && friction.score > 60) {
    risks.push({
      id: newId(),
      risk: `Adoption friction is high (${friction.score}/100) — even motivated buyers may drop off during onboarding.`,
      impact: friction.score > 80 ? 'high' : 'medium',
      likelihood: 'high',
      mitigation: 'Storyboard the first-30-minutes experience; remove any required configuration, imports, or setup steps.',
      relatedDimension: 'adoptionFriction',
    });
  }

  const risk = dim('executionRisk');
  if (risk && risk.score > 60) {
    risks.push({
      id: newId(),
      risk: `Execution risk is elevated (${risk.score}/100) — technical, integration, or trust hurdles may delay launch.`,
      impact: risk.score > 80 ? 'high' : 'medium',
      likelihood: 'medium',
      mitigation: 'Run a technical spike on the riskiest dependency before committing to the v1 scope.',
      relatedDimension: 'executionRisk',
    });
  }

  const committee = dim('committeeConfidence');
  if (committee && committee.score < 50) {
    risks.push({
      id: newId(),
      risk: 'Buying committee did not converge — purchase decisions in target accounts will stall.',
      impact: 'high',
      likelihood: 'high',
      mitigation: 'Identify the blocking persona and design a specific objection-handling collateral / proof-of-value pilot for them.',
      relatedDimension: 'committeeConfidence',
    });
  }

  const diff = dim('differentiation');
  if (diff && diff.score < 45) {
    risks.push({
      id: newId(),
      risk: 'Differentiation is unclear — incumbents may absorb the wedge before traction is reached.',
      impact: 'medium',
      likelihood: 'medium',
      mitigation: 'Write the 1-sentence "only us" positioning statement and test it with 10 prospects in cold outreach.',
      relatedDimension: 'differentiation',
    });
  }

  // Risks from unresolved committee objections (de-duplicated by quote).
  const unresolved = input.committee?.deliberation?.unresolvedObjections ?? [];
  for (const objection of unresolved.slice(0, 4)) {
    risks.push({
      id: newId(),
      risk: `Unresolved committee objection: ${objection}`,
      impact: 'medium',
      likelihood: 'medium',
      mitigation: 'Surface and answer this objection in sales collateral and product copy before pilots begin.',
      relatedDimension: 'committeeConfidence',
    });
  }

  // Risks from risky-typed assumptions.
  for (const a of assumptions) {
    if (a.type === 'risky' && (a.riskLevel === 'high' || a.riskLevel === 'critical')) {
      risks.push({
        id: newId(),
        risk: `If assumption is wrong: "${a.text}"`,
        impact: a.riskLevel === 'critical' ? 'high' : 'medium',
        likelihood: a.confidence === 'low' ? 'high' : 'medium',
        mitigation: a.validationStrategy || 'Design a falsifiable test for this assumption.',
        relatedAssumptionIds: [a.id],
      });
    }
  }

  return risks;
}
