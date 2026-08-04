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

import { costUsd, KNOWN_MODELS } from './cost';
import { translateError, type RawAzureError } from './errors-map';

export { KNOWN_MODELS as AZURE_OPENAI_KNOWN_MODELS, costUsd, estimateCostUsd, pricingFor } from './cost';
export { translateError } from './errors-map';

/**
 * Azure OpenAI adapter. Implemented via direct REST calls (no SDK) — the
 * `@azure/openai@2.x` package is a deprecation stub and the `openai` package
 * does not export `AzureOpenAI` until v5. This keeps the boundary rule
 * vacuously green: this file imports no provider SDK.
 *
 * One adapter instance maps to one Azure OpenAI resource; deployment name
 * arrives as `modelId` per the ProviderAdapter contract.
 */

export interface AzureOpenAiAdapterOptions {
  /** Resource endpoint, e.g. `https://my-resource.openai.azure.com`. Required at chat time. */
  endpoint: string;
  /** Azure REST API version, e.g. `2024-08-01-preview`. */
  apiVersion?: string;
  /** Inject a fake fetch for tests. */
  fetchImpl?: typeof fetch;
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

const DEFAULT_API_VERSION = '2024-08-01-preview';

/** Minimum output budget granted to reasoning deployments. */
const REASONING_MIN_OUTPUT_TOKENS = 4_096;

/**
 * Best-effort detection of a reasoning deployment (GPT-5 / o-series) from its
 * Azure deployment name. Azure deployment names are operator-chosen, so this is
 * a heuristic: only names clearly referencing o1/o3/o4/gpt-5 switch to the
 * reasoning request contract. Everything else keeps the classic chat shape.
 */
export function isReasoningDeployment(name: string): boolean {
  return /(^|[^a-z0-9])(o[1-9]\d*|gpt-?5)([^a-z0-9]|$)/i.test(name);
}

export class AzureOpenAiAdapter implements ProviderAdapter {
  readonly id = 'azure_openai' as const;
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

  readonly knownModels = KNOWN_MODELS;

  private readonly endpoint: string;
  private readonly apiVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AzureOpenAiAdapterOptions) {
    if (!opts.endpoint) throw new Error('AzureOpenAiAdapter requires an `endpoint`.');
    this.endpoint = opts.endpoint.replace(/\/+$/, '');
    this.apiVersion = opts.apiVersion ?? DEFAULT_API_VERSION;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  }

  async chat(req: ChatRequest, key: DecryptedKey, modelId: string): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name !== undefined ? { name: m.name } : {}),
        ...(m.toolCallId !== undefined ? { tool_call_id: m.toolCallId } : {}),
      })),
    };
    // Per-deployment request contract (see `isReasoningDeployment`). Reasoning
    // deployments reject the legacy `max_tokens` field and a custom temperature.
    const reasoning = isReasoningDeployment(modelId);
    if (req.temperature !== undefined && !reasoning) body['temperature'] = req.temperature;
    if (req.topP !== undefined) body['top_p'] = req.topP;
    if (reasoning) {
      const requested = req.maxTokens ?? REASONING_MIN_OUTPUT_TOKENS;
      body['max_completion_tokens'] = Math.max(requested, REASONING_MIN_OUTPUT_TOKENS);
    } else if (req.maxTokens !== undefined) {
      body['max_tokens'] = req.maxTokens;
    }
    if (req.seed !== undefined) body['seed'] = req.seed;
    if (req.tools && req.tools.length > 0) {
      body['tools'] = req.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parametersSchema,
        },
      }));
    }
    if (req.toolChoice !== undefined) {
      body['tool_choice'] = typeof req.toolChoice === 'string'
        ? req.toolChoice
        : { type: 'function', function: { name: req.toolChoice.name } };
    }
    if (req.responseFormat !== undefined) {
      if (req.responseFormat === 'text') body['response_format'] = { type: 'text' };
      else if (req.responseFormat === 'json') body['response_format'] = { type: 'json_object' };
      else body['response_format'] = {
        type: 'json_schema',
        json_schema: { name: 'response', schema: req.responseFormat.jsonSchema, strict: true },
      };
    }

    const url = `${this.endpoint}/openai/deployments/${encodeURIComponent(modelId)}/chat/completions?api-version=${encodeURIComponent(this.apiVersion)}`;
    const completion = await this.fetchJson<RawCompletion>(url, {
      method: 'POST',
      headers: {
        'api-key': key.secret,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const choice = completion.choices[0];
    if (!choice) {
      throw new ProviderError('Azure OpenAI returned an empty choices array.', completion.id);
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
      cost: { usd: costUsd(modelId, usage), provider: 'azure_openai', model: modelId },
      cached: false,
      providerRequestId: completion.id,
    };
  }

  async validateCredentials(key: DecryptedKey): Promise<{ valid: boolean; reason?: string }> {
    const url = `${this.endpoint}/openai/models?api-version=${encodeURIComponent(this.apiVersion)}`;
    try {
      await this.fetchJson<unknown>(url, {
        method: 'GET',
        headers: { 'api-key': key.secret },
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

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, init);
    } catch (e) {
      throw translateError(e instanceof Error ? { status: 0, message: e.message } : e);
    }
    if (!resp.ok) {
      let parsed: { error?: { code?: string; message?: string } } | undefined;
      try {
        parsed = (await resp.json()) as { error?: { code?: string; message?: string } };
      } catch {
        parsed = undefined;
      }
      const err: RawAzureError = {
        status: resp.status,
        ...(parsed !== undefined ? { body: parsed } : {}),
        ...(resp.headers.get('retry-after') !== null
          ? { retryAfter: resp.headers.get('retry-after') as string }
          : {}),
        ...(resp.headers.get('x-ms-request-id') !== null
          ? { requestId: resp.headers.get('x-ms-request-id') as string }
          : {}),
      };
      throw translateError(err);
    }
    return (await resp.json()) as T;
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
