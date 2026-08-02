/**
 * Tests for ensureUserProfile.
 *
 * Verifies:
 * - Real Supabase UUID users trigger an upsert
 * - Non-UUID users (alpha, dev-cookie) are silently skipped
 * - Supabase write errors throw with UserProfileSync: prefix
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks so they are available before module imports
// ---------------------------------------------------------------------------
const { upsert, from, serviceRoleClient } = vi.hoisted(() => {
  const upsert = vi.fn();
  const from = vi.fn(() => ({ upsert }));
  const serviceRoleClient = vi.fn(() => ({ from }));
  return { upsert, from, serviceRoleClient };
});

vi.mock('../src/lib/supabase/server', () => ({ serviceRoleClient }));

// server-only guard — not available in test runtime; stub it out
vi.mock('server-only', () => ({}));

import { ensureUserProfile } from '../src/lib/ensure-user-profile';

describe('ensureUserProfile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    from.mockReturnValue({ upsert });
    serviceRoleClient.mockReturnValue({ from });
  });

  it('calls upsert with correct fields for a real UUID user', async () => {
    upsert.mockResolvedValue({ error: null });
    const user = { id: 'a1b2c3d4-1234-5678-abcd-ef0123456789', email: 'user@example.com' };

    await ensureUserProfile(user);

    expect(from).toHaveBeenCalledWith('users');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id, email: user.email }),
      { onConflict: 'id' },
    );
  });

  it('skips upsert for non-UUID id (alpha-user)', async () => {
    await ensureUserProfile({ id: 'alpha-user', email: 'alpha@foundry.local' });
    expect(from).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('skips upsert for non-UUID id (dev-cookie)', async () => {
    await ensureUserProfile({ id: 'dev-user', email: 'dev@example.com' });
    expect(from).not.toHaveBeenCalled();
  });

  it('throws with UserProfileSync: prefix when Supabase returns an error', async () => {
    upsert.mockResolvedValue({ error: { message: 'permission denied for table users' } });
    const user = { id: 'a1b2c3d4-1234-5678-abcd-ef0123456789', email: 'user@example.com' };

    await expect(ensureUserProfile(user)).rejects.toThrow(
      /^UserProfileSync: permission denied/,
    );
  });
});
