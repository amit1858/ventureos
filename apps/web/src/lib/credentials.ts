/**
 * Server-only credential service factory.
 *
 * Selects a backing store based on environment:
 *   - If `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are present,
 *     uses `SupabaseCredentialStore` / `SupabaseAuditLogger`.
 *   - Otherwise (dev / CI), uses in-memory stores. Module-level singletons so
 *     state survives across requests in the same Node process.
 *
 * The encryption key (`VENTUREOS_CREDENTIAL_ENCRYPTION_KEY`) is required in both
 * modes. In dev mode a fresh ephemeral key is generated per process if none is
 * provided, which intentionally means stored credentials become unreadable after
 * restart — that is the desired behaviour for ephemeral CI runs and signals to
 * developers to set the key explicitly for local dev.
 */
import 'server-only';
import { randomBytes } from 'node:crypto';

import {
  CredentialCrypto,
  CredentialService,
  InMemoryAuditLogger,
  InMemoryCredentialStore,
  SupabaseAuditLogger,
  SupabaseCredentialStore,
  type ProviderTestPromptRunner,
  type ProviderValidator,
} from '@foundry/credentials';
import type { ProviderId } from '@foundry/contracts';
import { ProviderError } from '@foundry/providers-core';
import { OpenAiAdapter, OPENAI_KNOWN_MODELS } from '@foundry/providers-openai';
import { AnthropicAdapter, ANTHROPIC_KNOWN_MODELS } from '@foundry/providers-anthropic';
import { GeminiAdapter, GEMINI_KNOWN_MODELS } from '@foundry/providers-gemini';
import { AzureOpenAiAdapter, AZURE_OPENAI_KNOWN_MODELS } from '@foundry/providers-azure-openai';
import { validatePat as validateGitHubPat } from '@foundry/adapter-github';

import { serviceRoleClient } from './supabase/server';

declare global {
  // eslint-disable-next-line no-var
  var __foundry_credential_service: CredentialService | undefined;
  // eslint-disable-next-line no-var
  var __foundry_credential_audit: InMemoryAuditLogger | SupabaseAuditLogger | undefined;
}

export function getCredentialService(): CredentialService {
  if (globalThis.__foundry_credential_service) return globalThis.__foundry_credential_service;
  const crypto = buildCrypto();
  const { store, audit } = buildBackends();
  globalThis.__foundry_credential_audit = audit;
  const service = new CredentialService({
    store,
    audit,
    crypto,
    validator,
    testPromptRunner,
    modelCatalog,
  });
  globalThis.__foundry_credential_service = service;
  return service;
}

function buildCrypto(): CredentialCrypto {
  if (process.env['VENTUREOS_CREDENTIAL_ENCRYPTION_KEY']) {
    return CredentialCrypto.fromEnv();
  }
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('CredentialCrypto: VENTUREOS_CREDENTIAL_ENCRYPTION_KEY is not set.');
  }
  // Ephemeral key for dev/CI. Logged as a warning so it isn't silent.
  // eslint-disable-next-line no-console
  console.warn(
    '[credentials] VENTUREOS_CREDENTIAL_ENCRYPTION_KEY not set; generating ephemeral key for this process.',
  );
  return new CredentialCrypto({ activeKid: 'ephemeral', keys: { ephemeral: randomBytes(32) } });
}

function buildBackends() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (url && serviceKey) {
    const client = serviceRoleClient();
    return {
      store: new SupabaseCredentialStore(client),
      audit: new SupabaseAuditLogger(client),
    };
  }
  return {
    store: new InMemoryCredentialStore(),
    audit: new InMemoryAuditLogger(),
  };
}

const validator: ProviderValidator = async ({ providerType, secret, config }) => {
  if (providerType === 'github') {
    const r = await validateGitHubPat(secret);
    return { valid: r.valid, ...(r.reason !== undefined ? { reason: r.reason } : {}) };
  }
  const key = { id: 'transient', provider: providerType, secret };
  const adapter = buildAdapter(providerType, config);
  if (!adapter) return { valid: false, reason: `Validation for '${providerType}' is not implemented.` };
  try {
    const r = await adapter.validateCredentials(key);
    return { valid: r.valid, ...(r.reason !== undefined ? { reason: r.reason } : {}) };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? 'Validation failed.' : 'Validation failed.' };
  }
};

const testPromptRunner: ProviderTestPromptRunner = async ({
  providerType, secret, config, modelId, prompt,
}) => {
  const adapter = buildAdapter(providerType, config);
  if (!adapter) return { ok: false, reason: `Test prompt for '${providerType}' is not implemented.` };
  const key = { id: 'transient', provider: providerType, secret };
  try {
    const res = await adapter.chat(
      {
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 256,
        temperature: 0.2,
        ctx: { tenantId: 'byok-test', traceId: `test-${Date.now()}` },
      },
      key,
      modelId,
    );
    return {
      ok: true,
      content: typeof res.content === 'string' ? res.content : JSON.stringify(res.content),
      usage: res.usage,
      costUsd: res.cost.usd,
      finishReason: res.finishReason,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof ProviderError ? e.message : 'Test prompt failed.' };
  }
};

function buildAdapter(providerType: ProviderId, config: { endpoint?: string; apiVersion?: string }) {
  switch (providerType) {
    case 'openai':       return new OpenAiAdapter();
    case 'anthropic':    return new AnthropicAdapter();
    case 'gemini':       return new GeminiAdapter();
    case 'azure_openai': {
      if (!config.endpoint) return null;
      return new AzureOpenAiAdapter({
        endpoint: config.endpoint,
        ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
      });
    }
    default: return null;
  }
}

function modelCatalog(p: ProviderId): string[] {
  switch (p) {
    case 'openai':       return [...OPENAI_KNOWN_MODELS];
    case 'anthropic':    return [...ANTHROPIC_KNOWN_MODELS];
    case 'gemini':       return [...GEMINI_KNOWN_MODELS];
    case 'azure_openai': return [...AZURE_OPENAI_KNOWN_MODELS];
    default: return [];
  }
}
