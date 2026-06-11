/**
 * Server-only envelope encryption for provider credentials.
 *
 * SECURITY NOTES
 *  - Algorithm: AES-256-GCM (authenticated). 12-byte IV per encryption, fresh from CSPRNG.
 *  - Key: 32 raw bytes, sourced from `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` as either
 *    a 64-char hex string or a base64 string. Refuses to start with anything else.
 *  - Rotation: every envelope carries `kid`. To rotate, instantiate with a new active
 *    key while keeping old keys available for decryption.
 *  - Fingerprint: HMAC-SHA256(plaintext, key) truncated to 32 hex chars. One-way,
 *    domain-separated from the encryption path. Used only for duplicate detection.
 *  - Never throws with plaintext in the message. All error strings are static.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export interface EncryptionEnvelope {
  /** Algorithm tag. Always 'AES-256-GCM' for now. */
  algo: 'AES-256-GCM';
  /** Key id. Lets us decrypt old payloads after rotation. */
  kid: string;
  /** Base64 IV. 12 bytes. */
  iv: string;
  /** Base64 ciphertext. */
  ct: string;
  /** Base64 GCM tag. */
  tag: string;
}

const ENV_KEY = 'VENTUREOS_CREDENTIAL_ENCRYPTION_KEY';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const FINGERPRINT_DOMAIN = 'ventureos:credential-fingerprint:v1';

export class CredentialCrypto {
  readonly activeKid: string;
  /** Map of kid → 32-byte key. The active kid is always present. */
  private readonly keyring: Map<string, Buffer>;

  constructor(opts: { activeKid: string; keys: Record<string, Buffer> }) {
    if (!opts.keys[opts.activeKid]) {
      throw new Error('CredentialCrypto: active key id not found in keyring.');
    }
    for (const [kid, key] of Object.entries(opts.keys)) {
      if (key.length !== KEY_BYTES) {
        throw new Error(`CredentialCrypto: key '${kid}' must be exactly ${KEY_BYTES} bytes.`);
      }
    }
    this.activeKid = opts.activeKid;
    this.keyring = new Map(Object.entries(opts.keys));
  }

  /**
   * Build from environment. Required: `VENTUREOS_CREDENTIAL_ENCRYPTION_KEY` (32 bytes, hex or base64).
   * Throws synchronously with a sanitized message if absent or malformed.
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): CredentialCrypto {
    const raw = env[ENV_KEY];
    if (typeof raw !== 'string' || raw.length === 0) {
      throw new Error(`CredentialCrypto: ${ENV_KEY} is not set.`);
    }
    const key = parseKey(raw);
    if (!key) {
      throw new Error(
        `CredentialCrypto: ${ENV_KEY} must be 32 bytes encoded as hex (64 chars) or base64.`,
      );
    }
    const kid = env['VENTUREOS_CREDENTIAL_ENCRYPTION_KID'] ?? 'k1';
    return new CredentialCrypto({ activeKid: kid, keys: { [kid]: key } });
  }

  encrypt(plaintext: string): EncryptionEnvelope {
    if (typeof plaintext !== 'string' || plaintext.length === 0) {
      throw new Error('CredentialCrypto: refusing to encrypt empty plaintext.');
    }
    const key = this.keyring.get(this.activeKid)!;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      algo: 'AES-256-GCM',
      kid: this.activeKid,
      iv: iv.toString('base64'),
      ct: ct.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(env: EncryptionEnvelope): string {
    if (env.algo !== 'AES-256-GCM') {
      throw new Error('CredentialCrypto: unsupported algorithm.');
    }
    const key = this.keyring.get(env.kid);
    if (!key) {
      throw new Error(`CredentialCrypto: no key available for kid '${env.kid}'.`);
    }
    const iv = Buffer.from(env.iv, 'base64');
    const ct = Buffer.from(env.ct, 'base64');
    const tag = Buffer.from(env.tag, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    try {
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      return pt.toString('utf8');
    } catch {
      // Generic message — never echo ciphertext, tag, or partial plaintext.
      throw new Error('CredentialCrypto: decryption or authentication failed.');
    }
  }

  /**
   * Domain-separated HMAC of the plaintext, used only for duplicate detection inside
   * a single user's credentials. Different from the encryption path so it can never
   * be used as a decryption oracle.
   */
  fingerprint(plaintext: string): string {
    const key = this.keyring.get(this.activeKid)!;
    const h = createHmac('sha256', key);
    h.update(FINGERPRINT_DOMAIN);
    h.update('\0');
    h.update(plaintext, 'utf8');
    return h.digest('hex').slice(0, 32);
  }

  /** Round-trips an envelope to/from JSON string for storage in a TEXT column. */
  static envelopeToJson(env: EncryptionEnvelope): string {
    return JSON.stringify(env);
  }
  static envelopeFromJson(raw: string): EncryptionEnvelope {
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) {
      throw new Error('CredentialCrypto: malformed envelope JSON.');
    }
    return parsed;
  }
}

function parseKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  // hex
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_BYTES * 2) {
    return Buffer.from(trimmed, 'hex');
  }
  // base64 (incl. base64url)
  try {
    const normalised = trimmed.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(normalised, 'base64');
    if (buf.length === KEY_BYTES) return buf;
  } catch {
    /* fall through */
  }
  return null;
}

function isEnvelope(x: unknown): x is EncryptionEnvelope {
  if (!x || typeof x !== 'object') return false;
  const e = x as Record<string, unknown>;
  return (
    e['algo'] === 'AES-256-GCM' &&
    typeof e['kid'] === 'string' &&
    typeof e['iv'] === 'string' &&
    typeof e['ct'] === 'string' &&
    typeof e['tag'] === 'string'
  );
}
