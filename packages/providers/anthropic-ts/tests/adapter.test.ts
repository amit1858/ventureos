import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@ventureos/contracts';
import {
  ProviderAuthError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
  runProviderConformance,
} from '@ventureos/providers-core';

import { AnthropicAdapter, type AnthropicLike } from '../src/index';
import { costUsd, RETIRED_MODELS, DEFAULT_VALIDATION_MODEL, KNOWN_MODELS } from '../src/cost';

const KEY: DecryptedKey = { id: 'k_t', provider: 'anthropic', secret: 'sk-ant-redacted-test' };

function makeReq(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'standard',
    messages: [
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'hi' },
    ],
    ctx: { tenantId: 't1', traceId: 'trace-1' },
    ...overrides,
  };
}

function fakeClient(impl: Partial<AnthropicLike>): AnthropicLike {
  return {
    messages: { create: vi.fn() },
    models: { list: vi.fn() },
    ...impl,
  } as AnthropicLike;
}

describe('AnthropicAdapter.chat', () => {
  it('returns text content with usage and cost', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'msg_1',
      content: [{ type: 'text', text: 'hello!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 12, output_tokens: 6 },
    });
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ messages: { create } }),
    });

    const res = await adapter.chat(makeReq(), KEY, 'claude-haiku-4-5-20251001');
    expect(res.content).toBe('hello!');
    expect(res.finishReason).toBe('stop');
    expect(res.usage).toEqual({ promptTokens: 12, completionTokens: 6, totalTokens: 18 });
    expect(res.cost.provider).toBe('anthropic');
    expect(res.cost.usd).toBeCloseTo(costUsd('claude-haiku-4-5-20251001', res.usage), 12);

    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['system']).toBe('Be brief.');
    expect(params['model']).toBe('claude-haiku-4-5-20251001');
    expect(JSON.stringify(params)).not.toContain(KEY.secret);
  });

  it('parses tool_use blocks into ToolCall[]', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'msg_tools',
      content: [
        { type: 'text', text: 'thinking…' },
        { type: 'tool_use', id: 'tu_1', name: 'lookup', input: { q: 'x' } },
      ],
      stop_reason: 'tool_use',
      usage: { input_tokens: 5, output_tokens: 3 },
    });
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ messages: { create } }),
    });
    const res = await adapter.chat(makeReq(), KEY, 'claude-sonnet-4-5');
    expect(res.finishReason).toBe('tool');
    expect(res.content).toEqual([{ id: 'tu_1', name: 'lookup', arguments: { q: 'x' } }]);
  });

  it.each([
    [{ status: 401, error: { type: 'authentication_error', message: 'bad' } }, ProviderAuthError],
    [{ status: 429, error: { type: 'rate_limit_error', message: 'slow' }, headers: { 'retry-after': '3' } }, RateLimited],
    [{ status: 404, error: { type: 'not_found_error', message: 'unknown model x' } }, ProviderModelNotFoundError],
    [{ status: 503, error: { type: 'overloaded_error', message: 'busy' } }, RateLimited],
    [{ status: 500, error: { type: 'api_error', message: 'oops' } }, ProviderUnavailableError],
  ])('translates SDK error %j into the right type', async (raw, Expected) => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error('x'), raw));
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ messages: { create } }),
    });
    await expect(adapter.chat(makeReq(), KEY, 'claude-haiku-4-5-20251001')).rejects.toBeInstanceOf(Expected);
  });
});

