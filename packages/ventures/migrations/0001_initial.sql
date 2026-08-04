-- Foundry Sprint 2A.6 — Venture domain persistence.
--
-- Mirrors the credentials package pattern: jsonb payloads, RLS keyed on
-- owner_id = auth.uid(), service-role-bypass writes done by the Node service
-- which itself filters by owner_id on every call.
--
-- jsonb design call: every artifact payload (personas, transcripts,
-- recommendations, packs, evaluation reports, github repo metadata) lives in
-- a single `payload jsonb` column. TS contracts type-narrow on artifact_kind;
-- the DB stays kind-agnostic so adding new artifact kinds requires no schema
-- migration.

create extension if not exists "pgcrypto";

-- ── ventures ────────────────────────────────────────────────────────────────

create table if not exists public.ventures (
    id                text         primary key,
    owner_id          uuid         not null references public.users(id) on delete cascade,
    title             text         not null,
    description       text         not null default '',
    problem_statement text         not null default '',
    target_market     text         not null default '',
    customer_type     text         not null default '',
    region            text         not null default '',
    business_size     text         not null default '',
    status            text         not null
        check (status in ('draft','researching','validating','pivoting','approved','building','archived','rejected')),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz  not null default now()
);

create index if not exists ventures_owner_updated_idx
    on public.ventures (owner_id, updated_at desc);

create index if not exists ventures_owner_status_idx
    on public.ventures (owner_id, status);

alter table public.ventures enable row level security;

drop policy if exists ventures_owner_select on public.ventures;
create policy ventures_owner_select on public.ventures
    for select using (auth.uid() = owner_id);
drop policy if exists ventures_owner_insert on public.ventures;
create policy ventures_owner_insert on public.ventures
    for insert with check (auth.uid() = owner_id);
drop policy if exists ventures_owner_update on public.ventures;
create policy ventures_owner_update on public.ventures
    for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists ventures_owner_delete on public.ventures;
create policy ventures_owner_delete on public.ventures
    for delete using (auth.uid() = owner_id);

-- ── venture_artifacts ──────────────────────────────────────────────────────

create table if not exists public.venture_artifacts (
    id            text         primary key,
    venture_id    text         not null references public.ventures(id) on delete cascade,
    owner_id      uuid         not null references public.users(id) on delete cascade,
    artifact_kind text         not null
        check (artifact_kind in (
            'persona_set','interview_transcript','focus_group_transcript',
            'buying_committee','persona_insights','research_graph',
            'venture_recommendation','buildsquad_pack','evaluation_report','github_repo'
        )),
    version       integer      not null check (version >= 1),
    summary       text         not null default '',
    payload       jsonb        not null,
    created_at    timestamptz  not null default now(),
    unique (venture_id, artifact_kind, version)
);

create index if not exists venture_artifacts_lookup_idx
    on public.venture_artifacts (venture_id, artifact_kind, version desc);

create index if not exists venture_artifacts_owner_idx
    on public.venture_artifacts (owner_id, created_at desc);

alter table public.venture_artifacts enable row level security;

drop policy if exists va_owner_select on public.venture_artifacts;
create policy va_owner_select on public.venture_artifacts
    for select using (auth.uid() = owner_id);
drop policy if exists va_owner_insert on public.venture_artifacts;
create policy va_owner_insert on public.venture_artifacts
    for insert with check (auth.uid() = owner_id);
drop policy if exists va_owner_update on public.venture_artifacts;
create policy va_owner_update on public.venture_artifacts
    for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists va_owner_delete on public.venture_artifacts;
create policy va_owner_delete on public.venture_artifacts
    for delete using (auth.uid() = owner_id);

-- ── venture_timeline_events ────────────────────────────────────────────────

create table if not exists public.venture_timeline_events (
    id           text         primary key,
    venture_id   text         not null references public.ventures(id) on delete cascade,
    owner_id     uuid         not null references public.users(id) on delete cascade,
    event_kind   text         not null,
    label        text         not null,
    artifact_id  text         null references public.venture_artifacts(id) on delete set null,
    job_id       text         null,
    metrics      jsonb        null,
    at           timestamptz  not null default now()
);

create index if not exists venture_timeline_lookup_idx
    on public.venture_timeline_events (venture_id, at desc);

create index if not exists venture_timeline_owner_idx
    on public.venture_timeline_events (owner_id, at desc);

alter table public.venture_timeline_events enable row level security;

drop policy if exists vte_owner_select on public.venture_timeline_events;
create policy vte_owner_select on public.venture_timeline_events
    for select using (auth.uid() = owner_id);
drop policy if exists vte_owner_insert on public.venture_timeline_events;
create policy vte_owner_insert on public.venture_timeline_events
    for insert with check (auth.uid() = owner_id);
