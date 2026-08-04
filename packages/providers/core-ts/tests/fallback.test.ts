import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatResponse, DecryptedKey, ProviderRoute } from '@foundry/contracts';
import {
  InMemoryBudgetGuard,
  ProviderAuthError,
  ProviderRegistry,
  ProviderUnavailableError,
  RateLimited,
  RoutingProviderClient,
  type ProviderAdapter,
} from '../src/index';

const noopRedactor = { redact: (s: string) => s };
const fakeKeys = {
  async resolve(keyId: string): Promise<DecryptedKey> {
    return { id: keyId, provider: 'openai', secret: 'sk-' + keyId };
  },
};

function req(): ChatRequest {
  return {
    model: 'standard',
    messages: [{ role: 'user', content: 'hi' }],
    ctx: { tenantId: 't1', traceId: 'trace-fb', ventureId: 'v1' },
  };
}

function makeAdapter(id: ProviderAdapter['id'], chat: ProviderAdapter['chat']): ProviderAdapter {
  return {
    id,
    capabilities: {
      supportsStreaming: false, supportsTools: false, supportsJsonMode: false,
      supportsJsonSchema: false, supportsVision: false, supportsEmbeddings: false,
      maxContextTokens: 1, maxOutputTokens: 1,
    },
    chat,
    async validateCredentials() { return { valid: true }; },
  };
}

function okResponse(provider: ProviderAdapter['id'], modelId: string, body: string): ChatResponse {
  return {
    content: body,
    finishReason: 'stop',
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    cost: { usd: 0.0001, provider, model: modelId },
    cached: false,
  };
}

describe('RoutingProviderClient — fallback chain', () => {
  it('falls through OpenAI → Anthropic → Gemini when earlier routes raise RateLimited', async () => {
    const openaiChat = vi.fn().mockRejectedValue(new RateLimited('openai busy', 0));
    const anthropicChat = vi.fn().mockRejectedValue(new RateLimited('anthropic busy', 0));
    const geminiChat = vi.fn().mockResolvedValue(okResponse('gemini', 'gemini-1.5-flash-latest', 'from gemini'));

    const registry = new ProviderRegistry();
    registry.register(makeAdapter('openai', openaiChat));
    registry.register(makeAdapter('anthropic', anthropicChat));
    registry.register(makeAdapter('gemini', geminiChat));

    const chain: ProviderRoute[] = [
      { provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k1' },
      { provider: 'anthropic', modelId: 'claude-3-5-haiku-latest', keyId: 'k2' },
      { provider: 'gemini', modelId: 'gemini-1.5-flash-latest', keyId: 'k3' },
    ];

    const client = new RoutingProviderClient({
      registry,
      routes: { async resolve() { return chain; } },
      keys: fakeKeys,
      budget: new InMemoryBudgetGuard({ tenantMonthlyUsd: 10, ventureUsd: 5 }),
      redactor: noopRedactor,
    });

    const res = await client.chat(req());
    expect(res.content).toBe('from gemini');
    expect(res.cost.provider).toBe('gemini');
    expect(openaiChat).toHaveBeenCalledOnce();
    expect(anthropicChat).toHaveBeenCalledOnce();
    expect(geminiChat).toHaveBeenCalledOnce();
  });

  it('falls past auth failures to the next provider', async () => {
    const azureChat = vi.fn().mockRejectedValue(new ProviderAuthError('bad'));
    const openaiChat = vi.fn().mockResolvedValue(okResponse('openai', 'gpt-4o-mini', 'from openai'));

    const registry = new ProviderRegistry();
    registry.register(makeAdapter('azure_openai', azureChat));
    registry.register(makeAdapter('openai', openaiChat));

    const chain: ProviderRoute[] = [
      { provider: 'azure_openai', modelId: 'gpt-4o', keyId: 'k_az' },
      { provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k_oa' },
    ];

    const client = new RoutingProviderClient({
      registry,
      routes: { async resolve() { return chain; } },
      keys: fakeKeys,
      budget: new InMemoryBudgetGuard({ tenantMonthlyUsd: 10, ventureUsd: 5 }),
      redactor: noopRedactor,
    });

    const res = await client.chat(req());
    expect(res.content).toBe('from openai');
  });

  it('raises ProviderUnavailableError when no adapters are registered for any route', async () => {
    const chain: ProviderRoute[] = [
      { provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k_oa' },
    ];
    const client = new RoutingProviderClient({
      registry: new ProviderRegistry(),
      routes: { async resolve() { return chain; } },
      keys: fakeKeys,
      budget: new InMemoryBudgetGuard({ tenantMonthlyUsd: 10, ventureUsd: 5 }),
      redactor: noopRedactor,
    });
    await expect(client.chat(req())).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("propagates the last error when every route in the chain fails", async () => {
    const a = vi.fn().mockRejectedValue(new RateLimited('a', 0));
    const b = vi.fn().mockRejectedValue(new ProviderAuthError('b'));
    const registry = new ProviderRegistry();
    registry.register(makeAdapter('openai', a));
    registry.register(makeAdapter('anthropic', b));

    const client = new RoutingProviderClient({
      registry,
      routes: {
        async resolve() {
          return [
            { provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k1' },
            { provider: 'anthropic', modelId: 'claude-3-5-haiku-latest', keyId: 'k2' },
          ];
        },
      },
      keys: fakeKeys,
      budget: new InMemoryBudgetGuard({ tenantMonthlyUsd: 10, ventureUsd: 5 }),
      redactor: noopRedactor,
    });
    await expect(client.chat(req())).rejects.toBeInstanceOf(ProviderAuthError);
  });
});
