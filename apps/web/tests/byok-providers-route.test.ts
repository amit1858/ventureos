import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser, getCredentialService, UnauthorizedError, ensureUserProfile } = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    constructor() {
      super('Unauthorized');
      this.name = 'UnauthorizedError';
    }
  }
  return {
    requireUser: vi.fn(),
    getCredentialService: vi.fn(),
    UnauthorizedError,
    ensureUserProfile: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../src/lib/auth', () => ({
  requireUser,
  UnauthorizedError,
}));

vi.mock('../src/lib/credentials', () => ({
  getCredentialService,
}));

vi.mock('../src/lib/ensure-user-profile', () => ({
  ensureUserProfile,
}));

import { POST } from '../src/app/api/byok/providers/route';

describe('POST /api/byok/providers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ensureUserProfile.mockResolvedValue(undefined);
  });

  it('returns structured 401 JSON for unauthorized users', async () => {
    requireUser.mockRejectedValue(new UnauthorizedError());
    const req = new Request('http://localhost/api/byok/providers', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'anthropic',
        displayName: 'Personal key',
        secret: 'dummy',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; reason: string };
    expect(res.status).toBe(401);
    expect(body).toEqual({ ok: false, reason: 'Unauthorized.' });
  });

  it('returns structured 503 JSON when encryption key is missing/invalid', async () => {
    requireUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    getCredentialService.mockReturnValue({
      createProvider: () => {
        throw new Error('CredentialCrypto: VENTUREOS_CREDENTIAL_ENCRYPTION_KEY is not set.');
      },
    });

    const req = new Request('http://localhost/api/byok/providers', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'anthropic',
        displayName: 'Personal key',
        secret: 'dummy',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; code?: string; reason: string };
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.code).toBe('byok_encryption_not_configured');
    expect(body.reason).toContain('VENTUREOS_CREDENTIAL_ENCRYPTION_KEY');
  });

  it('returns structured 503 JSON when Supabase env is missing', async () => {
    requireUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    getCredentialService.mockReturnValue({
      createProvider: () => {
        throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
      },
    });

    const req = new Request('http://localhost/api/byok/providers', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'anthropic',
        displayName: 'Personal key',
        secret: 'dummy',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; code?: string; reason: string };
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.code).toBe('server_not_configured');
  });

  it('returns structured 503 JSON when user profile upsert fails', async () => {
    requireUser.mockResolvedValue({ id: 'a1b2c3d4-1234-5678-abcd-ef0123456789', email: 'u@example.com' });
    ensureUserProfile.mockRejectedValue(
      new Error('UserProfileSync: permission denied for table users'),
    );

    const req = new Request('http://localhost/api/byok/providers', {
      method: 'POST',
      body: JSON.stringify({
        providerType: 'anthropic',
        displayName: 'Personal key',
        secret: 'dummy',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const res = await POST(req);
    const body = (await res.json()) as { ok: boolean; code?: string; reason: string };
    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.code).toBe('user_profile_sync_failed');
  });
});
