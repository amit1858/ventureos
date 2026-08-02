import type {
  ChatRequest,
  ChatResponse,
  DecryptedKey,
  ProviderCapabilities,
  ProviderId,
  ProviderRoute,
} from '@foundry/contracts';

/**
 * What a concrete provider implementation looks like.
 * Lives only inside `packages/providers/<provider>-ts`. Never imported by app code.
 */
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  /** Issue one chat-completion request. Native SDK errors MUST be translated into errors.ts. */
  chat(req: ChatRequest, key: DecryptedKey, modelId: string): Promise<ChatResponse>;

  /** Cheap auth probe used by the BYOK settings flow. */
  validateCredentials(key: DecryptedKey): Promise<{ valid: boolean; reason?: string }>;
}

/** The only surface the application code may import. */
export interface ProviderClient {
  chat(req: ChatRequest): Promise<ChatResponse>;
}

export interface KeyResolver {
  /** Returns the plaintext key for a given keyId, decrypted via KMS. Throws if not found / revoked. */
  resolve(keyId: string, ctx: { tenantId: string; traceId: string }): Promise<DecryptedKey>;
}

export interface BudgetGuard {
  /** Throws BudgetExceeded if the projected spend would exceed any active limit. */
  check(estimateUsd: number, ctx: { tenantId: string; ventureId?: string }): Promise<void>;
  /** Record actual spend after a successful call. */
  record(actualUsd: number, ctx: { tenantId: string; ventureId?: string }): Promise<void>;
}

export interface Redactor {
  /** Strip likely-secret tokens from a message before it is sent to a provider. */
  redact(text: string): string;
}

export interface RouteResolver {
  /** Map a logical model ('flagship' | 'standard' | ...) to an ordered fallback chain of routes. */
  resolve(model: string, ctx: { tenantId: string }): Promise<ProviderRoute[]>;
}
