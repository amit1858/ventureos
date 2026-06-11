import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@ventureos/contracts';
import {
  ProviderAuthError,
  ProviderModelNotFoundError,
  ProviderUnavailableError,
  RateLimited,
  runProviderConformance,
} from '@ventureos/providers-core';

import { AzureOpenAiAdapter } from '../src/index';
import { costUsd } from '../src/cost';

const KEY: DecryptedKey = {
  id: 'k_az',
  provider: 'azure_openai',
  secret: 'azure-redacted-test-key-32chars-aaaaaaaaaaaa',
};

const ENDPOINT = 'https://example-resource.openai.azure.com';

function makeReq(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'standard',
    messages: [{ role: 'user', content: 'hi' }],
    ctx: { tenantId: 't1', traceId: 'trace-1' },
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

describe('AzureOpenAiAdapter.chat', () => {
  it('POSTs to the deployment endpoint, sends api-key header, returns ChatResponse', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'cmpl_az_1',
        choices: [{ message: { content: 'hi back' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
      }),
    );
    const adapter = new AzureOpenAiAdapter({ endpoint: ENDPOINT, fetchImpl });

    const res = await adapter.chat(makeReq(), KEY, 'gpt-4o-mini');
    expect(res.content).toBe('hi back');
    expect(res.finishReason).toBe('stop');
    expect(res.usage).toEqual({ promptTokens: 7, completionTokens: 3, totalTokens: 10 });
    expect(res.cost.provider).toBe('azure_openai');
    expect(res.cost.usd).toBeCloseTo(costUsd('gpt-4o-mini', res.usage), 12);
    expect(res.providerRequestId).toBe('cmpl_az_1');

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      `${ENDPOINT}/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-08-01-preview`,
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['api-key']).toBe(KEY.secret);
    // Plaintext key must NOT appear in the request body.
    expect(String((init as RequestInit).body)).not.toContain(KEY.secret);
  });

  it.each([
    [{ status: 401 }, ProviderAuthError],
    [{ status: 429, headers: { 'retry-after': '5' } }, RateLimited],
    [{ status: 404 }, ProviderModelNotFoundError],
    [{ status: 503 }, ProviderUnavailableError],
  ])('translates HTTP %j into the right error type', async (resp, Expected) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'x', message: 'azure says no' } }, resp),
    );
    const adapter = new AzureOpenAiAdapter({ endpoint: ENDPOINT, fetchImpl });
    await expect(adapter.chat(makeReq(), KEY, 'gpt-4o')).rejects.toBeInstanceOf(Expected);
  });
});

describe('AzureOpenAiAdapter.validateCredentials', () => {
  it('returns valid:true when GET /models 200s', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    const adapter = new AzureOpenAiAdapter({ endpoint: ENDPOINT, fetchImpl });
    expect(await adapter.validateCredentials(KEY)).toEqual({ valid: true });
    const url = String(fetchImpl.mock.calls[0]?.[0]);
    expect(url).toContain('/openai/models?api-version=');
  });

  it('returns valid:false with stable reason on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'bad' } }, { status: 401 }));
    const adapter = new AzureOpenAiAdapter({ endpoint: ENDPOINT, fetchImpl });
    expect(await adapter.validateCredentials(KEY)).toEqual({ valid: false, reason: 'Invalid API key.' });
  });
});

runProviderConformance({
  runner: { describe, it, expect },
  name: 'AzureOpenAiAdapter',
  expectedProviderId: 'azure_openai',
  modelId: 'gpt-4o-mini',
  buildAdapter: () => new AzureOpenAiAdapter({
    endpoint: ENDPOINT,
    fetchImpl: async () => jsonResponse({
      id: 'cmpl_ok',
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  }),
  buildAuthFailingAdapter: () => new AzureOpenAiAdapter({
    endpoint: ENDPOINT,
    fetchImpl: async () => jsonResponse({ error: { message: 'bad' } }, { status: 401 }),
  }),
});
