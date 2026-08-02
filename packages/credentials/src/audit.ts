import type { AuditEventRow, AuditEventType } from './types';
import type { ProviderId } from '@foundry/contracts';

export interface AuditWriteInput {
  userId: string;
  eventType: AuditEventType;
  targetId: string;
  providerType: ProviderId | null;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  write(event: AuditWriteInput): Promise<void>;
  list(userId: string): Promise<AuditEventRow[]>;
}

/**
 * Defensive metadata sanitiser. Strips keys with security-sensitive names so a careless
 * caller can't accidentally write a secret to the audit table.
 */
const FORBIDDEN_META_KEYS = new Set([
  'secret', 'apiKey', 'api_key', 'password', 'token', 'authorization',
  'encryptedSecret', 'encrypted_secret', 'plaintext', 'ciphertext',
]);
export function sanitiseMetadata(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN_META_KEYS.has(k)) continue;
    if (typeof v === 'string' && v.length > 1024) continue;
    out[k] = v;
  }
  return out;
}

export class InMemoryAuditLogger implements AuditLogger {
  private events: AuditEventRow[] = [];

  async write(input: AuditWriteInput): Promise<void> {
    this.events.push({
      id: `aud_${this.events.length + 1}_${Date.now().toString(36)}`,
      userId: input.userId,
      eventType: input.eventType,
      targetType: 'provider_credential',
      targetId: input.targetId,
      providerType: input.providerType,
      metadata: sanitiseMetadata(input.metadata),
      createdAt: new Date().toISOString(),
    });
  }

  async list(userId: string): Promise<AuditEventRow[]> {
    return this.events.filter((e) => e.userId === userId).slice();
  }

  /** Test-only: read all events including across users. */
  _allForTests(): AuditEventRow[] {
    return this.events.slice();
  }
}
