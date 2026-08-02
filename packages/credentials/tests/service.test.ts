import { describe, expect, it, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';

import { CredentialCrypto } from '../src/crypto';
import { InMemoryAuditLogger } from '../src/audit';
import { InMemoryCredentialStore } from '../src/store';
import {
  CredentialService,
  type ProviderTestPromptRunner,
  type ProviderValidator,
} from '../src/service';
import type { ProviderId } from '@foundry/contracts';

const USER_A = 'u_alice';
const USER_B = 'u_bob';
const OPENAI_SECRET = 'sk-' + 'A'.repeat(40);
const OPENAI_SECRET_2 = 'sk-' + 'B'.repeat(40);

function makeService(opts?: {
  validator?: ProviderValidator;
  testRunner?: ProviderTestPromptRunner;
}) {
  const store = new InMemoryCredentialStore();
  const audit = new InMemoryAuditLogger();
  const crypto = new CredentialCrypto({
    activeKid: 'k1',
    keys: { k1: randomBytes(32) },
  });
  const validator: ProviderValidator =
    opts?.validator ??
    (async () => ({ valid: true, models: ['gpt-4o-mini', 'gpt-4o'] }));
  const testRunner: ProviderTestPromptRunner =
    opts?.testRunner ??
    (async () => ({
      ok: true,
      content: 'ok',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      costUsd: 0.0001,
      finishReason: 'stop',
    }));
  const service = new CredentialService({
    store,
    audit,
    crypto,
    validator,
    testPromptRunner: testRunner,
    modelCatalog: (p: ProviderId) =>
      p === 'openai' ? ['gpt-4o-mini'] : [],
  });
  return { service, store, audit, crypto };
}

describe('CredentialService: create + list + safety', () => {
  it('creates a provider, encrypts the secret, returns a safe profile', async () => {
    const { service, store } = makeService();
    const res = await service.createProvider({
      userId: USER_A,
      providerType: 'openai',
      displayName: 'Personal',
      secret: OPENAI_SECRET,
    });
    expect(res.ok).toBe(true);
    expect(res.profile?.providerType).toBe('openai');
    expect(res.profile?.maskedPreview).toMatch(/sk-A.*\*+.*AAAA/);
    // Profile NEVER contains the plaintext or the encrypted envelope.
    const json = JSON.stringify(res.profile);
    expect(json).not.toContain(OPENAI_SECRET);
    expect(json).not.toContain('encrypted');
    // Store row carries an encrypted envelope, never the plaintext.
    const rows = store._allForTests();
    expect(rows[0]!.encryptedSecret).not.toContain(OPENAI_SECRET);
    expect(rows[0]!.encryptedSecret).toContain('"algo":"AES-256-GCM"');
  });

  it('first provider is marked default automatically', async () => {
    const { service } = makeService();
    const a = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    expect(a.profile?.isDefault).toBe(true);
    const b = await service.createProvider({
      userId: USER_A, providerType: 'anthropic',
      displayName: 'B',
      secret: 'sk-ant-' + 'B'.repeat(40),
    });
    expect(b.profile?.isDefault).toBe(false);
  });

  it('refuses to create when validation fails (does not persist anything)', async () => {
    const { service, store, audit } = makeService({
      validator: async () => ({ valid: false, reason: 'Invalid API key.' }),
    });
    const res = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'X', secret: OPENAI_SECRET,
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('Invalid');
    expect(store._allForTests()).toHaveLength(0);
    expect(audit._allForTests()).toHaveLength(0);
  });

  it('rejects malformed secrets via key-shape check', async () => {
    const { service } = makeService();
    const res = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'X', secret: 'not-an-sk-key',
    });
    expect(res.ok).toBe(false);
  });

  it('writes provider_created audit event with no secret material', async () => {
    const { service, audit } = makeService();
    await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'Personal', secret: OPENAI_SECRET,
    });
    const events = audit._allForTests();
    expect(events.map((e) => e.eventType)).toEqual(['provider_created']);
    const json = JSON.stringify(events);
    expect(json).not.toContain(OPENAI_SECRET);
  });

  it('listProfiles returns only the calling user\'s providers', async () => {
    const { service } = makeService();
    await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    await service.createProvider({
      userId: USER_B, providerType: 'openai', displayName: 'B', secret: OPENAI_SECRET_2,
    });
    const aList = await service.listProfiles(USER_A);
    const bList = await service.listProfiles(USER_B);
    expect(aList).toHaveLength(1);
    expect(bList).toHaveLength(1);
    expect(aList[0]!.displayName).toBe('A');
    expect(bList[0]!.displayName).toBe('B');
  });
});

