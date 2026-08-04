/**
 * OpenAI cost table (USD per 1K tokens).
 *
 * Chat/reasoning model prices are sourced from the single-source-of-truth model
 * registry in `./models`. This file adds only the non-chat entries (embeddings)
 * and a few dated/aliased ids, then exposes the pricing helpers.
 *
 * Falls back to zero when the model is unknown so unknown models do not block
 * calls; the router/budget guard still records observed usage.
 * Keep in sync with https://openai.com/api/pricing/ as needed.
 */
import { OPENAI_MODELS } from './models';

export interface ModelPricing {
  inputUsdPer1k: number;
  outputUsdPer1k: number;
}

/** Entries not represented in the chat/reasoning registry (embeddings + aliases). */
const EXTRA_PRICING: Record<string, ModelPricing> = {
  // Dated / aliased chat ids that map to a registry price.
  'gpt-4o-2024-08-06':   { inputUsdPer1k: 0.0025, outputUsdPer1k: 0.01 },
  'gpt-4-turbo-preview': { inputUsdPer1k: 0.01,   outputUsdPer1k: 0.03 },
  // Embeddings
  'text-embedding-3-small': { inputUsdPer1k: 0.00002, outputUsdPer1k: 0 },
  'text-embedding-3-large': { inputUsdPer1k: 0.00013, outputUsdPer1k: 0 },
};

export function pricingFor(modelId: string): ModelPricing {
  const spec = OPENAI_MODELS[modelId];
  if (spec) return { inputUsdPer1k: spec.inputUsdPer1k, outputUsdPer1k: spec.outputUsdPer1k };
  return EXTRA_PRICING[modelId] ?? { inputUsdPer1k: 0, outputUsdPer1k: 0 };
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
