import { GoogleGenerativeAI } from '@google/generative-ai';

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

import { costUsd, KNOWN_MODELS } from './cost';
import { translateError } from './errors-map';

export { KNOWN_MODELS as GEMINI_KNOWN_MODELS, costUsd, estimateCostUsd, pricingFor } from './cost';
export { translateError } from './errors-map';

/**
 * Structural slice of `@google/generative-ai` we use. Tests inject a fake via
 * `clientFactory`, mirroring the OpenAI/Anthropic adapter pattern.
 */
export interface GeminiLike {
  getGenerativeModel: (params: {
    model: string;
    systemInstruction?: string;
    generationConfig?: Record<string, unknown>;
    tools?: unknown;
  }) => GeminiModelLike;
}

export interface GeminiModelLike {
  generateContent: (params: {
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  }) => Promise<RawGenerateResult>;
}

interface RawGenerateResult {
  response: {
    text?: () => string;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args: Record<string, unknown> };
        }>;
      };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
}

export interface GeminiAdapterOptions {
  clientFactory?: (key: DecryptedKey) => GeminiLike;
}

/**
 * Google Gemini adapter. ONLY file in the repo that may import `@google/generative-ai`.
 */
export class GeminiAdapter implements ProviderAdapter {
  readonly id = 'gemini' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsTools: true,
    supportsJsonMode: true,
    supportsJsonSchema: true,
    supportsVision: true,
    supportsEmbeddings: true,
    maxContextTokens: 1_000_000,
    maxOutputTokens: 8_192,
  };

  readonly knownModels = KNOWN_MODELS;

  constructor(private readonly opts: GeminiAdapterOptions = {}) {}

  private client(key: DecryptedKey): GeminiLike {
    if (this.opts.clientFactory) return this.opts.clientFactory(key);
    return new GoogleGenerativeAI(key.secret) as unknown as GeminiLike;
  }

  async chat(req: ChatRequest, key: DecryptedKey, modelId: string): Promise<ChatResponse> {
    const client = this.client(key);

    const systemInstruction = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n') || undefined;

    const generationConfig: Record<string, unknown> = {};
    if (req.temperature !== undefined) generationConfig['temperature'] = req.temperature;
    if (req.topP !== undefined) generationConfig['topP'] = req.topP;
    if (req.maxTokens !== undefined) generationConfig['maxOutputTokens'] = req.maxTokens;
    if (req.responseFormat === 'json') {
      generationConfig['responseMimeType'] = 'application/json';
    } else if (req.responseFormat && typeof req.responseFormat === 'object') {
      generationConfig['responseMimeType'] = 'application/json';
      generationConfig['responseSchema'] = req.responseFormat.jsonSchema;
    }

    const tools = req.tools && req.tools.length > 0
      ? [{
          functionDeclarations: req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parametersSchema,
          })),
        }]
      : undefined;

    const model = client.getGenerativeModel({
      model: modelId,
      ...(systemInstruction !== undefined ? { systemInstruction } : {}),
      ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
      ...(tools !== undefined ? { tools } : {}),
    });

    const contents = toGeminiContents(req.messages);

    let raw: RawGenerateResult;
    try {
      raw = await model.generateContent({ contents });
    } catch (e) {
      throw translateError(e);
    }

    const candidate = raw.response.candidates?.[0];
    if (!candidate || !candidate.content) {
      throw new ProviderError('Gemini returned no candidates.');
    }

    const parts = candidate.content.parts ?? [];
    const usage = {
      promptTokens: raw.response.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: raw.response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: raw.response.usageMetadata?.totalTokenCount ?? 0,
    };

    const functionCalls = parts.filter((p) => p.functionCall);
    let content: string | ToolCall[];
    if (functionCalls.length > 0) {
      content = functionCalls.map((p, i): ToolCall => ({
        id: `gem_${i}`,
        name: p.functionCall?.name ?? '',
        arguments: p.functionCall?.args ?? {},
      }));
    } else {
      content = parts.map((p) => p.text ?? '').join('');
    }

    return {
      content,
      finishReason: mapFinishReason(candidate.finishReason),
      usage,
      cost: { usd: costUsd(modelId, usage), provider: 'gemini', model: modelId },
      cached: false,
    };
  }

  async validateCredentials(key: DecryptedKey): Promise<{ valid: boolean; reason?: string }> {
    const client = this.client(key);
    try {
      // Cheapest probe: 1-token generate against the smallest model.
      const model = client.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        generationConfig: { maxOutputTokens: 1 },
      });
      await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
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

function toGeminiContents(messages: ChatMessage[]): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

function mapFinishReason(raw: string | undefined): ChatResponse['finishReason'] {
  switch (raw) {
    case 'STOP':            return 'stop';
    case 'MAX_TOKENS':      return 'length';
    case 'SAFETY':
    case 'RECITATION':
    case 'PROHIBITED_CONTENT': return 'content_filter';
    default:                return raw ? 'error' : 'stop';
  }
}
