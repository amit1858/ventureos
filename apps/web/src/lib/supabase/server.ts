/**
 * Server-only Supabase clients.
 *
 * Two clients live here:
 *   - `serverComponentClient()` — bound to the user's session via cookies. Used to
 *     read auth state in Server Components, route handlers, and middleware.
 *   - `serviceRoleClient()` — bypasses RLS. Used by `@foundry/credentials` to
 *     write through the trusted service layer. NEVER exposed to the browser.
 *
 * Both functions throw a sanitised error if the required environment variables are
 * not set; callers should treat this as a 500 with no leaked detail.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

function readEnv(name: string): string {
  const v = process.env[name];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function serverComponentClient(): SupabaseClient {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anon = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const cookieStore = cookies();
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch { /* read-only in some contexts */ }
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch { /* idem */ }
      },
    },
  }) as unknown as SupabaseClient;
}

let _serviceRoleClient: SupabaseClient | null = null;
export function serviceRoleClient(): SupabaseClient {
  if (_serviceRoleClient) return _serviceRoleClient;
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  _serviceRoleClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _serviceRoleClient;
}
