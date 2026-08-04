import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@foundry/contracts';
import {
  ProviderAuthError,
  ProviderModelNotFoundError,
  RateLimited,
  runProviderConformance,
} from '@foundry/providers-core';

import { GeminiAdapter, type GeminiLike, type GeminiModelLike } from '../src/index';
import { costUsd } from '../src/cost';

const KEY: DecryptedKey = { id: 'k_g', provider: 'gemini', secret: 'AIza-redacted-test-key-1234567890' };

function makeReq(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'fast',
    messages: [
      { role: 'system', content: 'Be brief.' },
      { role: 'user', content: 'hi' },
    ],
    ctx: { tenantId: 't1', traceId: 'trace-1' },
    ...overrides,
  };
}

function fakeModelClient(model: GeminiModelLike): GeminiLike {
  return { getGenerativeModel: () => model };
}

describe('GeminiAdapter.chat', () => {
  it('returns text content with usage + cost', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [{
          content: { parts: [{ text: 'hello!' }] },
          finishReason: 'STOP',
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 },
      },
    });
    const adapter = new GeminiAdapter({
      clientFactory: () => fakeModelClient({ generateContent }),
    });
    const res = await adapter.chat(makeReq(), KEY, 'gemini-1.5-flash-latest');
    expect(res.content).toBe('hello!');
    expect(res.finishReason).toBe('stop');
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 4, totalTokens: 14 });
    expect(res.cost.provider).toBe('gemini');
    expect(res.cost.usd).toBeCloseTo(costUsd('gemini-1.5-flash-latest', res.usage), 12);

    // contents must not contain system role; system is forwarded via systemInstruction.
    const sentContents = generateContent.mock.calls[0]?.[0]?.contents;
    expect(sentContents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });

  it('parses functionCall parts into ToolCall[]', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [{
          content: { parts: [{ functionCall: { name: 'lookup', args: { q: 'x' } } }] },
          finishReason: 'STOP',
        }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      },
    });
    const adapter = new GeminiAdapter({
      clientFactory: () => fakeModelClient({ generateContent }),
    });
    const res = await adapter.chat(makeReq(), KEY, 'gemini-1.5-pro-latest');
    expect(res.content).toEqual([{ id: 'gem_0', name: 'lookup', arguments: { q: 'x' } }]);
  });

  it.each([
    [{ status: 401, message: 'API key invalid' }, ProviderAuthError],
    [{ status: 429, message: 'quota exceeded' }, RateLimited],
    [{ status: 404, message: 'model gemini-x not found' }, ProviderModelNotFoundError],
  ])('translates SDK error %j into the right type', async (raw, Expected) => {
    const generateContent = vi.fn().mockRejectedValue(Object.assign(new Error(raw.message), raw));
    const adapter = new GeminiAdapter({
      clientFactory: () => fakeModelClient({ generateContent }),
    });
    await expect(adapter.chat(makeReq(), KEY, 'gemini-1.5-flash-latest')).rejects.toBeInstanceOf(Expected);
  });

  it('maps SAFETY finish reason to content_filter', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'SAFETY' }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 0, totalTokenCount: 1 },
      },
    });
    const adapter = new GeminiAdapter({
      clientFactory: () => fakeModelClient({ generateContent }),
    });
    const res = await adapter.chat(makeReq(), KEY, 'gemini-1.5-flash-latest');
    expect(res.finishReason).toBe('content_filter');
  });
});

describe('GeminiAdapter.validateCredentials', () => {
  it('returns valid:true when generateContent succeeds', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      response: {
        candidates: [{ content: { parts: [{ text: 'pong' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      },
    });
    const adapter = new GeminiAdapter({
      clientFactory: () => fakeModelClient({ generateContent }),
    });
    expect(await adapter.validateCredentials(KEY)).toEqual({ valid: true });
  });

  it('returns valid:false with stable reason on auth failure', async () => {
    const generateContent = vi.fn().mockRejectedValue(
      Object.assign(new Error('API key not valid'), { status: 401 }),
    );
    const adapter = new GeminiAdapter({
      clientFactory: () => fakeModelClient({ generateContent }),
    });
    const r = await adapter.validateCredentials(KEY);
    expect(r).toEqual({ valid: false, reason: 'Invalid API key.' });
  });
});

runProviderConformance({
  runner: { describe, it, expect },
  name: 'GeminiAdapter',
  expectedProviderId: 'gemini',
  modelId: 'gemini-1.5-flash-latest',
  buildAdapter: () => new GeminiAdapter({
    clientFactory: () => ({
      getGenerativeModel: () => ({
        generateContent: async () => ({
          response: {
            candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
          },
        }),
      }),
    }),
  }),
  buildAuthFailingAdapter: () => new GeminiAdapter({
    clientFactory: () => ({
      getGenerativeModel: () => ({
        generateContent: async () => { throw Object.assign(new Error('bad key'), { status: 401 }); },
      }),
    }),
  }),
});
