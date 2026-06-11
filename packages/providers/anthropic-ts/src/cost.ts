/**
 * Anthropic cost table (USD per 1K tokens). Source: https://www.anthropic.com/pricing.
 * Unknown models fall back to zero so calls aren't blocked; budget guard records observed usage.
 */
export interface ModelPricing {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  // Claude 4.x family (current). Public list prices, USD per 1K tokens.
  'claude-haiku-4-5-20251001':      { inputUsdPer1k: 0.001,  outputUsdPer1k: 0.005 },
  'claude-haiku-4-5':               { inputUsdPer1k: 0.001,  outputUsdPer1k: 0.005 },
  'claude-sonnet-4-5':              { inputUsdPer1k: 0.003,  outputUsdPer1k: 0.015 },
  'claude-opus-4-1':                { inputUsdPer1k: 0.015,  outputUsdPer1k: 0.075 },
};

/**
 * Static catalog used by the BYOK UI's model picker.
 *
 * Only currently-served Anthropic models. Claude 3 / 3.5 model IDs were
 * retired and must not appear here — see RETIRED_MODELS / regression test in
 * `tests/adapter.test.ts`.
 */
export const KNOWN_MODELS: ReadonlyArray<string> = Object.freeze([
  'claude-haiku-4-5-20251001',
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
  'claude-opus-4-1',
]);

/** Default model used for low-cost calls (BYOK validation fallback, conformance probes). */
export const DEFAULT_VALIDATION_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Anthropic model IDs known to be retired / 404 on the public API.
 * Used by the regression test to ensure validation never reaches for one of these.
 */
export const RETIRED_MODELS: ReadonlyArray<string> = Object.freeze([
  'claude-3-haiku-20240307',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
  'claude-3-5-haiku-20241022',
  'claude-3-5-haiku-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-latest',
  'claude-3-opus-latest',
  'claude-2',
  'claude-2.0',
  'claude-2.1',
  'claude-instant-1.2',
]);

export function pricingFor(modelId: string): ModelPricing {
  return PRICING[modelId] ?? { inputUsdPer1k: 0, outputUsdPer1k: 0 };
}

export function costUsd(
  modelId: string,
  usage: { promptTokens: number; completionTokens: number },
): number {
  const p = pricingFor(modelId);
  return (usage.promptTokens / 1000) * p.inputUsdPer1k +
         (usage.completionTokens / 1000) * p.outputUsdPer1k;
}

export function estimateCostUsd(
  modelId: string,
  input: { totalCharacters: number; maxOutputTokens?: number },
): number {
  const p = pricingFor(modelId);
  const promptTokens = Math.ceil(input.totalCharacters / 4);
  const completionTokens = input.maxOutputTokens ?? 1024;
  return (promptTokens / 1000) * p.inputUsdPer1k +
         (completionTokens / 1000) * p.outputUsdPer1k;
}
