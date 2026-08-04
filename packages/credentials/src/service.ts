/**
 * Credential lifecycle service.
 *
 * The ONLY layer permitted to handle plaintext secrets. Routes call into here with
 * the authenticated `userId`; the service:
 *   1. Validates the secret shape and (optionally) probes the provider live.
 *   2. Envelope-encrypts the secret before handing it to the store.
 *   3. Writes an audit event for every lifecycle transition.
 *   4. Returns only `ProviderProfile` (no encrypted blob, no plaintext).
 *
 * The service NEVER:
 *   - returns the plaintext secret
 *   - returns the encrypted envelope
 *   - puts secrets into audit metadata
 *   - logs the secret
 */
import type { ProviderId } from '@foundry/contracts';
import { maskKey, validateKeyShape } from '@foundry/security';

import type { AuditLogger } from './audit';
import { CredentialCrypto } from './crypto';
import type { CredentialStore } from './store';
import type {
  ProviderConfigJson,
  ProviderCredentialRow,
  ProviderProfile,
  ValidationStatus,
} from './types';

export interface ProviderValidatorResult {
  valid: boolean;
  reason?: string;
  models?: string[];
}

/**
 * Function the host wires in to actually probe a provider. Receives the plaintext
 * secret + config but returns only a non-sensitive verdict.
 */
export type ProviderValidator = (input: {
  providerType: ProviderId;
  secret: string;
  config: ProviderConfigJson;
}) => Promise<ProviderValidatorResult>;

/** Function that executes a single test prompt; same isolation rule as the validator. */
export type ProviderTestPromptRunner = (input: {
  providerType: ProviderId;
  secret: string;
  config: ProviderConfigJson;
  modelId: string;
  prompt: string;
}) => Promise<TestPromptResult>;

export interface TestPromptResult {
  ok: boolean;
  reason?: string;
  content?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  costUsd?: number;
  finishReason?: string;
}

export interface CredentialServiceDeps {
  store: CredentialStore;
  crypto: CredentialCrypto;
  audit: AuditLogger;
  validator: ProviderValidator;
  testPromptRunner: ProviderTestPromptRunner;
  /** Catalog lookup for known models. Pure function; receives a provider id. */
  modelCatalog: (providerType: ProviderId) => string[];
}

export interface CreateProviderInput {
  userId: string;
  providerType: ProviderId;
  displayName: string;
  secret: string;
  config?: ProviderConfigJson;
  setDefault?: boolean;
}

export class CredentialService {
  constructor(private readonly deps: CredentialServiceDeps) {}

  // ── lifecycle ──────────────────────────────────────────────────────────

  async createProvider(input: CreateProviderInput): Promise<{
    ok: boolean;
    profile?: ProviderProfile;
    reason?: string;
  }> {
    const config: ProviderConfigJson = input.config ?? {};

    const shape = validateKeyShape(input.providerType, input.secret);
    if (!shape.ok) return { ok: false, reason: shape.reason ?? 'Malformed secret.' };

    const probe = await this.deps.validator({
      providerType: input.providerType,
      secret: input.secret,
      config,
    });

    // Even if validation fails, we still allow persistence in 'invalid' state so the
    // user can rotate the key later. But spec calls for "validate credential" then
    // persist — we honour that by refusing creation on auth failure.
    if (!probe.valid) {
      return { ok: false, reason: probe.reason ?? 'Validation failed.' };
    }

    const envelope = this.deps.crypto.encrypt(input.secret);
    const encryptedSecret = CredentialCrypto.envelopeToJson(envelope);
    const fingerprint = this.deps.crypto.fingerprint(input.secret);
    const masked = maskKey(input.secret);
    const models = probe.models && probe.models.length > 0
      ? probe.models
      : this.deps.modelCatalog(input.providerType);

    const existing = await this.deps.store.listByUser(input.userId);
    const isFirst = existing.length === 0;
    const isDefault = input.setDefault === true || isFirst;

    const row = await this.deps.store.create({
      userId: input.userId,
      providerType: input.providerType,
      displayName: input.displayName,
      encryptedSecret,
      secretFingerprint: fingerprint,
      maskedPreview: masked,
      config,
      availableModels: models,
      validationStatus: 'active',
      lastValidatedAt: new Date().toISOString(),
      lastValidationReason: null,
      isDefault,
    });

    if (isDefault) {
      await this.deps.store.clearDefaultForUser(input.userId, row.id);
    }

    await this.deps.audit.write({
      userId: input.userId,
      eventType: 'provider_created',
      targetId: row.id,
      providerType: input.providerType,
      metadata: { displayName: input.displayName, isDefault },
    });

    return { ok: true, profile: toProfile(row) };
  }