describe('AnthropicAdapter.validateCredentials', () => {
  it('returns valid:true when models.list resolves', async () => {
    const list = vi.fn().mockResolvedValue({ data: [] });
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ models: { list } }),
    });
    expect(await adapter.validateCredentials(KEY)).toEqual({ valid: true });
  });

  it('falls back to a 1-token messages call when models.list is unavailable', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'm', content: [{ type: 'text', text: '' }], stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 0 },
    });
    const adapter = new AnthropicAdapter({
      clientFactory: () => ({ messages: { create } } as AnthropicLike),
    });
    expect(await adapter.validateCredentials(KEY)).toEqual({ valid: true });
    expect(create).toHaveBeenCalledOnce();
  });

  it('returns valid:false with stable reason on auth failure', async () => {
    const list = vi.fn().mockRejectedValue(
      Object.assign(new Error('bad key'), { status: 401, error: { type: 'authentication_error' } }),
    );
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ models: { list } }),
    });
    const r = await adapter.validateCredentials(KEY);
    expect(r).toEqual({ valid: false, reason: 'Invalid API key.' });
  });

  // Regression: BYOK validation must never reach for a retired Claude 3 / 3.5
  // model ID. The retired-fallback bug returned 404 not_found_error in the UI.
  it('never uses a retired model ID for the fallback messages.create probe', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'm', content: [{ type: 'text', text: '' }], stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 0 },
    });
    const adapter = new AnthropicAdapter({
      // Force the fallback path by omitting `models.list`.
      clientFactory: () => ({ messages: { create } } as AnthropicLike),
    });
    expect(await adapter.validateCredentials(KEY)).toEqual({ valid: true });
    expect(create).toHaveBeenCalledOnce();
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    const model = String(params['model']);
    expect(RETIRED_MODELS).not.toContain(model);
    expect(model).toBe(DEFAULT_VALIDATION_MODEL);
  });

  it('exposes only current model IDs in the BYOK catalog', () => {
    for (const m of KNOWN_MODELS) {
      expect(RETIRED_MODELS).not.toContain(m);
    }
    expect(KNOWN_MODELS).toContain(DEFAULT_VALIDATION_MODEL);
  });
});

describe('AnthropicAdapter.chat — responseFormat=json (prefill)', () => {
  it('appends an assistant `{` prefill and prepends `{` to the response content', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'msg_json',
      content: [{ type: 'text', text: '"personas":[{"id":"p1"}]}' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 10 },
    });
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ messages: { create } }),
    });

    const res = await adapter.chat(
      { ...makeReq(), responseFormat: 'json' },
      KEY,
      DEFAULT_VALIDATION_MODEL,
    );

    const params = create.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }>; system?: string };
    const last = params.messages.at(-1);
    expect(last).toEqual({ role: 'assistant', content: '{' });
    expect(params.system).toContain('Reply with ONLY a single JSON object');

    expect(typeof res.content).toBe('string');
    expect(res.content).toBe('{"personas":[{"id":"p1"}]}');
    expect(JSON.parse(res.content as string)).toEqual({ personas: [{ id: 'p1' }] });
  });

  it('does not prefill or modify content when responseFormat is unset', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'msg_text',
      content: [{ type: 'text', text: 'hello' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const adapter = new AnthropicAdapter({
      clientFactory: () => fakeClient({ messages: { create } }),
    });
    const res = await adapter.chat(makeReq(), KEY, DEFAULT_VALIDATION_MODEL);
    const params = create.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
    expect(params.messages.at(-1)).not.toEqual({ role: 'assistant', content: '{' });
    expect(res.content).toBe('hello');
  });
});

// ── Conformance ──────────────────────────────────────────────────────────────
runProviderConformance({
  runner: { describe, it, expect },
  name: 'AnthropicAdapter',
  expectedProviderId: 'anthropic',
  modelId: 'claude-haiku-4-5-20251001',
  buildAdapter: () => new AnthropicAdapter({
    clientFactory: () => ({
      messages: {
        create: async () => ({
          id: 'msg_ok',
          content: [{ type: 'text', text: 'ok' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
      models: { list: async () => ({ data: [] }) },
    }),
  }),
  buildAuthFailingAdapter: () => new AnthropicAdapter({
    clientFactory: () => ({
      messages: {
        create: async () => { throw Object.assign(new Error('nope'), { status: 401, error: { type: 'authentication_error', message: 'nope' } }); },
      },
      models: {
        list: async () => { throw Object.assign(new Error('nope'), { status: 401, error: { type: 'authentication_error', message: 'nope' } }); },
      },
    }),
  }),
});
