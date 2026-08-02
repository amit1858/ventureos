import type {
  ChatRequest,
  ChatResponse,
  DecryptedKey,
  ProviderCapabilities,
} from '@foundry/contracts';
import type { ProviderAdapter } from './types';

/**
 * Deterministic test double. NEVER touches a network. Used by `tests/` and demo fixtures.
 */
export class MockProvider implements ProviderAdapter {
  readonly id = 'openai' as const;
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: false,
    supportsTools: false,
    supportsJsonMode: true,
    supportsJsonSchema: false,
    supportsVision: false,
    supportsEmbeddings: false,
    maxContextTokens: 128_000,
    maxOutputTokens: 4_096,
  };

  constructor(
    private readonly reply: string = 'MOCK_RESPONSE',
    private readonly costUsd: number = 0.0001,
  ) {}

  async chat(req: ChatRequest, _key: DecryptedKey, modelId: string): Promise<ChatResponse> {
    const promptTokens = req.messages.reduce((n, m) => n + Math.ceil(m.content.length / 4), 0);
    const completionTokens = Math.ceil(this.reply.length / 4);
    return {
      content: this.reply,
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cost: { usd: this.costUsd, provider: 'openai', model: modelId },
      cached: false,
      providerRequestId: 'mock_' + req.ctx.traceId,
    };
  }

  async validateCredentials(_key: DecryptedKey): Promise<{ valid: boolean }> {
    return { valid: true };
  }
}
