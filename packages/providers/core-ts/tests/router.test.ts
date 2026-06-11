import { describe, expect, it } from 'vitest';
import type { ChatRequest, DecryptedKey, ProviderRoute } from '@ventureos/contracts';
import {
  BudgetExceeded,
  InMemoryBudgetGuard,
  MockProvider,
  ProviderRegistry,
  RoutingProviderClient,
} from '../src/index';

const noopRedactor = { redact: (s: string) => s };

const fakeKeys = {
  async resolve(keyId: string): Promise<DecryptedKey> {
    return { id: keyId, provider: 'openai', secret: 'sk-test-' + keyId };
  },
};

function makeReq(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'standard',
    messages: [{ role: 'user', content: 'hi' }],
    ctx: { tenantId: 't1', traceId: 'trace-1', ventureId: 'v1' },
    ...overrides,
  };
}

describe('RoutingProviderClient', () => {
  it('routes a request to the first registered provider', async () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider('hello', 0.001));
    const routes: ProviderRoute[] = [{ provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k_abc' }];

    const client = new RoutingProviderClient({
      registry,
      routes: { async resolve() { return routes; } },
      keys: fakeKeys,
      budget: new InMemoryBudgetGuard({ tenantMonthlyUsd: 10, ventureUsd: 5 }),
      redactor: noopRedactor,
    });

    const res = await client.chat(makeReq());
    expect(res.content).toBe('hello');
    expect(res.cost.model).toBe('gpt-4o-mini');
  });

  it('refuses to call when budget would be exceeded', async () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider());
    const client = new RoutingProviderClient({
      registry,
      routes: { async resolve() { return [{ provider: 'openai', modelId: 'm', keyId: 'k_x' }]; } },
      keys: fakeKeys,
      budget: new InMemoryBudgetGuard({ tenantMonthlyUsd: 0, ventureUsd: 5 }),
      redactor: noopRedactor,
      costEstimateUsd: () => 0.5,
    });
    await expect(client.chat(makeReq())).rejects.toBeInstanceOf(BudgetExceeded);
  });
});