describe('CredentialService: validate / test-prompt / default / delete / rotate', () => {
  it('revalidate marks invalid when probe fails and writes failure event', async () => {
    let firstCall = true;
    const { service, audit } = makeService({
      validator: async () => {
        if (firstCall) { firstCall = false; return { valid: true }; }
        return { valid: false, reason: 'expired' };
      },
    });
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'X', secret: OPENAI_SECRET,
    });
    const res = await service.revalidate(USER_A, created.profile!.id);
    expect(res.ok).toBe(false);
    expect(res.profile?.validationStatus).toBe('invalid');
    expect(res.profile?.lastValidationReason).toBe('expired');
    const events = audit._allForTests().map((e) => e.eventType);
    expect(events).toContain('provider_validation_failed');
  });

  it('runTestPrompt decrypts server-side, returns content but no secret', async () => {
    const { service } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'X', secret: OPENAI_SECRET,
    });
    const out = await service.runTestPrompt(USER_A, created.profile!.id, {
      modelId: 'gpt-4o-mini',
      prompt: 'hi',
    });
    expect(out.ok).toBe(true);
    expect(out.content).toBe('ok');
    expect(JSON.stringify(out)).not.toContain(OPENAI_SECRET);
  });

  it('setDefault swaps default to exactly one provider', async () => {
    const { service } = makeService();
    const a = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    const b = await service.createProvider({
      userId: USER_A, providerType: 'anthropic',
      displayName: 'B',
      secret: 'sk-ant-' + 'B'.repeat(40),
    });
    await service.setDefault(USER_A, b.profile!.id);
    const list = await service.listProfiles(USER_A);
    const defaults = list.filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.id).toBe(b.profile!.id);
    expect(list.find((p) => p.id === a.profile!.id)!.isDefault).toBe(false);
  });

  it('deleteProvider soft-deletes; subsequent ops cannot use it', async () => {
    const { service, store } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    const del = await service.deleteProvider(USER_A, created.profile!.id);
    expect(del.ok).toBe(true);
    // listProfiles hides it
    expect(await service.listProfiles(USER_A)).toHaveLength(0);
    // revalidate fails
    expect((await service.revalidate(USER_A, created.profile!.id)).ok).toBe(false);
    // run test-prompt fails
    expect((await service.runTestPrompt(USER_A, created.profile!.id, {
      modelId: 'gpt-4o-mini', prompt: 'x',
    })).ok).toBe(false);
    // Raw row still exists for forensics but with deletedAt set.
    const raw = store._allForTests().find((r) => r.id === created.profile!.id);
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('rotateSecret re-encrypts under a fresh IV and updates fingerprint', async () => {
    const { service, store } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    const before = store._allForTests()[0]!;
    const rot = await service.rotateSecret(USER_A, created.profile!.id, OPENAI_SECRET_2);
    expect(rot.ok).toBe(true);
    const after = store._allForTests().find((r) => r.id === created.profile!.id)!;
    expect(after.encryptedSecret).not.toBe(before.encryptedSecret);
    expect(after.secretFingerprint).not.toBe(before.secretFingerprint);
    expect(after.maskedPreview).not.toBe(before.maskedPreview);
  });
});

describe('CredentialService: tenant isolation', () => {
  let svc: ReturnType<typeof makeService>;
  let aliceId: string;

  beforeEach(async () => {
    svc = makeService();
    const r = await svc.service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'Alice', secret: OPENAI_SECRET,
    });
    aliceId = r.profile!.id;
  });

  it('User B cannot read User A\'s provider via revalidate', async () => {
    const r = await svc.service.revalidate(USER_B, aliceId);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not found/i);
  });

  it('User B cannot run a test prompt against User A\'s provider', async () => {
    const r = await svc.service.runTestPrompt(USER_B, aliceId, {
      modelId: 'gpt-4o-mini', prompt: 'x',
    });
    expect(r.ok).toBe(false);
  });

  it('User B cannot soft-delete User A\'s provider', async () => {
    const r = await svc.service.deleteProvider(USER_B, aliceId);
    expect(r.ok).toBe(false);
    // Still alive for User A.
    const list = await svc.service.listProfiles(USER_A);
    expect(list).toHaveLength(1);
  });

  it('User B cannot set User A\'s provider as their default', async () => {
    const r = await svc.service.setDefault(USER_B, aliceId);
    expect(r.ok).toBe(false);
  });

  it('User B cannot rotate User A\'s secret', async () => {
    const r = await svc.service.rotateSecret(USER_B, aliceId, OPENAI_SECRET_2);
    expect(r.ok).toBe(false);
  });
});

describe('audit safety', () => {
  it('drops sensitive-looking keys from metadata', async () => {
    const { service, audit } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    // Manually write a tainted event to exercise the sanitiser.
    await audit.write({
      userId: USER_A,
      eventType: 'provider_used_for_test_prompt',
      targetId: created.profile!.id,
      providerType: 'openai',
      metadata: { secret: 'sk-leak', apiKey: 'sk-leak', modelId: 'gpt-4o-mini' },
    });
    const last = audit._allForTests().at(-1)!;
    expect(last.metadata['secret']).toBeUndefined();
    expect(last.metadata['apiKey']).toBeUndefined();
    expect(last.metadata['modelId']).toBe('gpt-4o-mini');
  });
});

describe('withDecryptedSecret', () => {
  it('exposes plaintext to callback for the same user and updates lastUsedAt', async () => {
    const { service } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    const id = created.profile!.id;
    const r = await service.withDecryptedSecret(USER_A, id, async ({ secret, providerType }) => {
      expect(secret).toBe(OPENAI_SECRET);
      expect(providerType).toBe('openai');
      return 'value';
    });
    expect(r).toEqual({ ok: true, value: 'value' });
    const list = await service.listProfiles(USER_A);
    expect(list[0]?.lastUsedAt).not.toBeNull();
  });

  it('refuses cross-user access (tenant isolation)', async () => {
    const { service } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    const id = created.profile!.id;
    const r = await service.withDecryptedSecret(USER_B, id, async () => 'should-not-run');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not found/i);
  });

  it('does not leak plaintext via the return value', async () => {
    const { service } = makeService();
    const created = await service.createProvider({
      userId: USER_A, providerType: 'openai', displayName: 'A', secret: OPENAI_SECRET,
    });
    const id = created.profile!.id;
    const r = await service.withDecryptedSecret(USER_A, id, async ({ secret }) => {
      // Callback intentionally NEVER returns the secret. Verify the wrapper
      // doesn't somehow attach it to the result envelope.
      return { length: secret.length };
    });
    expect(JSON.stringify(r)).not.toContain(OPENAI_SECRET);
  });
});
