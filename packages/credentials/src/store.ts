import type { ProviderId } from '@ventureos/contracts';
import type { ProviderCredentialRow, ProviderConfigJson, ValidationStatus } from './types';

/**
 * Storage abstraction for provider credentials. All implementations MUST enforce
 * `userId`-scoping on every operation. Cross-user reads/writes must be impossible
 * even with a forged id.
 */
export interface CredentialStore {
  create(input: CreateInput): Promise<ProviderCredentialRow>;
  listByUser(userId: string): Promise<ProviderCredentialRow[]>;
  /** Returns null when missing, soft-deleted, or owned by a different user. */
  getForUser(userId: string, id: string): Promise<ProviderCredentialRow | null>;
  updateForUser(
    userId: string,
    id: string,
    patch: UpdatePatch,
  ): Promise<ProviderCredentialRow | null>;
  /** Mark soft-deleted (sets deletedAt). Idempotent. */
  softDelete(userId: string, id: string): Promise<boolean>;
  /** Clear `isDefault` for every other credential of this user. */
  clearDefaultForUser(userId: string, exceptId: string): Promise<void>;
  /** Optional: hard-delete for tests. */
  _resetForTests?(): void;
}

export interface CreateInput {
  userId: string;
  providerType: ProviderId;
  displayName: string;
  encryptedSecret: string;
  secretFingerprint: string;
  maskedPreview: string;
  config: ProviderConfigJson;
  availableModels: string[];
  validationStatus: ValidationStatus;
  lastValidatedAt: string | null;
  lastValidationReason: string | null;
  isDefault: boolean;
}

export interface UpdatePatch {
  displayName?: string;
  encryptedSecret?: string;
  secretFingerprint?: string;
  maskedPreview?: string;
  config?: ProviderConfigJson;
  availableModels?: string[];
  validationStatus?: ValidationStatus;
  lastValidatedAt?: string | null;
  lastValidationReason?: string | null;
  lastUsedAt?: string | null;
  isDefault?: boolean;
}

// ── In-memory implementation ─────────────────────────────────────────────────

let seq = 0;
function newId(): string {
  seq += 1;
  return `pc_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export class InMemoryCredentialStore implements CredentialStore {
  private rows: ProviderCredentialRow[] = [];

  async create(input: CreateInput): Promise<ProviderCredentialRow> {
    const now = new Date().toISOString();
    const row: ProviderCredentialRow = {
      id: newId(),
      userId: input.userId,
      providerType: input.providerType,
      displayName: input.displayName,
      encryptedSecret: input.encryptedSecret,
      secretFingerprint: input.secretFingerprint,
      maskedPreview: input.maskedPreview,
      config: input.config,
      availableModels: input.availableModels,
      validationStatus: input.validationStatus,
      lastValidatedAt: input.lastValidatedAt,
      lastValidationReason: input.lastValidationReason,
      lastUsedAt: null,
      isDefault: input.isDefault,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.rows.push(row);
    return { ...row };
  }

  async listByUser(userId: string): Promise<ProviderCredentialRow[]> {
    return this.rows
      .filter((r) => r.userId === userId && r.deletedAt === null)
      .map((r) => ({ ...r }));
  }

  async getForUser(userId: string, id: string): Promise<ProviderCredentialRow | null> {
    const r = this.rows.find((r) => r.id === id && r.userId === userId && r.deletedAt === null);
    return r ? { ...r } : null;
  }

  async updateForUser(
    userId: string,
    id: string,
    patch: UpdatePatch,
  ): Promise<ProviderCredentialRow | null> {
    const idx = this.rows.findIndex(
      (r) => r.id === id && r.userId === userId && r.deletedAt === null,
    );
    if (idx === -1) return null;
    const existing = this.rows[idx]!;
    const updated: ProviderCredentialRow = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.rows[idx] = updated;
    return { ...updated };
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    const idx = this.rows.findIndex(
      (r) => r.id === id && r.userId === userId && r.deletedAt === null,
    );
    if (idx === -1) return false;
    const existing = this.rows[idx]!;
    this.rows[idx] = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: false,
    };
    return true;
  }

  async clearDefaultForUser(userId: string, exceptId: string): Promise<void> {
    this.rows = this.rows.map((r) =>
      r.userId === userId && r.id !== exceptId && r.isDefault
        ? { ...r, isDefault: false, updatedAt: new Date().toISOString() }
        : r,
    );
  }

  _resetForTests(): void {
    this.rows = [];
  }

  /** Test-only: peek at raw rows (including soft-deleted). */
  _allForTests(): ProviderCredentialRow[] {
    return this.rows.slice();
  }
}