  async listProfiles(userId: string): Promise<ProviderProfile[]> {
    const rows = await this.deps.store.listByUser(userId);
    return rows.map(toProfile);
  }

  async revalidate(userId: string, id: string): Promise<{
    ok: boolean;
    profile?: ProviderProfile;
    reason?: string;
  }> {
    const row = await this.deps.store.getForUser(userId, id);
    if (!row) return { ok: false, reason: 'Provider not found.' };

    const secret = this.decryptRow(row);
    const probe = await this.deps.validator({
      providerType: row.providerType,
      secret,
      config: row.config,
    });

    const status: ValidationStatus = probe.valid ? 'active' : 'invalid';
    const reason = probe.reason ?? null;
    const updated = await this.deps.store.updateForUser(userId, id, {
      validationStatus: status,
      lastValidatedAt: new Date().toISOString(),
      lastValidationReason: reason,
      ...(probe.models && probe.models.length > 0 ? { availableModels: probe.models } : {}),
    });

    await this.deps.audit.write({
      userId,
      eventType: probe.valid ? 'provider_validated' : 'provider_validation_failed',
      targetId: id,
      providerType: row.providerType,
      metadata: probe.valid ? {} : { reason: probe.reason ?? null },
    });

    return updated
      ? { ok: probe.valid, profile: toProfile(updated), ...(probe.reason ? { reason: probe.reason } : {}) }
      : { ok: false, reason: 'Provider not found after update.' };
  }

  async runTestPrompt(
    userId: string,
    id: string,
    args: { modelId: string; prompt: string },
  ): Promise<TestPromptResult & { profile?: ProviderProfile }> {
    const row = await this.deps.store.getForUser(userId, id);
    if (!row) return { ok: false, reason: 'Provider not found.' };

    const secret = this.decryptRow(row);
    const result = await this.deps.testPromptRunner({
      providerType: row.providerType,
      secret,
      config: row.config,
      modelId: args.modelId,
      prompt: args.prompt,
    });

    const updated = await this.deps.store.updateForUser(userId, id, {
      lastUsedAt: new Date().toISOString(),
    });

    await this.deps.audit.write({
      userId,
      eventType: 'provider_used_for_test_prompt',
      targetId: id,
      providerType: row.providerType,
      metadata: {
        modelId: args.modelId,
        ok: result.ok,
        ...(typeof result.costUsd === 'number' ? { costUsd: result.costUsd } : {}),
        ...(result.usage ? { totalTokens: result.usage.totalTokens } : {}),
      },
    });

    return { ...result, ...(updated ? { profile: toProfile(updated) } : {}) };
  }

  async setDefault(userId: string, id: string): Promise<{ ok: boolean; reason?: string }> {
    const updated = await this.deps.store.updateForUser(userId, id, { isDefault: true });
    if (!updated) return { ok: false, reason: 'Provider not found.' };
    await this.deps.store.clearDefaultForUser(userId, id);
    await this.deps.audit.write({
      userId,
      eventType: 'provider_set_default',
      targetId: id,
      providerType: updated.providerType,
    });
    return { ok: true };
  }

