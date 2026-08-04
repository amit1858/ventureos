/**
 * Model-support helpers for graceful BYOK degradation.
 *
 * Central place that answers two product questions without leaking provider
 * internals into the UI:
 *   1. "Is this model validated for Foundry?" (`isValidatedModel`)
 *   2. "What should we tell the user when it isn't / when a credential is
 *      missing?" (`unsupportedModelReason`, `missingCredentialReason`)
 *
 * The catalogs come straight from each provider package's `KNOWN_MODELS`
 * constant so this never drifts from what the picker offers.
 */
import type { ProviderId } from '@foundry/contracts';
import { OPENAI_KNOWN_MODELS } from '@foundry/providers-openai';
import { ANTHROPIC_KNOWN_MODELS } from '@foundry/providers-anthropic';
import { GEMINI_KNOWN_MODELS } from '@foundry/providers-gemini';
import { AZURE_OPENAI_KNOWN_MODELS } from '@foundry/providers-azure-openai';

import { providerLabel } from './labels';

// Re-exported so existing importers (and tests) keep a single call site while
// the canonical provider→label map lives in the dependency-free ./labels module.
export { providerLabel };

/** Human-facing recommended shortlist. Mirrored in docs/model-compatibility.md. */
export const RECOMMENDED_MODELS_DISPLAY = ['GPT-4o mini', 'GPT-4.1', 'Claude Sonnet'] as const;

const CATALOG: Partial<Record<ProviderId, ReadonlyArray<string>>> = {
  openai: OPENAI_KNOWN_MODELS,
  anthropic: ANTHROPIC_KNOWN_MODELS,
  gemini: GEMINI_KNOWN_MODELS,
  azure_openai: AZURE_OPENAI_KNOWN_MODELS,
};

export function knownModelsFor(provider: ProviderId): ReadonlyArray<string> {
  return CATALOG[provider] ?? [];
}

/**
 * Whether `modelId` is on the validated catalog for `provider`.
 *
 * Providers whose model identifier is operator-defined rather than a fixed
 * catalog (Azure deployment names, Ollama tags, self-hosted) can't be checked
 * against a list, so we treat any non-empty id as allowed for them.
 */
export function isValidatedModel(provider: ProviderId, modelId: string): boolean {
  if (!modelId) return false;
  if (provider === 'azure_openai' || provider === 'azure_ai_foundry' || provider === 'ollama') {
    return true;
  }
  const catalog = CATALOG[provider];
  if (!catalog || catalog.length === 0) return true;
  return catalog.includes(modelId);
}

/**
 * Copy shown when a user selects a model Foundry hasn't validated. The
 * recommended-models block is verbatim product copy — keep the three bullets.
 */
export function unsupportedModelReason(modelId?: string): string {
  const lead = modelId
    ? `The model “${modelId}” is not yet validated for Foundry.`
    : 'This model is not yet validated for Foundry.';
  return `${lead}\n\nRecommended models:\n\n• GPT-4o mini\n• GPT-4.1\n• Claude Sonnet`;
}

/** Copy shown when the credential needed to serve a request is missing/misconfigured. */
export function missingCredentialReason(
  provider: ProviderId,
  config?: { endpoint?: string },
): string {
  if (provider === 'azure_openai' && !config?.endpoint) {
    return 'Azure OpenAI requires a resource endpoint (for example ' +
      'https://<resource>.openai.azure.com) in the provider configuration. ' +
      'Add it under Settings → Providers, then try again.';
  }
  return `No usable API key is configured for ${providerLabel(provider)}. ` +
    'Add a key under Settings → Providers, then try again.';
}
