import Anthropic from '@anthropic-ai/sdk';

import type {
  ChatMessage,
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

import { costUsd, DEFAULT_VALIDATION_MODEL, KNOWN_MODELS } from './cost';
import { translateError } from './errors-map';

export {
  KNOWN_MODELS as ANTHROPIC_KNOWN_MODELS,
  DEFAULT_VALIDATION_MODEL as ANTHROPIC_DEFAULT_VALIDATION_MODEL,
  RETIRED_MODELS as ANTHROPIC_RETIRED_MODELS,
  costUsd,
  estimateCostUsd,
  pricingFor,
} from './cost';
export { translateError } from './errors-map';

/**
 * Structural slice of `@anthropic-ai/sdk` actually used. Tests inject via `clientFactory`,
 * mirroring the OpenAI adapter pattern.
 */
export interface AnthropicLike {
  messages: { create: (params: Record<string, unknown>) => Promise<RawMessage> };
  models?: { list: () => Promise<unknown> };
}

interface RawContentBlock {
  type: 'text' | 'tool_use' | string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface RawMessage {
  id: string;
  content: RawContentBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence' | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export interface AnthropicAdapterOptions {
  clientFactory?: (key: DecryptedKey) => AnthropicLike;
}

/**
 * Anthropic adapter. ONLY file in the repo that may import `@anthropic-ai/sdk`.
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly id = 'anthropic' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsTools: true,
    supportsJsonMode: false,
    supportsJsonSchema: false,
    supportsVision: true,
    supportsEmbeddings: false,
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
  };

  /** Static model catalog for the BYOK UI. Not part of the ProviderAdapter contract. */
  readonly knownModels = KNOWN_MODELS;

  constructor(private readonly opts: AnthropicAdapterOptions = {}) {}

  private client(key: DecryptedKey): AnthropicLike {
    if (this.opts.clientFactory) return this.opts.clientFactory(key);
    return new Anthropic({ apiKey: key.secret }) as unknown as AnthropicLike;
  }

  async chat(req: ChatRequest, key: DecryptedKey, modelId: string): Promise<ChatResponse> {
    const client = this.client(key);
    const { system, messages } = splitSystem(req.messages);

    // Anthropic has no native JSON mode. Use the documented "prefill" trick:
    // append a final assistant turn that opens with `{`, which forces the
    // model to continue as a JSON object. We prepend `{` to the response
    // text below so the caller sees a complete object.
    const wantsJsonObject = req.responseFormat === 'json' ||
      (typeof req.responseFormat === 'object' && req.responseFormat !== null);
    const mappedMessages = messages.map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content:
        m.role === 'tool'
          ? [{ type: 'tool_result', tool_use_id: m.toolCallId ?? '', content: m.content }]
          : m.content,
    }));
    if (wantsJsonObject) {
      mappedMessages.push({ role: 'assistant', content: '{' });
    }

    const params: Record<string, unknown> = {
      model: modelId,
      max_tokens: req.maxTokens ?? this.capabilities.maxOutputTokens,
      messages: mappedMessages,
    };
    if (system) {
      params['system'] = wantsJsonObject
        ? `${system}\n\nReply with ONLY a single JSON object. No prose, no markdown fences.`
        : system;
    } else if (wantsJsonObject) {
      params['system'] = 'Reply with ONLY a single JSON object. No prose, no markdown fences.';
    }
    if (req.temperature !== undefined) params['temperature'] = req.temperature;
    if (req.topP !== undefined) params['top_p'] = req.topP;
    if (req.tools && req.tools.length > 0) {
      params['tools'] = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parametersSchema,
      }));
    }
    if (req.toolChoice !== undefined) {
      params['tool_choice'] = typeof req.toolChoice === 'string'
        ? { type: req.toolChoice === 'required' ? 'any' : req.toolChoice }
        : { type: 'tool', name: req.toolChoice.name };
    }

    let raw: RawMessage;
    try {
      raw = await client.messages.create(params);
    } catch (e) {
      throw translateError(e);
    }

    if (!raw.content || raw.content.length === 0) {
      throw new ProviderError('Anthropic returned an empty content array.', raw.id);
    }

    const usage = {
      promptTokens: raw.usage?.input_tokens ?? 0,
      completionTokens: raw.usage?.output_tokens ?? 0,
      totalTokens: (raw.usage?.input_tokens ?? 0) + (raw.usage?.output_tokens ?? 0),
    };

    const toolUses = raw.content.filter((b) => b.type === 'tool_use');
    let content: string | ToolCall[];
    if (toolUses.length > 0) {
      content = toolUses.map((b): ToolCall => ({
        id: b.id ?? '',
        name: b.name ?? '',
        arguments: b.input ?? {},
      }));
    } else {
      content = raw.content
        .filter((b) => b.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text ?? '')
        .join('');
      // Restore the `{` prefill so callers see a complete JSON object.
      if (wantsJsonObject && typeof content === 'string' && !content.trimStart().startsWith('{')) {
        content = `{${content}`;
      }
    }

    return {
      content,
      finishReason: mapFinishReason(raw.stop_reason),
      usage,
      cost: { usd: costUsd(modelId, usage), provider: 'anthropic', model: modelId },
      cached: false,
      providerRequestId: raw.id,
    };
  }

  async validateCredentials(key: DecryptedKey): Promise<{ valid: boolean; reason?: string }> {
    const client = this.client(key);
    try {
      if (client.models?.list) {
        await client.models.list();
        return { valid: true };
      }
      await client.messages.create({
        model: DEFAULT_VALIDATION_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
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

function splitSystem(messages: ChatMessage[]): { system: string | undefined; messages: ChatMessage[] } {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system: sys || undefined, messages: rest };
}

function mapFinishReason(raw: RawMessage['stop_reason']): ChatResponse['finishReason'] {
  switch (raw) {
    case 'end_turn':
    case 'stop_sequence': return 'stop';
    case 'max_tokens':    return 'length';
    case 'tool_use':      return 'tool';
    default:              return 'error';
  }
}
