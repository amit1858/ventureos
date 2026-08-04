/**
 * Graphify server-only factory (Sprint 1F).
 *
 * Wires the BYOK credential service to a per-request `ChatFn` that targets
 * the user's selected provider, then constructs a `GraphifyAdapter`. The
 * decrypted secret stays inside the `withDecryptedSecret` callback and is
 * never returned to the browser, persisted, logged, or surfaced via audit
 * metadata.
 *
 * Graphify makes ONE LLM call per `buildResearchGraph` invocation
 * (graph extraction). All centrality, communities, contradictions, queries,
 * paths and Neo4j export are pure-deterministic and never call out.
 */
import 'server-only';

import type { CallContext, ChatRequest, ChatResponse, ProviderId, ResearchGraph } from '@foundry/contracts';
import { GraphifyAdapter, type GraphifyInput } from '@foundry/adapter-graphify';
import { ProviderError } from '@foundry/providers-core';
import { OpenAiAdapter } from '@foundry/providers-openai';
import { AnthropicAdapter } from '@foundry/providers-anthropic';
import { GeminiAdapter } from '@foundry/providers-gemini';
import { AzureOpenAiAdapter } from '@foundry/providers-azure-openai';

import { getCredentialService } from './credentials';

export interface RunGraphifyBuildInput {
  userId: string;
  providerCredentialId: string;
  modelId: string;
  payload: GraphifyInput;
}

export type GraphifyResult =
  | { ok: true; data: ResearchGraph }
  | { ok: false; reason: string };

export async function runGraphifyBuild(input: RunGraphifyBuildInput): Promise<GraphifyResult> {
  const service = getCredentialService();
  const used = await service.withDecryptedSecret(
    input.userId,
    input.providerCredentialId,
    async ({ secret, providerType, config, profile }) => {
      const chat = buildChatFn(providerType, secret, config, profile.id);
      const ctx: CallContext = {
        tenantId: input.userId,
        traceId: `graphify-build-${Date.now().toString(36)}`,
        ...(input.payload.ventureId ? { ventureId: input.payload.ventureId } : {}),
      };
      const adapter = new GraphifyAdapter(chat, { model: input.modelId, ctx });
      return adapter.buildResearchGraph(input.payload);
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
      throw new ProviderError(`Provider '${providerType}' is not supported by Graphify.`);
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
