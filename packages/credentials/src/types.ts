import type { ProviderId } from '@ventureos/contracts';

/** Row shape for the `users` table. */
export interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Validation status persisted alongside a credential. */
export type ValidationStatus = 'pending' | 'active' | 'invalid' | 'revoked';

/**
 * Row shape for the `provider_credentials` table.
 *
 * This row is SERVER-ONLY. It must never be returned to the browser as-is — call
 * `toProfile()` on the service first so `encryptedSecret` and `secretFingerprint`
 * are stripped.
 */
export interface ProviderCredentialRow {
  id: string;
  userId: string;
  providerType: ProviderId;
  displayName: string;
  /** JSON-serialised encryption envelope. Never returned to the browser. */
  encryptedSecret: string;
  /** Hash for duplicate detection. One-way; not the secret. */
  secretFingerprint: string;
  /** `abcd****wxyz` style preview. Safe to return to the browser. */
  maskedPreview: string;
  config: ProviderConfigJson;
  availableModels: string[];
  validationStatus: ValidationStatus;
  lastValidatedAt: string | null;
  lastValidationReason: string | null;
  lastUsedAt: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/** Per-provider non-secret config (e.g. Azure endpoint). */
export interface ProviderConfigJson {
  endpoint?: string;
  apiVersion?: string;
}

/**
 * Browser-safe projection of a provider credential.
 *
 * Excludes encryptedSecret, secretFingerprint, and any other field that could
 * help recover the plaintext.
 */
export interface ProviderProfile {
  id: string;
  providerType: ProviderId;
  displayName: string;
  maskedPreview: string;
  validationStatus: ValidationStatus;
  lastValidatedAt: string | null;
  lastValidationReason: string | null;
  lastUsedAt: string | null;
  availableModels: string[];
  isDefault: boolean;
  config: ProviderConfigJson;
  createdAt: string;
  updatedAt: string;
}

/** Sensitive lifecycle event written to the audit log. */
export type AuditEventType =
  | 'provider_created'
  | 'provider_validated'
  | 'provider_validation_failed'
  | 'provider_set_default'
  | 'provider_deleted'
  | 'provider_rotated'
  | 'provider_used_for_test_prompt';

export interface AuditEventRow {
  id: string;
  userId: string;
  eventType: AuditEventType;
  targetType: 'provider_credential';
  targetId: string;
  providerType: ProviderId | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
