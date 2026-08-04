/**
 * Process-wide singleton Venture store + service (Sprint 2A.5 / 2A.6).
 *
 * Storage selection: if a Supabase URL (SUPABASE_URL, falling back to
 * NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY are set, use
 * SupabaseVentureStore so demo state survives a server restart. Otherwise fall
 * back to the in-memory store. Tenant isolation is enforced by the service
 * itself: every call carries ownerId, and the store keys all rows by
 * (ownerId, ventureId).
 */
import 'server-only';

import {
  InMemoryVentureStore,
  SupabaseVentureStore,
  VentureService,
  type VentureStore,
} from '@foundry/ventures';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  // eslint-disable-next-line no-var
  var __foundry_venture_service: VentureService | undefined;
  // eslint-disable-next-line no-var
  var __foundry_supabase_admin: SupabaseClient | undefined;
}

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) return null;
  if (!globalThis.__foundry_supabase_admin) {
    globalThis.__foundry_supabase_admin = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return globalThis.__foundry_supabase_admin;
}

function buildStore(): VentureStore {
  const admin = getSupabaseAdmin();
  if (admin) return new SupabaseVentureStore(admin);
  return new InMemoryVentureStore();
}

export function getVentureService(): VentureService {
  if (!globalThis.__foundry_venture_service) {
    globalThis.__foundry_venture_service = new VentureService(buildStore());
  }
  return globalThis.__foundry_venture_service;
}

