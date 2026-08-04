import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@foundry/contracts';

import { AzureOpenAiAdapter, isReasoningDeployment } from '../src/index';

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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function okBody() {
  return {
    id: 'cmpl_az',
    choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('isReasoningDeployment', () => {
  it('detects reasoning deployment names, best-effort', () => {
    expect(isReasoningDeployment('gpt-4o-mini')).toBe(false);
    expect(isReasoningDeployment('prod-gpt-4o')).toBe(false);
    expect(isReasoningDeployment('gpt-4.1')).toBe(false);
    expect(isReasoningDeployment('o3')).toBe(true);
    expect(isReasoningDeployment('my-o4-mini')).toBe(true);
    expect(isReasoningDeployment('gpt-5-prod')).toBe(true);
    expect(isReasoningDeployment('gpt5')).toBe(true);
  });
});

describe('AzureOpenAiAdapter reasoning contract', () => {
  it('chat deployment: max_tokens + temperature forwarded', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(okBody()));
    const adapter = new AzureOpenAiAdapter({ endpoint: ENDPOINT, fetchImpl });
    await adapter.chat(makeReq({ temperature: 0.2, maxTokens: 1024 }), KEY, 'gpt-4o-mini');

    const body = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body['max_tokens']).toBe(1024);
    expect(body['temperature']).toBe(0.2);
    expect(body['max_completion_tokens']).toBeUndefined();
  });

  it('reasoning deployment: max_completion_tokens, no temperature, floor applied', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(okBody()));
    const adapter = new AzureOpenAiAdapter({ endpoint: ENDPOINT, fetchImpl });
    await adapter.chat(makeReq({ temperature: 0.2, maxTokens: 256 }), KEY, 'o4-mini');

    const body = JSON.parse(String((fetchImpl.mock.calls[0]?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body['max_tokens']).toBeUndefined();
    expect(body['temperature']).toBeUndefined();
    expect(body['max_completion_tokens']).toBe(4_096);
  });
});
