import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, DecryptedKey } from '@foundry/contracts';

import { OpenAiAdapter, type OpenAiLike } from '../src/index';
import {
  OPENAI_KNOWN_MODELS,
  OPENAI_RECOMMENDED_MODELS,
  REASONING_MIN_OUTPUT_TOKENS,
  isReasoningModel,
  maxTokenParamFor,
  openAiModelSpec,
  supportsTemperature,
} from '../src/models';

const KEY: DecryptedKey = { id: 'k_test', provider: 'openai', secret: 'sk-test-redacted' };

function makeReq(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: 'standard',
    messages: [{ role: 'user', content: 'hello' }],
    ctx: { tenantId: 't1', traceId: 'trace-1' },
    ...overrides,
  };
}

function fakeClient(create: ReturnType<typeof vi.fn>): OpenAiLike {
  return {
    chat: { completions: { create } },
    models: { list: vi.fn() },
  } as OpenAiLike;
}

function okCompletion() {
  return {
    id: 'cmpl_ok',
    choices: [{ message: { content: '{}' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('OpenAI model registry', () => {
  it('classifies reasoning vs chat models, with a heuristic for unknown ids', () => {
    expect(isReasoningModel('gpt-4o-mini')).toBe(false);
    expect(isReasoningModel('gpt-4.1')).toBe(false);
    expect(isReasoningModel('gpt-5')).toBe(true);
    expect(isReasoningModel('gpt-5-mini')).toBe(true);
    expect(isReasoningModel('o3')).toBe(true);
    expect(isReasoningModel('o4-mini')).toBe(true);
    // Heuristic fallback for ids not in the registry:
    expect(isReasoningModel('o5-preview')).toBe(true);
    expect(isReasoningModel('gpt-5.1')).toBe(true);
    expect(isReasoningModel('some-unknown-model')).toBe(false);
  });

  it('maps the correct max-token param + temperature support per model', () => {
    expect(maxTokenParamFor('gpt-4o-mini')).toBe('max_tokens');
    expect(maxTokenParamFor('gpt-5')).toBe('max_completion_tokens');
    expect(supportsTemperature('gpt-4o-mini')).toBe(true);
    expect(supportsTemperature('gpt-5')).toBe(false);
    expect(supportsTemperature('o4-mini')).toBe(false);
  });

  it('exposes a catalog that includes new + legacy models and a recommended shortlist', () => {
    expect(OPENAI_KNOWN_MODELS).toContain('gpt-4o-mini');
    expect(OPENAI_KNOWN_MODELS).toContain('gpt-4.1');
    expect(OPENAI_KNOWN_MODELS).toContain('gpt-5');
    expect(OPENAI_KNOWN_MODELS).toContain('gpt-4-turbo');
    expect(OPENAI_RECOMMENDED_MODELS).toEqual(['gpt-4o-mini', 'gpt-4.1']);
  });

  it('returns undefined spec for unknown ids', () => {
    expect(openAiModelSpec('made-up-model')).toBeUndefined();
    expect(openAiModelSpec('gpt-4o-mini')?.paramStyle).toBe('chat');
  });
});

describe('OpenAiAdapter.chat request shaping', () => {
  it('chat models use max_tokens + forward temperature (legacy contract unchanged)', async () => {
    const create = vi.fn().mockResolvedValue(okCompletion());
    const adapter = new OpenAiAdapter({ clientFactory: () => fakeClient(create) });
    await adapter.chat(makeReq({ temperature: 0.7, maxTokens: 1800 }), KEY, 'gpt-4o-mini');

    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['max_tokens']).toBe(1800);
    expect(params['temperature']).toBe(0.7);
    expect(params['max_completion_tokens']).toBeUndefined();
  });

  it('reasoning models use max_completion_tokens, omit temperature, and honor a floor', async () => {
    const create = vi.fn().mockResolvedValue(okCompletion());
    const adapter = new OpenAiAdapter({ clientFactory: () => fakeClient(create) });
    await adapter.chat(makeReq({ temperature: 0.7, maxTokens: 256 }), KEY, 'gpt-5');

    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['max_tokens']).toBeUndefined();
    expect(params['temperature']).toBeUndefined();
    expect(params['max_completion_tokens']).toBe(REASONING_MIN_OUTPUT_TOKENS);
  });

  it('reasoning models keep a larger requested budget above the floor', async () => {
    const create = vi.fn().mockResolvedValue(okCompletion());
    const adapter = new OpenAiAdapter({ clientFactory: () => fakeClient(create) });
    await adapter.chat(makeReq({ maxTokens: 20_000 }), KEY, 'o4-mini');

    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['max_completion_tokens']).toBe(20_000);
  });

  it('unknown reasoning-style ids are handled via the heuristic', async () => {
    const create = vi.fn().mockResolvedValue(okCompletion());
    const adapter = new OpenAiAdapter({ clientFactory: () => fakeClient(create) });
    await adapter.chat(makeReq({ temperature: 0.5, maxTokens: 512 }), KEY, 'o5-preview');

    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params['temperature']).toBeUndefined();
    expect(params['max_completion_tokens']).toBe(REASONING_MIN_OUTPUT_TOKENS);
  });
});
