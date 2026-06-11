#!/usr/bin/env node
/**
 * VentureOS migration runner (Sprint 2A.6).
 *
 * Walks every `packages/<pkg>/migrations/*.sql` in lexical order across
 * packages and applies any not yet recorded in `public._migrations`.
 *
 * Idempotent: a second run is a no-op.
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only).
 *
 * Usage:
 *   node scripts/migrate.mjs                 # apply pending
 *   node scripts/migrate.mjs --status        # show what's pending without applying
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGES_DIR = join(ROOT, 'packages');

const STATUS_ONLY = process.argv.includes('--status');

function fail(msg) {
  process.stderr.write(`migrate: ${msg}\n`);
  process.exit(1);
}

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
if (!url || !key) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const client = createClient(url, key, { auth: { persistSession: false } });

// Discover migrations across all packages.
const discovered = [];
for (const pkg of readdirSync(PACKAGES_DIR)) {
  const migDir = join(PACKAGES_DIR, pkg, 'migrations');
  let stat;
  try { stat = statSync(migDir); } catch { continue; }
  if (!stat.isDirectory()) continue;
  for (const file of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    discovered.push({ pkg, name: basename(file, '.sql'), path: join(migDir, file) });
  }
}
discovered.sort((a, b) => a.name.localeCompare(b.name) || a.pkg.localeCompare(b.pkg));

// Ensure the bookkeeping table exists. The runner uses a Postgres RPC
// (`exec_sql`) you must create once on the project:
//
//   create or replace function public.exec_sql(sql text) returns void
//   language plpgsql security definer as $$ begin execute sql; end; $$;
//
// (security definer is fine — only the service role can call it.)
async function exec(sql) {
  const { error } = await client.rpc('exec_sql', { sql });
  if (error) throw new Error(error.message);
}

await exec(`
  create table if not exists public._migrations (
    package text not null,
    name text not null,
    applied_at timestamptz not null default now(),
    primary key (package, name)
  );
`);

const { data: appliedRows, error: applErr } = await client
  .from('_migrations')
  .select('package,name');
if (applErr) fail(`could not read _migrations: ${applErr.message}`);
const applied = new Set((appliedRows ?? []).map((r) => `${r.package}/${r.name}`));

const pending = discovered.filter((m) => !applied.has(`${m.pkg}/${m.name}`));

process.stdout.write(`migrate: ${discovered.length} discovered, ${applied.size} applied, ${pending.length} pending\n`);
for (const m of pending) process.stdout.write(`  - ${m.pkg}/${m.name}\n`);

if (STATUS_ONLY) process.exit(0);

for (const m of pending) {
  process.stdout.write(`migrate: applying ${m.pkg}/${m.name}\n`);
  const sql = readFileSync(m.path, 'utf8');
  try {
    await exec(sql);
  } catch (e) {
    fail(`failed at ${m.pkg}/${m.name}: ${e.message}`);
  }
  const { error } = await client.from('_migrations').insert({ package: m.pkg, name: m.name });
  if (error) fail(`could not record ${m.pkg}/${m.name}: ${error.message}`);
}
process.stdout.write('migrate: done\n');
