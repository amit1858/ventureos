/**
 * PIVOT path. One LLM call only. Falls back to a deterministic pivot brief
 * built from the recommendation's counter-signals if the LLM fails or returns
 * unusable content.
 */
import type {
  BuildSquadInput,
  BuildSquadPivotOutput,
  BuildSquadProductVision,
  VentureRecommendation,
} from './types';
import { asArray, asObject, asString, asStringArray } from './json';

export function normalizePivot(payload: unknown, rec: VentureRecommendation): BuildSquadPivotOutput {
  const o = asObject(payload);
  const pivotBrief = asString(o['pivotBrief']) || deterministicPivotBrief(rec);
  const revisedProblemStatement = asString(o['revisedProblemStatement']) || deterministicRevisedProblem(rec);
  const revisedMvpDirection = asString(o['revisedMvpDirection']) || 'Run two validation experiments before any build work.';
  const planRaw = asArray<unknown>(o['validationPlan']);
  let idx = 0;
  const validationPlan = planRaw
    .map((p) => asObject(p))
    .filter((p) => asString(p['title']).length > 0)
    .slice(0, 5)
    .map((p) => ({
      id: asString(p['id']) || `vp_${++idx}`,
      title: asString(p['title']),
      rationale: asString(p['rationale']),
    }));
  return {
    pivotBrief,
    revisedProblemStatement,
    revisedMvpDirection,
    validationPlan: validationPlan.length > 0 ? validationPlan : deterministicValidationPlan(rec),
  };
}

export function deterministicPivotBrief(rec: VentureRecommendation): string {
  const top = rec.decisionRationale.slice(0, 2).join(' ');
  const cs = rec.counterSignals.slice(0, 1).map((c) => c.quote).join(' ');
  return `VentureLab recommends PIVOT. ${top}${cs ? ` Counter-signal: "${cs}".` : ''}`.trim();
}

function deterministicRevisedProblem(rec: VentureRecommendation): string {
  return rec.executiveSummary || 'Re-frame the problem statement around the strongest validated signal.';
}

function deterministicValidationPlan(rec: VentureRecommendation): BuildSquadPivotOutput['validationPlan'] {
  return rec.nextSteps.slice(0, 4).map((s, i) => ({
    id: s.id || `vp_${i + 1}`,
    title: s.title,
    rationale: s.rationale,
  }));
}

export function buildPivotVisionStub(input: BuildSquadInput, pivot: BuildSquadPivotOutput): BuildSquadProductVision {
  return {
    problem: pivot.revisedProblemStatement,
    targetUsers: [],
    productPromise: pivot.revisedMvpDirection,
    whyNow: pivot.pivotBrief,
    differentiation: [],
    successMetrics: [],
  };
}
