/**
 * Provider Capability Registry (Release 1.0 hardening).
 *
 * The single, provider-independent source of truth for the *behavioural*
 * facts a workflow needs to drive any model reliably — WITHOUT importing a
 * provider SDK or scattering `if (provider === 'anthropic')` branches through
 * the labs.
 *
 * This is deliberately separate from each provider package's `models.ts`:
 *   - `packages/providers/<p>/src/models.ts` owns SDK *request shaping*
 *     (param dialect, temperature support, exact price table).
 *   - THIS registry owns *cross-provider workflow* facts: verbosity profile,
 *     native JSON / structured-output support, output ceiling, streaming,
 *     retry posture, and coarse cost metadata used for budgeting + telemetry.
 *
 * Everything is data. Unknown / future models resolve through
 * `resolveCapability`, which derives a safe, deterministic profile from the
 * model id, so the platform stays extensible with no code change.
 */
import type { ProviderId } from '@foundry/contracts';

/** How wordy a model tends to be for the same instruction. Drives budgeting. */
export type VerbosityProfile = 'terse' | 'balanced' | 'verbose';

/**
 * Transient-error retry posture for a model/provider. This is the *network*
 * retry hint consumed by `retryAttemptsFor` — distinct from the structured
 * output pipeline's single semantic re-ask on a parse failure.
 */
export type RetryStrategy = 'none' | 'standard' | 'aggressive';

export interface ModelCapability {
  provider: ProviderId;
  /** Concrete model id (or a synthetic '*' default entry per provider). */
  model: string;
  /** Reasoning family (GPT-5 / o-series). Spends hidden tokens → needs headroom. */
  reasoning: boolean;
  /** Typical verbosity for identical instructions. */
  verbosity: VerbosityProfile;
  /** Native strict structured output (JSON schema / response_schema). */
  nativeStructuredOutput: boolean;
  /** Native JSON object mode (guarantees syntactically valid JSON). */
  nativeJson: boolean;
  /** Hard ceiling on output tokens for a single response. */
  maxOutputTokens: number;
  /** Whether the provider can stream this model. */
  streaming: boolean;
  /** Transient-error retry posture. */
  retry: RetryStrategy;
  /** Coarse list pricing (USD per 1K tokens) for budgeting/telemetry. Optional. */
  cost?: { inputUsdPer1k: number; outputUsdPer1k: number };
}

/** Attempts implied by a retry posture (used with `withRetry`). */
export function retryAttemptsFor(cap: Pick<ModelCapability, 'retry'>): number {
  switch (cap.retry) {
    case 'none':       return 1;
    case 'aggressive': return 4;
    case 'standard':
    default:           return 3;
  }
}

// ── Registry data ────────────────────────────────────────────────────────────
// Only the facts this layer owns. Prices mirror the provider cost tables; keep
// them coarse — precise per-call cost still comes from the adapter response.

const OPENAI: ModelCapability[] = [
  { provider: 'openai', model: 'gpt-4o-mini', reasoning: false, verbosity: 'terse',    nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 16_384, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 } },
  { provider: 'openai', model: 'gpt-4.1',     reasoning: false, verbosity: 'balanced', nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 32_768, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.002,   outputUsdPer1k: 0.008 } },
  { provider: 'openai', model: 'gpt-4o',      reasoning: false, verbosity: 'balanced', nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 16_384, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.0025,  outputUsdPer1k: 0.01 } },
  { provider: 'openai', model: 'gpt-4.1-mini',reasoning: false, verbosity: 'terse',    nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 32_768, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.0004,  outputUsdPer1k: 0.0016 } },
  { provider: 'openai', model: 'gpt-4.1-nano',reasoning: false, verbosity: 'terse',    nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 32_768, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.0001,  outputUsdPer1k: 0.0004 } },
  { provider: 'openai', model: 'gpt-5',       reasoning: true,  verbosity: 'balanced', nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 128_000, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.00125, outputUsdPer1k: 0.01 } },
  { provider: 'openai', model: 'gpt-5-mini',  reasoning: true,  verbosity: 'balanced', nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 128_000, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.00025, outputUsdPer1k: 0.002 } },
  { provider: 'openai', model: 'o4-mini',     reasoning: true,  verbosity: 'balanced', nativeStructuredOutput: true, nativeJson: true, maxOutputTokens: 100_000, streaming: true, retry: 'standard', cost: { inputUsdPer1k: 0.0011,  outputUsdPer1k: 0.0044 } },
];

