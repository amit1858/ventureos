/**
 * Adaptive output budgeting (Release 1.0 hardening).
 *
 * Replaces per-workflow hardcoded `maxTokens` constants (which were tuned for
 * terse GPT-4o mini and truncated verbose models like Claude Sonnet) with a
 * deterministic function of the model's capability profile and the workflow
 * stage. No provider-specific branching, no magic numbers at call sites.
 *
 *   budget = clamp( base(stage) × verbosityMultiplier + reasoningHeadroom,
 *                   MIN_OUTPUT_TOKENS, cap.maxOutputTokens )
 *
 * The base sizes are derived from observed real completion sizes across
 * providers with comfortable headroom, so a verbose model never truncates and
 * a terse model never over-allocates wastefully.
 */
import type { ModelCapability, VerbosityProfile } from './capabilities';

/**
 * Logical steps of a generative workflow. Stage identifies the *shape/size* of
 * the expected JSON, independent of which lab or provider is running it.
 */
export type WorkflowStage =
  | 'personas'
  | 'interview'
  | 'focusGroup'
  | 'buyingCommittee'
  | 'insights'
  | 'default';

/**
 * Baseline output budget per stage for a *terse* model, in tokens. Sized from
 * measured completion lengths (largest observed × ~1.5 headroom):
 *   personas ~1.5K → 3200 · focusGroup ~3.3K → 3200 · committee ~2.6K
 *   interview ~0.9K → 1600 · insights ~1K → 1800.
 */
const BASE_STAGE_TOKENS: Record<WorkflowStage, number> = {
  personas: 3200,
  interview: 1600,
  focusGroup: 3200,
  buyingCommittee: 2600,
  insights: 1800,
  default: 2000,
};

/** Scale factor applied to the terse baseline for wordier models. */
const VERBOSITY_MULTIPLIER: Record<VerbosityProfile, number> = {
  terse: 1.0,
  balanced: 1.3,
  verbose: 1.75,
};

/** Extra room for models that spend hidden reasoning tokens before answering. */
const REASONING_HEADROOM_TOKENS = 2000;

/** Floor so a tiny stage never gets an unusable budget. */
const MIN_OUTPUT_TOKENS = 512;

/**
 * Deterministic recommended output-token budget for a capability + stage.
 * Pure function — identical inputs always yield identical output.
 */
export function recommendedBudget(cap: ModelCapability, stage: WorkflowStage): number {
  const base = BASE_STAGE_TOKENS[stage] ?? BASE_STAGE_TOKENS.default;
  const scaled = Math.ceil(base * VERBOSITY_MULTIPLIER[cap.verbosity]);
  const withReasoning = cap.reasoning ? scaled + REASONING_HEADROOM_TOKENS : scaled;
  const clampedLow = Math.max(withReasoning, MIN_OUTPUT_TOKENS);
  return Math.min(clampedLow, cap.maxOutputTokens);
}

/** Exposed for tests/telemetry: the terse baseline for a stage. */
export function baseStageTokens(stage: WorkflowStage): number {
  return BASE_STAGE_TOKENS[stage] ?? BASE_STAGE_TOKENS.default;
}
