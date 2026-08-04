-- Foundry Sprint 1C: BYOK credential storage schema.
--
-- Design notes:
--   * `users` shadows `auth.users` so we can FK + show display name without
--     joining the auth schema. `id` matches `auth.uid()`.
--   * `provider_credentials.encrypted_secret` is a JSON envelope produced by
--     `@foundry/credentials` (AES-256-GCM). NEVER queried by the browser.
--   * Row-Level Security is the defence-in-depth layer. The Node service uses
--     the service-role key (bypasses RLS) and enforces `user_id = $auth` itself,
--     so even a future direct-from-client read with the anon key would be safe.
--   * Soft delete via `deleted_at`. Listing queries always filter it out.
--   * `provider_type` uses the same vocabulary as ProviderId in @foundry/contracts.

create extension if not exists "pgcrypto";

-- ── users ───────────────────────────────────────────────────────────────────

create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);

alter table public.users enable row level security;

drop policy if exists users_self_read on public.users;
create policy users_self_read on public.users
    for select using (auth.uid() = id);

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
    for update using (auth.uid() = id);

-- ── provider_credentials ────────────────────────────────────────────────────

create table if not exists public.provider_credentials (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    provider_type text not null,
    display_name text not null,
    encrypted_secret text not null,
    secret_fingerprint text not null,
    masked_preview text not null,
    config_json jsonb not null default '{}'::jsonb,
    available_models_json jsonb not null default '[]'::jsonb,
    validation_status text not null default 'pending'
        check (validation_status in ('pending', 'active', 'invalid', 'revoked')),
    last_validated_at timestamptz,
    last_validation_reason text,
    last_used_at timestamptz,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create index if not exists provider_credentials_user_idx
    on public.provider_credentials (user_id) where deleted_at is null;

create unique index if not exists provider_credentials_default_uidx
    on public.provider_credentials (user_id)
    where is_default and deleted_at is null;

create unique index if not exists provider_credentials_fingerprint_uidx
    on public.provider_credentials (user_id, provider_type, secret_fingerprint)
    where deleted_at is null;

alter table public.provider_credentials enable row level security;

drop policy if exists pc_owner_select on public.provider_credentials;
create policy pc_owner_select on public.provider_credentials
    for select using (auth.uid() = user_id);

drop policy if exists pc_owner_insert on public.provider_credentials;
create policy pc_owner_insert on public.provider_credentials
    for insert with check (auth.uid() = user_id);

drop policy if exists pc_owner_update on public.provider_credentials;
create policy pc_owner_update on public.provider_credentials
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists pc_owner_delete on public.provider_credentials;
create policy pc_owner_delete on public.provider_credentials
    for delete using (auth.uid() = user_id);

-- ── audit_events ────────────────────────────────────────────────────────────

create table if not exists public.audit_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    event_type text not null,
    target_type text not null,
    target_id uuid not null,
    provider_type text,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists audit_events_user_idx
    on public.audit_events (user_id, created_at desc);

create index if not exists audit_events_target_idx
    on public.audit_events (target_id);

alter table public.audit_events enable row level security;

-- Audit events are read-only for the owning user. Writes must come through the
-- service role only.
drop policy if exists ae_owner_select on public.audit_events;
create policy ae_owner_select on public.audit_events
    for select using (auth.uid() = user_id);
