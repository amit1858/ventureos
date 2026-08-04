import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@foundry/contracts';
import {
  ProviderAuthError,
  ProviderContentFilterError,
  ProviderError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
  runProviderConformance,
} from '@foundry/providers-core';

import { OpenAiAdapter, type OpenAiLike } from '../src/index';
import { costUsd, estimateCostUsd, pricingFor } from '../src/cost';

const KEY: DecryptedKey = { id: 'k_test', provider: 'openai', secret: 'sk-test-redacted' };

function makeReq(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'standard',
    messages: [{ role: 'user', content: 'hello' }],
    ctx: { tenantId: 't1', traceId: 'trace-1' },
    ...overrides,
  };
}

function fakeClient(impl: Partial<OpenAiLike>): OpenAiLike {
  return {
    chat: { completions: { create: vi.fn() } },
    models: { list: vi.fn() },
    ...impl,
  } as OpenAiLike;
}

describe('OpenAiAdapter.chat', () => {
  it('translates a text completion into a ChatResponse with cost', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'cmpl_abc',
      choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ chat: { completions: { create } } }),
    });
    const res = await adapter.chat(makeReq(), KEY, 'gpt-4o-mini');

    expect(res.content).toBe('hi there');
    expect(res.finishReason).toBe('stop');
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
    expect(res.cost.provider).toBe('openai');
    expect(res.cost.model).toBe('gpt-4o-mini');
    expect(res.cost.usd).toBeCloseTo(costUsd('gpt-4o-mini', res.usage), 12);
    expect(res.providerRequestId).toBe('cmpl_abc');

    // Confirm the request was shaped correctly + the plaintext key was NOT in the params.
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['model']).toBe('gpt-4o-mini');
    expect(JSON.stringify(params)).not.toContain(KEY.secret);
  });

  it('parses tool calls into structured ToolCall[]', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'cmpl_tools',
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call_1',
            function: { name: 'get_weather', arguments: '{"city":"Seattle"}' },
          }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
    });
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ chat: { completions: { create } } }),
    });
    const res = await adapter.chat(makeReq(), KEY, 'gpt-4o');

    expect(res.finishReason).toBe('tool');
    expect(Array.isArray(res.content)).toBe(true);
    expect(res.content).toEqual([
      { id: 'call_1', name: 'get_weather', arguments: { city: 'Seattle' } },
    ]);
  });

  it('forwards JSON-schema response_format correctly', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'cmpl_json',
      choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ chat: { completions: { create } } }),
    });
    await adapter.chat(
      makeReq({ responseFormat: { jsonSchema: { type: 'object' } } }),
      KEY,
      'gpt-4o',
    );
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['response_format']).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'response', strict: true },
    });
  });

  it.each([
    [{ status: 401, message: 'bad key' }, ProviderAuthError],
    [{ status: 429, message: 'slow down', headers: { 'retry-after': '2' } }, RateLimited],
    [{ status: 404, message: 'The model `xyz` does not exist' }, ProviderModelNotFoundError],
    [{ code: 'content_filter', message: 'filtered' }, ProviderContentFilterError],
    [{ status: 503, message: 'upstream' }, ProviderUnavailableError],
    [{ message: 'something' }, ProviderError],
  ])('translates SDK error %j into the right type', async (raw, Expected) => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error(String(raw.message)), raw));
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ chat: { completions: { create } } }),
    });
    await expect(adapter.chat(makeReq(), KEY, 'gpt-4o')).rejects.toBeInstanceOf(Expected);
  });
});

describe('OpenAiAdapter.validateCredentials', () => {
  it('returns valid:true when models.list succeeds', async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ models: { list } }),
    });
    const result = await adapter.validateCredentials(KEY);
    expect(result).toEqual({ valid: true });
    expect(list).toHaveBeenCalledOnce();
  });

  it('returns valid:false with stable reason on 401, without echoing the secret', async () => {
    const list = vi.fn().mockRejectedValue(Object.assign(new Error('bad key'), { status: 401 }));
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ models: { list } }),
    });
    const result = await adapter.validateCredentials(KEY);
    expect(result).toEqual({ valid: false, reason: 'Invalid API key.' });
    expect(JSON.stringify(result)).not.toContain(KEY.secret);
  });

  it('does not throw on transport errors; returns mapped reason', async () => {
    const list = vi.fn().mockRejectedValue(Object.assign(new Error('upstream down'), { status: 502 }));
    const adapter = new OpenAiAdapter({
      clientFactory: () => fakeClient({ models: { list } }),
    });
    const result = await adapter.validateCredentials(KEY);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('upstream down');
  });
});

describe('cost table', () => {
  it('returns zero pricing for unknown models', () => {
    expect(pricingFor('made-up-model')).toEqual({ inputUsdPer1k: 0, outputUsdPer1k: 0 });
    expect(costUsd('made-up-model', { promptTokens: 1000, completionTokens: 1000 })).toBe(0);
  });

  it('estimates cost from character count + max output tokens', () => {
    const est = estimateCostUsd('gpt-4o-mini', { totalCharacters: 4000, maxOutputTokens: 100 });
    // 4000 chars ≈ 1000 input tokens; 100 output tokens.
    // 1000/1000 * 0.00015 + 100/1000 * 0.0006 = 0.00015 + 0.00006 = 0.00021
    expect(est).toBeCloseTo(0.00021, 8);
  });
});

runProviderConformance({
  runner: { describe, it, expect },
  name: 'OpenAiAdapter',
  expectedProviderId: 'openai',
  modelId: 'gpt-4o-mini',
  buildAdapter: () => new OpenAiAdapter({
    clientFactory: () => fakeClient({
      chat: { completions: { create: vi.fn().mockResolvedValue({
        id: 'cmpl_ok',
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }) } },
      models: { list: vi.fn().mockResolvedValue({ data: [] }) },
    }),
  }),
  buildAuthFailingAdapter: () => new OpenAiAdapter({
    clientFactory: () => fakeClient({
      chat: { completions: { create: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 401 })) } },
      models: { list: vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 401 })) },
    }),
  }),
});
