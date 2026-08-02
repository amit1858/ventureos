/**
 * Supabase-backed implementations of CredentialStore and AuditLogger.
 *
 * SERVER-ONLY. Must be constructed with a service-role client. The service-role key
 * bypasses RLS, so the service layer is the only line of defence — every method here
 * filters by `user_id` explicitly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuditLogger, AuditWriteInput } from './audit';
import { sanitiseMetadata } from './audit';
import type { CreateInput, CredentialStore, UpdatePatch } from './store';
import type {
  AuditEventRow,
  ProviderCredentialRow,
  ProviderConfigJson,
  ValidationStatus,
} from './types';
import type { ProviderId } from '@foundry/contracts';

interface DbCredentialRow {
  id: string;
  user_id: string;
  provider_type: string;
  display_name: string;
  encrypted_secret: string;
  secret_fingerprint: string;
  masked_preview: string;
  config_json: ProviderConfigJson;
  available_models_json: string[];
  validation_status: string;
  last_validated_at: string | null;
  last_validation_reason: string | null;
  last_used_at: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DbAuditRow {
  id: string;
  user_id: string;
  event_type: string;
  target_type: string;
  target_id: string;
  provider_type: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

const TABLE_CRED = 'provider_credentials';
const TABLE_AUDIT = 'audit_events';

export class SupabaseCredentialStore implements CredentialStore {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: CreateInput): Promise<ProviderCredentialRow> {
    const { data, error } = await this.client
      .from(TABLE_CRED)
      .insert({
        user_id: input.userId,
        provider_type: input.providerType,
        display_name: input.displayName,
        encrypted_secret: input.encryptedSecret,
        secret_fingerprint: input.secretFingerprint,
        masked_preview: input.maskedPreview,
        config_json: input.config,
        available_models_json: input.availableModels,
        validation_status: input.validationStatus,
        last_validated_at: input.lastValidatedAt,
        last_validation_reason: input.lastValidationReason,
        is_default: input.isDefault,
      })
      .select('*')
      .single();
    if (error || !data) throw new Error(`SupabaseCredentialStore.create: ${error?.message ?? 'no row'}`);
    return rowFromDb(data as DbCredentialRow);
  }

  async listByUser(userId: string): Promise<ProviderCredentialRow[]> {
    const { data, error } = await this.client
      .from(TABLE_CRED)
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`SupabaseCredentialStore.listByUser: ${error.message}`);
    return (data as DbCredentialRow[] | null ?? []).map(rowFromDb);
  }

  async getForUser(userId: string, id: string): Promise<ProviderCredentialRow | null> {
    const { data, error } = await this.client
      .from(TABLE_CRED)
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw new Error(`SupabaseCredentialStore.getForUser: ${error.message}`);
    return data ? rowFromDb(data as DbCredentialRow) : null;
  }

  async updateForUser(
    userId: string,
    id: string,
    patch: UpdatePatch,
  ): Promise<ProviderCredentialRow | null> {
    const dbPatch = patchToDb(patch);
    const { data, error } = await this.client
      .from(TABLE_CRED)
      .update(dbPatch)
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`SupabaseCredentialStore.updateForUser: ${error.message}`);
    return data ? rowFromDb(data as DbCredentialRow) : null;
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    const { error, count } = await this.client
      .from(TABLE_CRED)
      .update({ deleted_at: new Date().toISOString(), is_default: false }, { count: 'exact' })
      .eq('user_id', userId)
      .eq('id', id)
      .is('deleted_at', null);
    if (error) throw new Error(`SupabaseCredentialStore.softDelete: ${error.message}`);
    return (count ?? 0) > 0;
  }

  async clearDefaultForUser(userId: string, exceptId: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE_CRED)
      .update({ is_default: false })
      .eq('user_id', userId)
      .neq('id', exceptId)
      .eq('is_default', true);
    if (error) throw new Error(`SupabaseCredentialStore.clearDefaultForUser: ${error.message}`);
  }
}

export class SupabaseAuditLogger implements AuditLogger {
  constructor(private readonly client: SupabaseClient) {}

  async write(input: AuditWriteInput): Promise<void> {
    const { error } = await this.client.from(TABLE_AUDIT).insert({
      user_id: input.userId,
      event_type: input.eventType,
      target_type: 'provider_credential',
      target_id: input.targetId,
      provider_type: input.providerType,
      metadata_json: sanitiseMetadata(input.metadata),
    });
    if (error) throw new Error(`SupabaseAuditLogger.write: ${error.message}`);
  }

  async list(userId: string): Promise<AuditEventRow[]> {
    const { data, error } = await this.client
      .from(TABLE_AUDIT)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`SupabaseAuditLogger.list: ${error.message}`);
    return (data as DbAuditRow[] | null ?? []).map(auditRowFromDb);
  }
}

function rowFromDb(r: DbCredentialRow): ProviderCredentialRow {
  return {
    id: r.id,
    userId: r.user_id,
    providerType: r.provider_type as ProviderId,
    displayName: r.display_name,
    encryptedSecret: r.encrypted_secret,
    secretFingerprint: r.secret_fingerprint,
    maskedPreview: r.masked_preview,
    config: r.config_json ?? {},
    availableModels: r.available_models_json ?? [],
    validationStatus: r.validation_status as ValidationStatus,
    lastValidatedAt: r.last_validated_at,
    lastValidationReason: r.last_validation_reason,
    lastUsedAt: r.last_used_at,
    isDefault: r.is_default,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

function auditRowFromDb(r: DbAuditRow): AuditEventRow {
  return {
    id: r.id,
    userId: r.user_id,
    eventType: r.event_type as AuditEventRow['eventType'],
    targetType: 'provider_credential',
    targetId: r.target_id,
    providerType: (r.provider_type as ProviderId | null) ?? null,
    metadata: r.metadata_json ?? {},
    createdAt: r.created_at,
  };
}

function patchToDb(patch: UpdatePatch): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.displayName !== undefined) out['display_name'] = patch.displayName;
  if (patch.encryptedSecret !== undefined) out['encrypted_secret'] = patch.encryptedSecret;
  if (patch.secretFingerprint !== undefined) out['secret_fingerprint'] = patch.secretFingerprint;
  if (patch.maskedPreview !== undefined) out['masked_preview'] = patch.maskedPreview;
  if (patch.config !== undefined) out['config_json'] = patch.config;
  if (patch.availableModels !== undefined) out['available_models_json'] = patch.availableModels;
  if (patch.validationStatus !== undefined) out['validation_status'] = patch.validationStatus;
  if (patch.lastValidatedAt !== undefined) out['last_validated_at'] = patch.lastValidatedAt;
  if (patch.lastValidationReason !== undefined) out['last_validation_reason'] = patch.lastValidationReason;
  if (patch.lastUsedAt !== undefined) out['last_used_at'] = patch.lastUsedAt;
  if (patch.isDefault !== undefined) out['is_default'] = patch.isDefault;
  return out;
}