const ANTHROPIC: ModelCapability[] = [
  // No native JSON mode — uses the prefill trick, so JSON validity is best-effort
  // and verbosity is high. 'aggressive' retry + the pipeline's repair/re-ask carry it.
  { provider: 'anthropic', model: 'claude-sonnet-4-5', reasoning: false, verbosity: 'verbose',  nativeStructuredOutput: false, nativeJson: false, maxOutputTokens: 8_192, streaming: true, retry: 'aggressive', cost: { inputUsdPer1k: 0.003, outputUsdPer1k: 0.015 } },
  { provider: 'anthropic', model: 'claude-opus-4-1',   reasoning: false, verbosity: 'verbose',  nativeStructuredOutput: false, nativeJson: false, maxOutputTokens: 8_192, streaming: true, retry: 'aggressive', cost: { inputUsdPer1k: 0.015, outputUsdPer1k: 0.075 } },
  { provider: 'anthropic', model: 'claude-haiku-4-5',  reasoning: false, verbosity: 'balanced', nativeStructuredOutput: false, nativeJson: false, maxOutputTokens: 8_192, streaming: true, retry: 'aggressive', cost: { inputUsdPer1k: 0.001, outputUsdPer1k: 0.005 } },
];

const GEMINI: ModelCapability[] = [
  // Native JSON via responseMimeType; strict schema support is partial → structured=false.
  { provider: 'gemini', model: 'gemini-2.5-flash', reasoning: false, verbosity: 'balanced', nativeStructuredOutput: false, nativeJson: true, maxOutputTokens: 8_192, streaming: true, retry: 'standard' },
  { provider: 'gemini', model: 'gemini-2.5-pro',   reasoning: false, verbosity: 'verbose',  nativeStructuredOutput: false, nativeJson: true, maxOutputTokens: 8_192, streaming: true, retry: 'standard' },
];

const ALL: ModelCapability[] = [...OPENAI, ...ANTHROPIC, ...GEMINI];

/** Frozen exact-match registry keyed by `provider:model`. */
export const CAPABILITY_REGISTRY: Readonly<Record<string, ModelCapability>> = Object.freeze(
  Object.fromEntries(ALL.map((c) => [`${c.provider}:${c.model}`, c])),
);

// ── Deterministic fallbacks (extensibility) ─────────────────────────────────

/** Anthropic model ids never have native JSON; everything else defaults to true. */
function inferNativeJson(provider: ProviderId): boolean {
  return provider !== 'anthropic';
}

/** Reasoning-family detection for OpenAI/Azure ids (o-series, gpt-5*). */
function inferReasoning(provider: ProviderId, model: string): boolean {
  if (provider !== 'openai' && provider !== 'azure_openai') return false;
  return /^(o[1-9]\d*|gpt-?5)(?:[-.]|$)/i.test(model);
}

/** Coarse verbosity guess by provider family when the model isn't registered. */
function inferVerbosity(provider: ProviderId): VerbosityProfile {
  if (provider === 'anthropic') return 'verbose';
  return 'balanced';
}

/** Conservative output ceiling by provider when the model isn't registered. */
function inferMaxOutput(provider: ProviderId, reasoning: boolean): number {
  if (reasoning) return 100_000;
  switch (provider) {
    case 'anthropic': return 8_192;
    case 'gemini':    return 8_192;
    default:          return 16_384;
  }
}

/**
 * Resolve the capability profile for any `(provider, model)`.
 *
 * Exact registry hit when available; otherwise a deterministic profile derived
 * from the id so unknown/future models still get sane budgeting + a working
 * structured-output path. Never throws.
 */
export function resolveCapability(provider: ProviderId, model: string): ModelCapability {
  const hit = CAPABILITY_REGISTRY[`${provider}:${model}`];
  if (hit) return hit;

  const reasoning = inferReasoning(provider, model);
  const nativeJson = inferNativeJson(provider);
  return {
    provider,
    model: model || '*',
    reasoning,
    verbosity: inferVerbosity(provider),
    nativeStructuredOutput: false,
    nativeJson,
    maxOutputTokens: inferMaxOutput(provider, reasoning),
    streaming: true,
    // Providers without guaranteed-valid JSON get the more forgiving posture.
    retry: nativeJson ? 'standard' : 'aggressive',
  };
}
