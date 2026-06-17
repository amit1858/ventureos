/**
 * ensureUserProfile — server-only.
 *
 * Upserts a row in public.users for a Supabase-authenticated user before any
 * write that has a FK constraint to public.users(id).
 *
 * Why: Supabase populates auth.users on Google sign-in but does NOT
 * automatically mirror into public.users.  Every table in the Real Mode schema
 * (provider_credentials, ventures, venture_jobs, …) references public.users(id)
 * via a foreign key, so the very first write for a new Google user fails with a
 * PG FK violation unless we upsert the shadow row first.
 *
 * Safe to call on every write — the upsert is idempotent (onConflict: 'id').
 * Non-UUID ids (alpha workspace, dev-cookie) are silently skipped because those
 * user identities have no corresponding auth.users row and do not persist to
 * Supabase.
 */
import 'server-only';

import { serviceRoleClient } from './supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function ensureUserProfile(user: {
  id: string;
  email: string;
}): Promise<void> {
  // Alpha-workspace and dev-cookie users have non-UUID ids ('alpha-user', etc.)
  // and have no auth.users row — skip gracefully.
  if (!UUID_RE.test(user.id)) return;

  const client = serviceRoleClient();
  const { error } = await client.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`UserProfileSync: ${error.message}`);
  }
}