  async deleteProvider(userId: string, id: string): Promise<{ ok: boolean; reason?: string }> {
    const existing = await this.deps.store.getForUser(userId, id);
    if (!existing) return { ok: false, reason: 'Provider not found.' };
    const ok = await this.deps.store.softDelete(userId, id);
    if (!ok) return { ok: false, reason: 'Provider already deleted.' };
    await this.deps.audit.write({
      userId,
      eventType: 'provider_deleted',
      targetId: id,
      providerType: existing.providerType,
    });
    return { ok: true };
  }

  async rotateSecret(
    userId: string,
    id: string,
    newSecret: string,
  ): Promise<{ ok: boolean; profile?: ProviderProfile; reason?: string }> {
    const row = await this.deps.store.getForUser(userId, id);
    if (!row) return { ok: false, reason: 'Provider not found.' };
    const shape = validateKeyShape(row.providerType, newSecret);
    if (!shape.ok) return { ok: false, reason: shape.reason ?? 'Malformed secret.' };

    const probe = await this.deps.validator({
      providerType: row.providerType,
      secret: newSecret,
      config: row.config,
    });
    if (!probe.valid) return { ok: false, reason: probe.reason ?? 'Validation failed.' };

    const envelope = this.deps.crypto.encrypt(newSecret);
    const updated = await this.deps.store.updateForUser(userId, id, {
      encryptedSecret: CredentialCrypto.envelopeToJson(envelope),
      secretFingerprint: this.deps.crypto.fingerprint(newSecret),
      maskedPreview: maskKey(newSecret),
      validationStatus: 'active',
      lastValidatedAt: new Date().toISOString(),
      lastValidationReason: null,
      ...(probe.models && probe.models.length > 0 ? { availableModels: probe.models } : {}),
    });
    if (!updated) return { ok: false, reason: 'Provider not found after update.' };

    await this.deps.audit.write({
      userId,
      eventType: 'provider_rotated',
      targetId: id,
      providerType: row.providerType,
    });
    return { ok: true, profile: toProfile(updated) };
  }

  /**
   * Run `fn` with the decrypted plaintext secret in scope. The secret is passed
   * by value to the callback; it is not returned and not logged. Callers MUST
   * keep the callback short so the plaintext lives in memory for the minimum
   * possible duration.
   *
   * Returns `{ ok: false, reason }` if the credential is missing, deleted, or
   * not owned by the user — callers must NOT distinguish those cases to avoid
   * an existence oracle.
   */
  async withDecryptedSecret<T>(
    userId: string,
    id: string,
    fn: (input: {
      secret: string;
      providerType: ProviderId;
      config: ProviderConfigJson;
      profile: ProviderProfile;
    }) => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; reason: string }> {
    const row = await this.deps.store.getForUser(userId, id);
    if (!row) return { ok: false, reason: 'Provider not found.' };
    if (row.validationStatus === 'revoked') {
      return { ok: false, reason: 'Provider credential is revoked.' };
    }
    const secret = this.decryptRow(row);
    try {
      const value = await fn({
        secret,
        providerType: row.providerType,
        config: row.config,
        profile: toProfile(row),
      });
      await this.deps.store.updateForUser(userId, id, { lastUsedAt: new Date().toISOString() });
      return { ok: true, value };
    } finally {
      // We can't truly zero a JS string. The smallest mitigation is to drop the
      // local reference and let the GC reclaim it as quickly as possible.
      void secret;
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private decryptRow(row: ProviderCredentialRow): string {
    const envelope = CredentialCrypto.envelopeFromJson(row.encryptedSecret);
    return this.deps.crypto.decrypt(envelope);
  }
}

/**
 * Strip every server-only field from a row before returning it across the trust
 * boundary. Tested explicitly in `tests/safety.test.ts`.
 */
export function toProfile(row: ProviderCredentialRow): ProviderProfile {
  return {
    id: row.id,
    providerType: row.providerType,
    displayName: row.displayName,
    maskedPreview: row.maskedPreview,
    validationStatus: row.validationStatus,
    lastValidatedAt: row.lastValidatedAt,
    lastValidationReason: row.lastValidationReason,
    lastUsedAt: row.lastUsedAt,
    availableModels: row.availableModels,
    isDefault: row.isDefault,
    config: row.config,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
