/**
 * OpenAI per-model registry.
 *
 * A single source of truth for everything the adapter needs to treat models
 * correctly WITHOUT scattering model-specific hacks across the codebase:
 *   - which request-parameter dialect a model speaks (`chat` vs `reasoning`)
 *   - token limits
 *   - whether a custom `temperature` is accepted
 *   - list pricing (consumed by `cost.ts`)
 *   - catalog membership + "recommended"/"tested" flags surfaced in the BYOK UI
 *
 * Why two param styles?
 *   The GPT-5 and o-series ("reasoning") models were introduced with a different
 *   Chat Completions contract: they reject the legacy `max_tokens` field (they
 *   require `max_completion_tokens`) and only accept the default `temperature`.
 *   Sending the older shape returns HTTP 400. The classic GPT-4o / GPT-4.1 /
 *   GPT-3.5 ("chat") models keep the original contract. The adapter consults
 *   this registry so the request is shaped correctly per model.
 *
 * Keep prices in sync with https://openai.com/api/pricing/ as needed.
 */

export type OpenAiParamStyle = 'chat' | 'reasoning';

export interface OpenAiModelSpec {
  id: string;
  /** Request-parameter dialect. `reasoning` => max_completion_tokens + fixed temperature. */
  paramStyle: OpenAiParamStyle;
  maxContextTokens: number;
  maxOutputTokens: number;
  /** Reasoning models reject a non-default temperature; the adapter omits it. */
  supportsTemperature: boolean;
  supportsJsonMode: boolean;
  supportsTools: boolean;
  /** Surfaced first in the BYOK picker + docs as a first-choice model. */
  recommended: boolean;
  /** Covered by the automated (mocked) test-suite / known-good in production. */
  tested: boolean;
  inputUsdPer1k: number;
  outputUsdPer1k: number;
  notes?: string;
}

/**
 * Ordered so the BYOK picker shows recommended + common chat models first, then
 * the reasoning family, then legacy. Order here == catalog order.
 */
const MODEL_LIST: readonly OpenAiModelSpec[] = [
  // ── Recommended chat models ──────────────────────────────────────────────
  {
    id: 'gpt-4o-mini',
    paramStyle: 'chat',
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: true,
    tested: true,
    inputUsdPer1k: 0.00015,
    outputUsdPer1k: 0.0006,
  },
  {
    id: 'gpt-4.1',
    paramStyle: 'chat',
    maxContextTokens: 1_047_576,
    maxOutputTokens: 32_768,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: true,
    tested: true,
    inputUsdPer1k: 0.002,
    outputUsdPer1k: 0.008,
  },
  // ── Other supported chat models ──────────────────────────────────────────
  {
    id: 'gpt-4o',
    paramStyle: 'chat',
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: true,
    inputUsdPer1k: 0.0025,
    outputUsdPer1k: 0.01,
  },
  {
    id: 'gpt-4.1-mini',
    paramStyle: 'chat',
    maxContextTokens: 1_047_576,
    maxOutputTokens: 32_768,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.0004,
    outputUsdPer1k: 0.0016,
  },
  {
    id: 'gpt-4.1-nano',
    paramStyle: 'chat',
    maxContextTokens: 1_047_576,
    maxOutputTokens: 32_768,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.0001,
    outputUsdPer1k: 0.0004,
  },
  // ── Reasoning models (GPT-5 + o-series) ──────────────────────────────────
  {
    id: 'gpt-5',
    paramStyle: 'reasoning',
    maxContextTokens: 400_000,
    maxOutputTokens: 128_000,
    supportsTemperature: false,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: true,
    inputUsdPer1k: 0.00125,
    outputUsdPer1k: 0.01,
    notes: 'Reasoning model: spends part of the output budget on hidden reasoning tokens.',
  },
  {
    id: 'gpt-5-mini',
    paramStyle: 'reasoning',
    maxContextTokens: 400_000,
    maxOutputTokens: 128_000,
    supportsTemperature: false,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.00025,
    outputUsdPer1k: 0.002,
  },
  {
    id: 'gpt-5-nano',
    paramStyle: 'reasoning',
    maxContextTokens: 400_000,
    maxOutputTokens: 128_000,
    supportsTemperature: false,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.00005,
    outputUsdPer1k: 0.0004,
  },
  {
    id: 'o4-mini',
    paramStyle: 'reasoning',
    maxContextTokens: 200_000,
    maxOutputTokens: 100_000,
    supportsTemperature: false,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: true,
    inputUsdPer1k: 0.0011,
    outputUsdPer1k: 0.0044,
  },
  {
    id: 'o3',
    paramStyle: 'reasoning',
    maxContextTokens: 200_000,
    maxOutputTokens: 100_000,
    supportsTemperature: false,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.002,
    outputUsdPer1k: 0.008,
  },
  // ── Legacy chat models (kept for compatibility) ──────────────────────────
  {
    id: 'gpt-4-turbo',
    paramStyle: 'chat',
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.01,
    outputUsdPer1k: 0.03,
  },
  {
    id: 'gpt-3.5-turbo',
    paramStyle: 'chat',
    maxContextTokens: 16_385,
    maxOutputTokens: 4_096,
    supportsTemperature: true,
    supportsJsonMode: true,
    supportsTools: true,
    recommended: false,
    tested: false,
    inputUsdPer1k: 0.0005,
    outputUsdPer1k: 0.0015,
  },
];

export const OPENAI_MODELS: Readonly<Record<string, OpenAiModelSpec>> = Object.freeze(
  Object.fromEntries(MODEL_LIST.map((m) => [m.id, m])),
);

/** Full catalog in display order — consumed by the BYOK model picker. */
export const OPENAI_KNOWN_MODELS: ReadonlyArray<string> = Object.freeze(
  MODEL_LIST.map((m) => m.id),
);

/** First-choice models, surfaced in docs + graceful-degradation copy. */
export const OPENAI_RECOMMENDED_MODELS: ReadonlyArray<string> = Object.freeze(
  MODEL_LIST.filter((m) => m.recommended).map((m) => m.id),
);

/** Minimum output budget granted to reasoning models (they burn tokens thinking). */
export const REASONING_MIN_OUTPUT_TOKENS = 4_096;

/** Exact-match registry lookup. Returns `undefined` for unknown ids. */
export function openAiModelSpec(modelId: string): OpenAiModelSpec | undefined {
  return OPENAI_MODELS[modelId];
}

/**
 * Whether a model uses the reasoning-family request contract. Falls back to an
 * id heuristic so brand-new model ids (e.g. a future `o5`, `gpt-5.1`) are handled
 * without a registry entry.
 */
export function isReasoningModel(modelId: string): boolean {
  const spec = OPENAI_MODELS[modelId];
  if (spec) return spec.paramStyle === 'reasoning';
  return /^(o[1-9]\d*|gpt-?5)(?:[-.]|$)/i.test(modelId);
}

/** The correct max-output request field for a model. */
export function maxTokenParamFor(modelId: string): 'max_tokens' | 'max_completion_tokens' {
  return isReasoningModel(modelId) ? 'max_completion_tokens' : 'max_tokens';
}

/** Whether a custom `temperature` may be forwarded for a model. */
export function supportsTemperature(modelId: string): boolean {
  const spec = OPENAI_MODELS[modelId];
  if (spec) return spec.supportsTemperature;
  return !isReasoningModel(modelId);
}
