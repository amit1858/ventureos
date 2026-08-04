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
import {
  REASONING_MIN_OUTPUT_TOKENS,
  isReasoningModel,
  supportsTemperature,
} from './models';

export { costUsd, estimateCostUsd, pricingFor } from './cost';
export { translateError } from './errors-map';
export {
  OPENAI_KNOWN_MODELS,
  OPENAI_RECOMMENDED_MODELS,
  OPENAI_MODELS,
  openAiModelSpec,
  isReasoningModel,
  maxTokenParamFor,
  supportsTemperature,
  type OpenAiModelSpec,
  type OpenAiParamStyle,
} from './models';

/**
 * Minimal structural slice of the `openai` SDK that this adapter actually uses.
 * Letting tests inject a stub avoids `vi.mock('openai', ...)` plumbing while still
 * exercising every translation path.
 */
export interface OpenAiLike {
  chat: { completions: { create: (params: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<RawCompletion> } };
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
    // Per-model request contract. Reasoning models (GPT-5 / o-series) reject the
    // legacy `max_tokens` field and a custom `temperature`; classic chat models
    // keep the original shape. See `./models` for the policy source of truth.
    const reasoning = isReasoningModel(modelId);
    if (req.temperature !== undefined && supportsTemperature(modelId)) {
      params['temperature'] = req.temperature;
    }
    if (req.topP !== undefined) params['top_p'] = req.topP;
    if (reasoning) {
      // Reasoning models spend part of the budget on hidden reasoning tokens, so
      // grant a floor to avoid empty completions on small requests.
      const requested = req.maxTokens ?? REASONING_MIN_OUTPUT_TOKENS;
      params['max_completion_tokens'] = Math.max(requested, REASONING_MIN_OUTPUT_TOKENS);
    } else if (req.maxTokens !== undefined) {
      params['max_tokens'] = req.maxTokens;
    }
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
      completion = await client.chat.completions.create(
        params,
        req.signal ? { signal: req.signal } : undefined,
      );
    } catch (e) {
      // A hard-timeout abort surfaces as an SDK abort error; translate it to a
      // stable, secret-safe message so the job layer records a clean terminal
      // state rather than a provider-specific stack.
      if (req.signal?.aborted) {
        throw new ProviderError('OpenAI request aborted after exceeding the hard timeout.');
      }
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

