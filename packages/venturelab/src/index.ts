/**
 * @ventureos/venturelab — public API.
 *
 * VentureLab consumes PersonaLab + buying-committee outputs and produces a
 * single auditable `VentureRecommendation`. The decision is computed by a
 * deterministic rule engine over deterministic dimension scores; LLM calls
 * are restricted to evidence extraction + assumption mapping.
 */
export * from './types';
export * from './analyzers';
export { decide, computeOverallScore, computeConfidenceScore } from './decision';
export type { DecisionResult } from './decision';
export { generateRiskRegister } from './risk-register';
export { generateNextSteps } from './next-steps';
export { evaluateVentureLab } from './evaluation';
export {
  applyResearchGraphAdjustments,
  applyScoreDeltas,
  EMPTY_ADJUSTMENTS,
} from './research-graph';
export type { ResearchGraphAdjustments } from './research-graph';
export { signalsPrompt, assumptionsPrompt } from './prompts';
export { VentureLab, assumptionsFromStrings } from './orchestrator';
export type { VentureLabOptions } from './orchestrator';
export { VentureLabParseError, parseJsonBlock } from './json';
