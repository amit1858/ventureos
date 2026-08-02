import { describe, expect, it } from 'vitest';
import type { ProviderConfig } from '@foundry/contracts';
import { ConfigBasedRouteResolver, ProviderUnavailableError } from '../src/index';

const cfg: ProviderConfig = {
  tenantId: 't1',
  defaultProvider: 'openai',
  routes: {
    flagship: [
      { provider: 'openai', modelId: 'gpt-4o', keyId: 'k_AAAAAAAAAAAAAAAAAAAAAAAAAA' },
      { provider: 'anthropic', modelId: 'claude-3-5-sonnet', keyId: 'k_BBBBBBBBBBBBBBBBBBBBBBBBBB' },
    ],
    standard: [
      { provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k_CCCCCCCCCCCCCCCCCCCCCCCCCC' },
    ],
    fast: [
      { provider: 'openai', modelId: 'gpt-4o-mini', keyId: 'k_CCCCCCCCCCCCCCCCCCCCCCCCCC' },
    ],
  },
};

describe('ConfigBasedRouteResolver', () => {
  const r = new ConfigBasedRouteResolver(new Map([[cfg.tenantId, cfg]]));

  it('returns the configured chain for a logical model', async () => {
    const chain = await r.resolve('flagship', { tenantId: 't1' });
    expect(chain).toHaveLength(2);
    expect(chain[0]?.provider).toBe('openai');
  });

  it('returns matching routes for a concrete model that is in the config', async () => {
    const chain = await r.resolve('gpt-4o-mini', { tenantId: 't1' });
    expect(chain.every((c) => c.modelId === 'gpt-4o-mini')).toBe(true);
  });

  it('rejects unknown tenants', async () => {
    await expect(r.resolve('flagship', { tenantId: 'nope' })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it('rejects models not in any route', async () => {
    await expect(r.resolve('gpt-4o-xl', { tenantId: 't1' })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it("aliases 'default' to standard then flagship", async () => {
    const chain = await r.resolve('default', { tenantId: 't1' });
    // standard (1 route) + flagship (2 routes) = 3 entries
    expect(chain).toHaveLength(3);
    expect(chain[0]?.modelId).toBe('gpt-4o-mini');
    expect(chain[1]?.provider).toBe('openai');
    expect(chain[2]?.provider).toBe('anthropic');
  });

  it("'auto' resolves to the same default chain", async () => {
    const chain = await r.resolve('auto', { tenantId: 't1' });
    expect(chain).toHaveLength(3);
  });
});
