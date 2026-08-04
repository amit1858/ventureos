import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatResponse } from '@foundry/contracts';

import { generateStructured, StructuredParseError } from '../src/index';

function baseRequest(): ChatRequest {
  return {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a JSON API.' },
      { role: 'user', content: 'Return the object.' },
    ],
    temperature: 0.7,
    maxTokens: 1000,
    responseFormat: 'json',
    ctx: { tenantId: 't1', traceId: 'trace-1' },
  };
}

function mkRes(content: string, finishReason: ChatResponse['finishReason'] = 'stop'): ChatResponse {
  return {
    content,
    finishReason,
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    cost: { usd: 0.001, provider: 'openai', model: 'gpt-4o-mini' },
    cached: false,
  };
}

/** Chat mock that returns queued responses and records the requests it saw. */
function queuedChat(responses: ChatResponse[]) {
  const seen: ChatRequest[] = [];
  let i = 0;
  const chat = vi.fn(async (req: ChatRequest) => {
    seen.push(req);
    return responses[Math.min(i++, responses.length - 1)];
  });
  return { chat, seen };
}

describe('generateStructured', () => {
  it('returns parsed data on a clean first response (status ok, 0 retries)', async () => {
    const { chat } = queuedChat([mkRes(JSON.stringify({ hello: 'world' }))]);
    const { data, telemetry } = await generateStructured<{ hello: string }>({
      chat,
      request: baseRequest(),
    });
    expect(data).toEqual({ hello: 'world' });
    expect(telemetry.finalStatus).toBe('ok');
    expect(telemetry.retryCount).toBe(0);
    expect(telemetry.repairApplied).toBe(false);
    expect(chat).toHaveBeenCalledOnce();
  });

  it('repairs malformed JSON in-place without a retry (status repaired)', async () => {
    const { chat } = queuedChat([mkRes('{"quote": "he said "hi" there"}')]);
    const { data, telemetry } = await generateStructured<{ quote: string }>({
      chat,
      request: baseRequest(),
    });
    expect(data).toEqual({ quote: 'he said "hi" there' });
    expect(telemetry.finalStatus).toBe('repaired');
    expect(telemetry.repairApplied).toBe(true);
    expect(telemetry.repairSucceeded).toBe(true);
    expect(chat).toHaveBeenCalledOnce();
  });

  it('retries once on unrecoverable JSON then succeeds (status retried)', async () => {
    const { chat, seen } = queuedChat([
      mkRes('total garbage, no json'),
      mkRes(JSON.stringify({ ok: true })),
    ]);
    const { data, telemetry } = await generateStructured<{ ok: boolean }>({
      chat,
      request: baseRequest(),
    });
    expect(data).toEqual({ ok: true });
    expect(telemetry.finalStatus).toBe('retried');
    expect(telemetry.retryCount).toBe(1);
    expect(chat).toHaveBeenCalledTimes(2);
    // The retry instruction is merged into the final user turn (provider-neutral).
    const retryUser = seen[1].messages.filter((m) => m.role === 'user').at(-1);
    expect(retryUser?.content).toContain('valid JSON object');
  });

  it('throws StructuredParseError after exhausting the single retry', async () => {
    const { chat } = queuedChat([mkRes('nope'), mkRes('still nope')]);
    await expect(
      generateStructured({ chat, request: baseRequest() }),
    ).rejects.toBeInstanceOf(StructuredParseError);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it('retries when coerce (schema validation) rejects, then accepts', async () => {
    const { chat } = queuedChat([
      mkRes(JSON.stringify({ n: 'not-a-number' })),
      mkRes(JSON.stringify({ n: 42 })),
    ]);
    const { data, telemetry } = await generateStructured<{ n: number }>({
      chat,
      request: baseRequest(),
      coerce: (parsed) => {
        const o = parsed as { n: unknown };
        if (typeof o.n !== 'number') throw new Error('n must be a number');
        return { n: o.n };
      },
    });
    expect(data).toEqual({ n: 42 });
    expect(telemetry.retryCount).toBe(1);
  });

  it('raises the token budget on retry when the prior finish was length', async () => {
    const { chat, seen } = queuedChat([
      mkRes('response was cut off with no json object at all', 'length'),
      mkRes(JSON.stringify({ partial: 'ok' })),
    ]);
    await generateStructured({
      chat,
      request: baseRequest(),
      retryMaxTokens: 8192,
    });
    expect(seen[0].maxTokens).toBe(1000);
    expect(seen[1].maxTokens).toBe(8192);
  });

  it('does not mutate the caller request object', async () => {
    const req = baseRequest();
    const snapshot = JSON.stringify(req);
    const { chat } = queuedChat([mkRes('bad'), mkRes(JSON.stringify({ a: 1 }))]);
    await generateStructured({ chat, request: req, retryMaxTokens: 4096 });
    expect(JSON.stringify(req)).toBe(snapshot);
  });
});
