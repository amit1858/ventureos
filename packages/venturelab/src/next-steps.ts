/**
 * Deterministic next-steps generator.
 *
 * Builds a prioritised validation roadmap from the score profile. The
 * lowest-scoring positive dimension becomes the highest-priority step; high
 * friction/risk dimensions add their own mitigation steps. Risky assumptions
 * each get a step (capped) when not already covered by a dimensional step.
 */
import type {
  ScoreDimension,
  ValidationCategory,
  ValidationStep,
  VentureAssumption,
  VentureScore,
} from './types';

interface Template {
  title: string;
  category: ValidationCategory;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  /** Score below which this step is "blocking" the recommendation. */
  blockingBelow?: number;
  /** Score above which this step is "blocking" (for friction/risk dims). */
  blockingAbove?: number;
}

const POSITIVE_TEMPLATES: Partial<Record<ScoreDimension, Template>> = {
  problemStrength: {
    title: 'Conduct 8–12 problem-discovery interviews',
    category: 'user_research',
    rationale: 'Confirm pain intensity, frequency, and current workarounds in the target persona before building.',
    effort: 'medium',
    blockingBelow: 50,
  },
  buyerUrgency: {
    title: 'Identify and validate a compelling trigger event',
    category: 'user_research',
    rationale: 'Without a "why now", urgency-driven purchase will not happen — pinpoint the trigger that forces a buy decision.',
    effort: 'low',
    blockingBelow: 45,
  },
  willingnessToPay: {
    title: 'Run a pricing test (smoke-test landing page or Van Westendorp)',
    category: 'pricing_test',
    rationale: 'Validate that the target persona will commit money at the proposed price, not merely express interest.',
    effort: 'medium',
    blockingBelow: 50,
  },
  differentiation: {
    title: 'Pressure-test the wedge in cold outreach against 10 incumbents',
    category: 'competitive_analysis',
    rationale: 'Differentiation only matters if buyers can articulate it in their own words back to you.',
    effort: 'low',
    blockingBelow: 45,
  },
  committeeConfidence: {
    title: 'Run a structured buying-committee pilot with 1–2 target accounts',
    category: 'pilot',
    rationale: 'A real multi-stakeholder pilot exposes the blocking persona faster than any number of interviews.',
    effort: 'high',
    blockingBelow: 50,
  },
  marketClarity: {
    title: 'Size the segment and clarify the ICP',
    category: 'market_sizing',
    rationale: 'A fuzzy ICP makes every downstream test less informative — define a sharp first persona.',
    effort: 'low',
    blockingBelow: 45,
  },
};

const FRICTION_TEMPLATE: Template = {
  title: 'Storyboard and reduce the first-30-minutes onboarding',
  category: 'onboarding_test',
  rationale: 'Even motivated buyers will abandon if first-use friction is high — kill steps until the path is obvious.',
  effort: 'medium',
  blockingAbove: 60,
};

const RISK_TEMPLATE: Template = {
  title: 'Run a technical spike on the riskiest dependency',
  category: 'technical_spike',
  rationale: 'Validate that the riskiest technical assumption (integration, latency, compliance) actually holds before scaling.',
  effort: 'medium',
  blockingAbove: 60,
};

interface Scored {
  dimension: ScoreDimension;
  template: Template;
  gap: number; // larger gap = higher priority
  blocking: boolean;
}

function scoreGap(score: number, blockingBelow?: number, blockingAbove?: number, higherIsBetter = true): { gap: number; blocking: boolean } {
  if (higherIsBetter && blockingBelow != null) {
    return { gap: Math.max(0, blockingBelow - score), blocking: score < blockingBelow };
  }
  if (!higherIsBetter && blockingAbove != null) {
    return { gap: Math.max(0, score - blockingAbove), blocking: score > blockingAbove };
  }
  return { gap: 0, blocking: false };
}

function priorityFromGap(gap: number, blocking: boolean): 1 | 2 | 3 {
  if (blocking && gap >= 20) return 1;
  if (blocking || gap >= 15) return 2;
  return 3;
}

export function generateNextSteps(
  scores: VentureScore[],
  assumptions: VentureAssumption[],
): ValidationStep[] {
  const candidates: Scored[] = [];

  for (const s of scores) {
    if (s.higherIsBetter) {
      const tpl = POSITIVE_TEMPLATES[s.dimension];
      if (!tpl) continue;
      const { gap, blocking } = scoreGap(s.score, tpl.blockingBelow, undefined, true);
      if (gap > 0) candidates.push({ dimension: s.dimension, template: tpl, gap, blocking });
    } else {
      // friction / risk
      const tpl = s.dimension === 'adoptionFriction' ? FRICTION_TEMPLATE : RISK_TEMPLATE;
      const { gap, blocking } = scoreGap(s.score, undefined, tpl.blockingAbove, false);
      if (gap > 0) candidates.push({ dimension: s.dimension, template: tpl, gap, blocking });
    }
  }

  candidates.sort((a, b) => {
    if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
    return b.gap - a.gap;
  });

  const steps: ValidationStep[] = candidates.map((c, i) => ({
    id: `s${i + 1}`,
    title: c.template.title,
    category: c.template.category,
    priority: priorityFromGap(c.gap, c.blocking),
    rationale: c.template.rationale,
    effort: c.template.effort,
    blocksDecision: c.blocking,
    relatedDimension: c.dimension,
  }));

  // Append the most risky assumptions that have not already been addressed by a dimensional step.
  const riskyAssumptions = assumptions
    .filter((a) => a.type === 'risky' && (a.riskLevel === 'high' || a.riskLevel === 'critical'))
    .slice(0, 3);

  for (const a of riskyAssumptions) {
    steps.push({
      id: `s${steps.length + 1}`,
      title: `Validate assumption: ${truncate(a.text, 80)}`,
      category: 'user_research',
      priority: a.riskLevel === 'critical' ? 1 : 2,
      rationale: a.validationStrategy || 'Design a falsifiable test before relying on this assumption.',
      effort: 'medium',
      blocksDecision: a.riskLevel === 'critical',
    });
  }

  // Always include at least one step: if nothing fired, suggest a baseline discovery sweep.
  if (steps.length === 0) {
    steps.push({
      id: 's1',
      title: 'Run a baseline discovery sweep (5 interviews + 1 landing page)',
      category: 'user_research',
      priority: 2,
      rationale: 'Even a strong-looking score profile benefits from low-cost confirmation before committing to build.',
      effort: 'low',
      blocksDecision: false,
    });
  }

  return steps;
}

function truncate(text: string, n: number): string {
  return text.length <= n ? text : text.slice(0, n - 1) + '…';
}
