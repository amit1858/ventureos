/**
 * BuildSquad server-only factory (Sprint 2A).
 *
 * Mirrors the VentureLab / Graphify runner. The decrypted secret stays inside
 * `withDecryptedSecret`; the browser only sees the resulting
 * `BuildSquadArtifactPack`.
 *
 * BuildSquad makes:
 *   - PROCEED → up to 2 LLM calls (drafting + critique).
 *   - PIVOT   → up to 1 LLM call (pivot brief).
 *   - KILL    → 0 LLM calls.
 */
import 'server-only';

import type { CallContext, ChatRequest, ChatResponse, ProviderId } from '@foundry/contracts';
import { BuildSquad, type BuildSquadArtifactPack, type BuildSquadInput } from '@foundry/buildsquad';
import { ProviderError } from '@foundry/providers-core';
import { OpenAiAdapter } from '@foundry/providers-openai';
import { AnthropicAdapter } from '@foundry/providers-anthropic';
import { GeminiAdapter } from '@foundry/providers-gemini';
import { AzureOpenAiAdapter } from '@foundry/providers-azure-openai';

import { getCredentialService } from './credentials';

export interface RunBuildSquadInput {
  userId: string;
  providerCredentialId: string;
  modelId: string;
  payload: BuildSquadInput;
}

export type BuildSquadResult =
  | { ok: true; data: BuildSquadArtifactPack }
  | { ok: false; reason: string };

export async function runBuildSquad(input: RunBuildSquadInput): Promise<BuildSquadResult> {
  const service = getCredentialService();
  const used = await service.withDecryptedSecret(
    input.userId,
    input.providerCredentialId,
    async ({ secret, providerType, config, profile }) => {
      const chat = buildChatFn(providerType, secret, config, profile.id);
      const ctx: CallContext = {
        tenantId: input.userId,
        traceId: `buildsquad-${Date.now().toString(36)}`,
        ventureId: input.payload.recommendation.ventureId,
      };
      const bsq = new BuildSquad(chat, { model: input.modelId, ctx });
      return bsq.run(input.payload);
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
      throw new ProviderError(`Provider '${providerType}' is not supported by BuildSquad.`);
    };
  }
  const decrypted = { id: keyId, provider: providerType, secret };
  return async (req: ChatRequest): Promise<ChatResponse> =>
    adapter.chat(req, decrypted, typeof req.model === 'string' ? req.model : 'default');
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
