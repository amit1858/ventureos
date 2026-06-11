/**
 * KILL path. Pure-deterministic: no LLM call.
 *
 * Reads the VentureRecommendation's decisionRationale, evidence and
 * counterSignals to produce a kill rationale + learning summary + alternative
 * idea seeds + validation gaps. Alternatives are seeded from low-scoring
 * dimensions, not invented.
 */
import type {
  BuildSquadInput,
  BuildSquadKillOutput,
  BuildSquadProductVision,
  VentureRecommendation,
} from './types';

const DIMENSION_TO_ALTERNATIVE: Partial<Record<string, { title: string; rationale: string }>> = {
  problemStrength: {
    title: 'Reframe the problem with a different customer slice.',
    rationale: 'Problem strength scored low; the current slice may not have an urgent pain.',
  },
  willingnessToPay: {
    title: 'Test a service or done-for-you delivery before product.',
    rationale: 'Willingness to pay scored low; validate budget via a higher-touch motion first.',
  },
  differentiation: {
    title: 'Narrow to a workflow incumbents cannot or will not serve.',
    rationale: 'Differentiation scored low; pick a wedge an incumbent will rationally ignore.',
  },
  marketClarity: {
    title: 'Pick one segment and one geography for a six-week pilot.',
    rationale: 'Market clarity scored low; reduce the addressable surface area until evidence sharpens.',
  },
  adoptionFriction: {
    title: 'Strip the product to a single-screen experience or a one-line integration.',
    rationale: 'Adoption friction scored high; remove every step that is not load-bearing.',
  },
};

export function buildKillOutput(rec: VentureRecommendation): BuildSquadKillOutput {
  const killRationale = rec.decisionRationale.length > 0
    ? [...rec.decisionRationale]
    : ['VentureLab returned a KILL decision but did not provide a rationale list.'];

  const learningSummary: string[] = [];
  if (rec.executiveSummary) learningSummary.push(rec.executiveSummary);
  for (const cs of rec.counterSignals.slice(0, 3)) {
    learningSummary.push(`Counter-signal (${cs.source}): ${cs.quote}`);
  }

  const weakDimensions = rec.scores
    .filter((s) => (s.higherIsBetter ? s.score < 50 : s.score > 60))
    .sort((a, b) => (a.higherIsBetter ? a.score - b.score : b.score - a.score))
    .slice(0, 3);
  const alternativeIdeas = weakDimensions
    .map((s) => DIMENSION_TO_ALTERNATIVE[s.dimension])
    .filter((x): x is { title: string; rationale: string } => !!x);
  if (alternativeIdeas.length === 0) {
    alternativeIdeas.push({
      title: 'Take a six-week break before reattempting this venture.',
      rationale: 'No single failing dimension is dominant; the venture as a whole lacks signal.',
    });
  }

  const validationGaps = rec.assumptions
    .filter((a) => a.confidence === 'low' || a.riskLevel === 'high' || a.riskLevel === 'critical')
    .slice(0, 6)
    .map((a) => `Unvalidated: ${a.text}`);

  return { killRationale, learningSummary, alternativeIdeas, validationGaps };
}

export function buildKillVisionStub(input: BuildSquadInput): BuildSquadProductVision {
  const briefSummary = typeof (input.brief as { businessIdea?: string } | undefined)?.businessIdea === 'string'
    ? (input.brief as { businessIdea?: string }).businessIdea!
    : 'this venture';
  return {
    problem: `KILL decision: ${briefSummary} is not ready to build.`,
    targetUsers: [],
    productPromise: 'Build artifacts are intentionally not produced for KILL decisions.',
    whyNow: input.recommendation.executiveSummary || '',
    differentiation: [],
    successMetrics: [],
  };
}
