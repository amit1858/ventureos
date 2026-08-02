import OpenAI from 'openai';

import type {
  ChatRequest,
  ChatResponse,
  DecryptedKey,
  ProviderCapabilities,
  ToolCall,
} from '@foundry/contracts';
import {
  ProviderError,
  type ProviderAdapter,
} from '@foundry/providers-core';

import { costUsd } from './cost';
import { translateError } from './errors-map';

export { costUsd, estimateCostUsd, pricingFor } from './cost';
export { translateError } from './errors-map';

/** Static catalog used by the BYOK UI's model picker. */
export const OPENAI_KNOWN_MODELS: ReadonlyArray<string> = Object.freeze([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
]);

/**
 * Minimal structural slice of the `openai` SDK that this adapter actually uses.
 * Letting tests inject a stub avoids `vi.mock('openai', ...)` plumbing while still
 * exercising every translation path.
 */
export interface OpenAiLike {
  chat: { completions: { create: (params: Record<string, unknown>) => Promise<RawCompletion> } };
  models: { list: () => Promise<unknown> };
}

interface RawCompletion {
  id: string;
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface OpenAiAdapterOptions {
  /** Inject a fake client for tests. Production code leaves this undefined. */
  clientFactory?: (key: DecryptedKey) => OpenAiLike;
}

/**
 * OpenAI adapter. This file is the ONLY place in the repo that may `import 'openai'`.
 */
export class OpenAiAdapter implements ProviderAdapter {
  readonly id = 'openai' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsTools: true,
    supportsJsonMode: true,
    supportsJsonSchema: true,
    supportsVision: true,
    supportsEmbeddings: true,
    maxContextTokens: 128_000,
    maxOutputTokens: 16_384,
  };

  constructor(private readonly opts: OpenAiAdapterOptions = {}) {}

  private client(key: DecryptedKey): OpenAiLike {
    if (this.opts.clientFactory) return this.opts.clientFactory(key);
    return new OpenAI({ apiKey: key.secret }) as unknown as OpenAiLike;
  }

  async chat(req: ChatRequest, key: DecryptedKey, modelId: string): Promise<ChatResponse> {
    const client = this.client(key);

    const params: Record<string, unknown> = {
      model: modelId,
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name !== undefined ? { name: m.name } : {}),
        ...(m.toolCallId !== undefined ? { tool_call_id: m.toolCallId } : {}),
      })),
    };
    if (req.temperature !== undefined) params['temperature'] = req.temperature;
    if (req.topP !== undefined) params['top_p'] = req.topP;
    if (req.maxTokens !== undefined) params['max_tokens'] = req.maxTokens;
    if (req.seed !== undefined) params['seed'] = req.seed;
    if (req.tools && req.tools.length > 0) {
      params['tools'] = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parametersSchema,
        },
      }));
    }
    if (req.toolChoice !== undefined) {
      params['tool_choice'] = typeof req.toolChoice === 'string'
        ? req.toolChoice
        : { type: 'function', function: { name: req.toolChoice.name } };
    }
    if (req.responseFormat !== undefined) {
      if (req.responseFormat === 'text') params['response_format'] = { type: 'text' };
      else if (req.responseFormat === 'json') params['response_format'] = { type: 'json_object' };
      else params['response_format'] = {
        type: 'json_schema',
        json_schema: { name: 'response', schema: req.responseFormat.jsonSchema, strict: true },
      };
    }

    let completion: RawCompletion;
    try {
      completion = await client.chat.completions.create(params);
    } catch (e) {
      throw translateError(e);
    }

    const choice = completion.choices[0];
    if (!choice) {
      throw new ProviderError('OpenAI returned an empty choices array.', completion.id);
    }

    const usage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    };

    let content: string | ToolCall[];
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      content = choice.message.tool_calls.map((tc) => {
        let args: Record<string, unknown> = {};
        try {
          args = tc.function.arguments ? (JSON.parse(tc.function.arguments) as Record<string, unknown>) : {};
        } catch {
          args = { _raw: tc.function.arguments };
        }
        return { id: tc.id, name: tc.function.name, arguments: args };
      });
    } else {
      content = choice.message.content ?? '';
    }

    return {
      content,
      finishReason: mapFinishReason(choice.finish_reason),
      usage,
      cost: { usd: costUsd(modelId, usage), provider: 'openai', model: modelId },
      cached: false,
      providerRequestId: completion.id,
    };
  }

  async validateCredentials(key: DecryptedKey): Promise<{ valid: boolean; reason?: string }> {
    const client = this.client(key);
    try {
      await client.models.list();
      return { valid: true };
    } catch (e) {
      const mapped = translateError(e);
      return {
        valid: false,
        reason: mapped.name === 'ProviderAuthError' ? 'Invalid API key.' : mapped.message,
      };
    }
  }
}

function mapFinishReason(raw: string | null): ChatResponse['finishReason'] {
  switch (raw) {
    case 'stop':           return 'stop';
    case 'length':         return 'length';
    case 'tool_calls':
    case 'function_call':  return 'tool';
    case 'content_filter': return 'content_filter';
    default:               return 'error';
  }
}

