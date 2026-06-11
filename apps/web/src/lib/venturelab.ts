/**
 * VentureLab server-only factory.
 *
 * Composes the BYOK credential service with a per-request `ChatFn` that targets
 * the user's selected provider. The decrypted secret is held only inside the
 * `withDecryptedSecret` callback and never persisted, returned to the browser,
 * logged, or placed into audit metadata.
 *
 * VentureLab makes exactly two LLM calls per `analyze` invocation
 * (signal extraction + assumption mapping) and then runs deterministic
 * analyzers, decision engine, risk register, and next-steps generation.
 */
import 'server-only';

import type { CallContext, ChatRequest, ChatResponse, ProviderId } from '@ventureos/contracts';
import { ProviderError } from '@ventureos/providers-core';
import { OpenAiAdapter } from '@ventureos/providers-openai';
import { AnthropicAdapter } from '@ventureos/providers-anthropic';
import { GeminiAdapter } from '@ventureos/providers-gemini';
import { AzureOpenAiAdapter } from '@ventureos/providers-azure-openai';
import {
  VentureLab,
  type VentureLabInput,
  type VentureRecommendation,
} from '@ventureos/venturelab';

import { getCredentialService } from './credentials';

export interface RunVentureLabInput {
  userId: string;
  providerCredentialId: string;
  modelId: string;
  /** Everything VentureLab needs: brief + personas + (optional) committee + (optional) ideaBrief. */
  payload: VentureLabInput;
}

export type VentureLabResult =
  | { ok: true; data: VentureRecommendation }
  | { ok: false; reason: string };

export async function runVentureLabAnalyze(input: RunVentureLabInput): Promise<VentureLabResult> {
  const service = getCredentialService();
  const used = await service.withDecryptedSecret(
    input.userId,
    input.providerCredentialId,
    async ({ secret, providerType, config, profile }) => {
      const chat = buildChatFn(providerType, secret, config, profile.id);
      const ctx: CallContext = {
        tenantId: input.userId,
        traceId: `venturelab-analyze-${Date.now().toString(36)}`,
        ...(input.payload.ventureId ? { ventureId: input.payload.ventureId } : {}),
      };
      const lab = new VentureLab(chat, { model: input.modelId, ctx });
      return lab.analyze(input.payload);
    },
  );
  if (!used.ok) return { ok: false, reason: used.reason };
  return { ok: true, data: used.value };
}

function buildChatFn(
  providerType: ProviderId,
  secret: string,
  config: { endpoint?: string; apiVersion?: string },
  keyId: string,
) {
  const adapter = buildAdapter(providerType, config);
  if (!adapter) {
    return async (): Promise<ChatResponse> => {
      throw new ProviderError(`Provider '${providerType}' is not supported by VentureLab.`);
    };
  }
  const decrypted = { id: keyId, provider: providerType, secret };
  return async (req: ChatRequest): Promise<ChatResponse> => {
    return adapter.chat(req, decrypted, typeof req.model === 'string' ? req.model : 'default');
  };
}

function buildAdapter(
  providerType: ProviderId,
  config: { endpoint?: string; apiVersion?: string },
) {
  switch (providerType) {
    case 'openai':       return new OpenAiAdapter();
    case 'anthropic':    return new AnthropicAdapter();
    case 'gemini':       return new GeminiAdapter();
    case 'azure_openai': {
      if (!config.endpoint) return null;
      return new AzureOpenAiAdapter({
        endpoint: config.endpoint,
        ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
      });
    }
    default: return null;
  }
}
