import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireUser, getCredentialService, UnauthorizedError } = vi.hoisted(() => {
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
  };
});

vi.mock('../src/lib/auth', () => ({
  requireUser,
  UnauthorizedError,
}));

vi.mock('../src/lib/credentials', () => ({
  getCredentialService,
}));

import { POST } from '../src/app/api/byok/providers/route';

describe('POST /api/byok/providers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
});
