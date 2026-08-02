/**
 * Integration test: only runs when OPENAI_API_KEY is present in the environment.
 * Otherwise the suite is skipped — CI without the secret stays green.
 */
import { describe, expect, it } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@foundry/contracts';
import { OpenAiAdapter } from '../src/index';

const KEY = process.env['OPENAI_API_KEY'];

describe.skipIf(!KEY)('OpenAiAdapter (live)', () => {
  const decrypted: DecryptedKey = { id: 'k_live', provider: 'openai', secret: KEY ?? '' };
  const adapter = new OpenAiAdapter();

  it('validateCredentials returns valid:true for a working key', async () => {
    const r = await adapter.validateCredentials(decrypted);
    expect(r).toEqual({ valid: true });
  }, 30_000);

  it('chat returns a non-empty response from gpt-4o-mini', async () => {
    const req: ChatRequest = {
      model: 'fast',
      messages: [
        { role: 'system', content: 'Answer in exactly one word.' },
        { role: 'user', content: 'Say "ok".' },
      ],
      maxTokens: 5,
      temperature: 0,
      ctx: { tenantId: 'live-test', traceId: 'live-1' },
    };
    const res = await adapter.chat(req, decrypted, 'gpt-4o-mini');
    expect(typeof res.content).toBe('string');
    expect((res.content as string).length).toBeGreaterThan(0);
    expect(res.usage.totalTokens).toBeGreaterThan(0);
    expect(res.cost.usd).toBeGreaterThan(0);
  }, 60_000);
});
