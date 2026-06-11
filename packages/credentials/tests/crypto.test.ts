import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';

import { CredentialCrypto, type EncryptionEnvelope } from '../src/crypto';

function keyHex(): string {
  return randomBytes(32).toString('hex');
}

function makeCrypto(env?: Partial<Record<string, string>>): CredentialCrypto {
  return CredentialCrypto.fromEnv({
    VENTUREOS_CREDENTIAL_ENCRYPTION_KEY: keyHex(),
    ...env,
  });
}

describe('CredentialCrypto', () => {
  it('round-trips a plaintext through encrypt/decrypt', () => {
    const c = makeCrypto();
    const env = c.encrypt('sk-test-1234567890');
    expect(env.algo).toBe('AES-256-GCM');
    expect(env.iv).not.toContain('sk-');
    expect(env.ct).not.toContain('sk-');
    expect(c.decrypt(env)).toBe('sk-test-1234567890');
  });

  it('produces a different envelope for the same plaintext (fresh IV)', () => {
    const c = makeCrypto();
    const a = c.encrypt('hello');
    const b = c.encrypt('hello');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('refuses to decrypt a tampered ciphertext', () => {
    const c = makeCrypto();
    const env = c.encrypt('hello world');
    const tampered: EncryptionEnvelope = {
      ...env,
      ct: Buffer.from('garbage-bytes-here-not-real-ct').toString('base64'),
    };
    expect(() => c.decrypt(tampered)).toThrowError(
      /decryption or authentication failed/i,
    );
  });

  it('refuses to decrypt with a tampered tag', () => {
    const c = makeCrypto();
    const env = c.encrypt('hello world');
    const badTag = Buffer.alloc(16, 0xff).toString('base64');
    expect(() => c.decrypt({ ...env, tag: badTag })).toThrowError();
  });

  it('refuses to decrypt with an unknown kid', () => {
    const c = makeCrypto();
    const env = c.encrypt('x');
    expect(() => c.decrypt({ ...env, kid: 'rotated-away' })).toThrowError(
      /no key available for kid/i,
    );
  });

  it('produces a deterministic, irreversible fingerprint', () => {
    const c = makeCrypto();
    const f1 = c.fingerprint('sk-abc');
    const f2 = c.fingerprint('sk-abc');
    const f3 = c.fingerprint('sk-xyz');
    expect(f1).toBe(f2);
    expect(f1).not.toBe(f3);
    expect(f1).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(f1)).toBe(true);
    expect(f1).not.toContain('sk-');
  });

  it('round-trips an envelope through JSON', () => {
    const c = makeCrypto();
    const env = c.encrypt('payload');
    const json = CredentialCrypto.envelopeToJson(env);
    expect(json).not.toContain('payload');
    const back = CredentialCrypto.envelopeFromJson(json);
    expect(c.decrypt(back)).toBe('payload');
  });

  describe('fromEnv validation', () => {
    it('throws when the env var is missing', () => {
      expect(() => CredentialCrypto.fromEnv({})).toThrowError(/not set/i);
    });

    it('throws when the key is the wrong length', () => {
      expect(() =>
        CredentialCrypto.fromEnv({ VENTUREOS_CREDENTIAL_ENCRYPTION_KEY: 'too-short' }),
      ).toThrowError(/32 bytes/i);
    });

    it('accepts base64 keys', () => {
      const key = randomBytes(32).toString('base64');
      const c = CredentialCrypto.fromEnv({ VENTUREOS_CREDENTIAL_ENCRYPTION_KEY: key });
      expect(c.decrypt(c.encrypt('hi'))).toBe('hi');
    });

    it('refuses empty plaintext', () => {
      const c = makeCrypto();
      expect(() => c.encrypt('')).toThrowError(/empty plaintext/i);
    });
  });

  it('supports key rotation: old kid decrypts after a new active kid is added', () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const c1 = new CredentialCrypto({ activeKid: 'k1', keys: { k1: oldKey } });
    const env = c1.encrypt('persisted-before-rotation');

    const c2 = new CredentialCrypto({
      activeKid: 'k2',
      keys: { k1: oldKey, k2: newKey },
    });
    // Old envelope decrypts under the new keyring.
    expect(c2.decrypt(env)).toBe('persisted-before-rotation');
    // New writes use the active kid.
    const fresh = c2.encrypt('written-after-rotation');
    expect(fresh.kid).toBe('k2');
    expect(c2.decrypt(fresh)).toBe('written-after-rotation');
  });
});
