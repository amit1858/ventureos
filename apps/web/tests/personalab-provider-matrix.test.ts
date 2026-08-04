import { describe, expect, it, vi } from 'vitest';
import type { ChatRequest, ChatResponse, DecryptedKey, ProviderId } from '@foundry/contracts';
import { PersonaLab, type PersonaLabBrief } from '@foundry/personalab';
import { OpenAiAdapter } from '@foundry/providers-openai';
import { AnthropicAdapter } from '@foundry/providers-anthropic';
import { GeminiAdapter } from '@foundry/providers-gemini';

/**
 * Provider-parity proof for Step 8: the SAME PersonaLab workflow
 * (`generatePersonas`) must succeed identically regardless of provider/model —
 * OpenAI chat, OpenAI reasoning, Anthropic, and Gemini — because the provider
 * abstraction normalizes text output + JSON extraction. Live keys aren't used;
 * each real adapter is driven by an injected fake SDK client returning a
 * provider-shaped raw response carrying the same JSON payload.
 */
const PERSONAS_JSON = JSON.stringify({
  personas: [
    { name: 'Ops Lead Olivia', role: 'Head of Operations' },
    { name: 'CFO Carla', role: 'Chief Financial Officer' },
    { name: 'Engineer Evan', role: 'Staff Engineer' },
  ],
});

const BRIEF: PersonaLabBrief = {
  businessIdea: 'AI meeting-notes assistant',
  targetMarket: 'SMB SaaS teams',
  customerType: 'B2B',
  region: 'US',
  businessSize: 'SMB',
};

function keyFor(provider: ProviderId): DecryptedKey {
  return { id: 'k', provider, secret: 'redacted-secret' };
}

// ── OpenAI (drives both a chat model and a reasoning model) ─────────────────
const openai = new OpenAiAdapter({
  clientFactory: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          id: 'cmpl',
          choices: [{ message: { content: PERSONAS_JSON }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      },
    },
    models: { list: vi.fn() },
  }),
});

const anthropic = new AnthropicAdapter({
  clientFactory: () => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        id: 'msg',
        content: [{ type: 'text', text: PERSONAS_JSON }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    },
  }),
});

const gemini = new GeminiAdapter({
  clientFactory: () => ({
    getGenerativeModel: () => ({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          candidates: [{ content: { parts: [{ text: PERSONAS_JSON }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
        },
      }),
    }),
  }),
});

type Case = [label: string, chat: (req: ChatRequest) => Promise<ChatResponse>];

const CASES: Case[] = [
  ['openai chat (gpt-4o-mini)', (req) => openai.chat(req, keyFor('openai'), 'gpt-4o-mini')],
  ['openai reasoning (gpt-5)', (req) => openai.chat(req, keyFor('openai'), 'gpt-5')],
  ['anthropic (claude-sonnet-4-5)', (req) => anthropic.chat(req, keyFor('anthropic'), 'claude-sonnet-4-5')],
  ['gemini (gemini-2.5-flash)', (req) => gemini.chat(req, keyFor('gemini'), 'gemini-2.5-flash')],
];

describe('PersonaLab workflow parity across providers', () => {
  it.each(CASES)('generatePersonas succeeds identically for %s', async (_label, chat) => {
    const lab = new PersonaLab(chat, { model: 'm', ctx: { tenantId: 't', traceId: 'tr' } });
    const personas = await lab.generatePersonas({ brief: BRIEF, n: 3 });

    expect(personas).toHaveLength(3);
    expect(personas.map((p) => p.name)).toEqual([
      'Ops Lead Olivia',
      'CFO Carla',
      'Engineer Evan',
    ]);
    expect(personas[0]?.role).toBe('Head of Operations');
  });
});
