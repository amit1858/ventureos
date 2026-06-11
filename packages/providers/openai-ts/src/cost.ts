/**
 * OpenAI cost table (USD per 1K tokens). Hand-maintained — keep in sync with
 * https://openai.com/api/pricing/ as needed.
 * Falls back to zero when the model is unknown so unknown models do not block calls;
 * router/budget will still record observed usage.
 */
export interface ModelPricing {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
}

const PRICING: Record<string, ModelPricing> = {
  // GPT-4o family
  'gpt-4o':              { inputUsdPer1k: 0.0025,  outputUsdPer1k: 0.01 },
  'gpt-4o-2024-08-06':   { inputUsdPer1k: 0.0025,  outputUsdPer1k: 0.01 },
  'gpt-4o-mini':         { inputUsdPer1k: 0.00015, outputUsdPer1k: 0.0006 },
  // GPT-4 turbo
  'gpt-4-turbo':         { inputUsdPer1k: 0.01,    outputUsdPer1k: 0.03 },
  'gpt-4-turbo-preview': { inputUsdPer1k: 0.01,    outputUsdPer1k: 0.03 },
  // GPT-3.5
  'gpt-3.5-turbo':       { inputUsdPer1k: 0.0005,  outputUsdPer1k: 0.0015 },
  // Embeddings
  'text-embedding-3-small': { inputUsdPer1k: 0.00002, outputUsdPer1k: 0 },
  'text-embedding-3-large': { inputUsdPer1k: 0.00013, outputUsdPer1k: 0 },
};

export function pricingFor(modelId: string): ModelPricing {
  return PRICING[modelId] ?? { inputUsdPer1k: 0, outputUsdPer1k: 0 };
}

/** Compute actual USD cost from observed usage. */
export function costUsd(
  modelId: string,
  usage: { promptTokens: number; completionTokens: number },
): number {
  const p = pricingFor(modelId);
  return (usage.promptTokens / 1000) * p.inputUsdPer1k +
         (usage.completionTokens / 1000) * p.outputUsdPer1k;
}

/**
 * Pre-call rough estimate. We don't ship a tokenizer in Sprint 1A; approximate at
 * ~4 chars/token for input and a worst-case 1024 output tokens unless `maxTokens`
 * narrows it. Conservative on purpose — budget guard prefers overestimate.
 */
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
