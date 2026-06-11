/**
 * Google Gemini cost table (USD per 1K tokens). Source: https://ai.google.dev/pricing.
 * Falls back to zero for unknown models.
 */
export interface ModelPricing {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  'gemini-1.5-pro':         { inputUsdPer1k: 0.00125, outputUsdPer1k: 0.005 },
  'gemini-1.5-pro-latest':  { inputUsdPer1k: 0.00125, outputUsdPer1k: 0.005 },
  'gemini-1.5-flash':       { inputUsdPer1k: 0.000075, outputUsdPer1k: 0.0003 },
  'gemini-1.5-flash-latest':{ inputUsdPer1k: 0.000075, outputUsdPer1k: 0.0003 },
  'gemini-1.5-flash-8b':    { inputUsdPer1k: 0.0000375, outputUsdPer1k: 0.00015 },
  'gemini-2.0-flash':       { inputUsdPer1k: 0.0001,  outputUsdPer1k: 0.0004 },
  'gemini-2.0-flash-exp':   { inputUsdPer1k: 0.0001,  outputUsdPer1k: 0.0004 },
  'text-embedding-004':     { inputUsdPer1k: 0,       outputUsdPer1k: 0 },
};

export const KNOWN_MODELS: ReadonlyArray<string> = Object.freeze([
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
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
