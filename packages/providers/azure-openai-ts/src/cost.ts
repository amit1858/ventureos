/**
 * Azure OpenAI cost table (USD per 1K tokens). Mirrors OpenAI public pricing —
 * Azure-specific contracted rates are computed at billing time, so this is a
 * conservative reference that matches OpenAI's list price.
 */
export interface ModelPricing {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  'gpt-4o':              { inputUsdPer1k: 0.0025,  outputUsdPer1k: 0.01 },
  'gpt-4o-2024-08-06':   { inputUsdPer1k: 0.0025,  outputUsdPer1k: 0.01 },
  'gpt-4o-mini':         { inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
  'gpt-4.1':             { inputUsdPer1k: 0.002,   outputUsdPer1k: 0.008 },
  'gpt-4.1-mini':        { inputUsdPer1k: 0.0004,  outputUsdPer1k: 0.0016 },
  'gpt-4.1-nano':        { inputUsdPer1k: 0.0001,  outputUsdPer1k: 0.0004 },
  'gpt-4-turbo':         { inputUsdPer1k: 0.01,    outputUsdPer1k: 0.03 },
  'gpt-35-turbo':        { inputUsdPer1k: 0.0005,  outputUsdPer1k: 0.0015 },
  'gpt-4':               { inputUsdPer1k: 0.03,    outputUsdPer1k: 0.06 },
  // Reasoning deployments (GPT-5 / o-series)
  'gpt-5':               { inputUsdPer1k: 0.00125, outputUsdPer1k: 0.01 },
  'gpt-5-mini':          { inputUsdPer1k: 0.00025, outputUsdPer1k: 0.002 },
  'o4-mini':             { inputUsdPer1k: 0.0011,  outputUsdPer1k: 0.0044 },
  'o3':                  { inputUsdPer1k: 0.002,   outputUsdPer1k: 0.008 },
  'text-embedding-3-small': { inputUsdPer1k: 0.00002, outputUsdPer1k: 0 },
  'text-embedding-3-large': { inputUsdPer1k: 0.00013, outputUsdPer1k: 0 },
};

/** Static fallback catalog. Real deployment names are user-configured per Azure resource. */
export const KNOWN_MODELS: ReadonlyArray<string> = Object.freeze([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4-turbo',
  'gpt-35-turbo',
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
