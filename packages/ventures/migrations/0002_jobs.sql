-- Foundry Sprint 2A.6 — VentureJob persistence.
--
-- Every long-running unit of work is a row here. Status transitions and
-- observability fields (provider, model, duration, cost) are persisted as
-- first-class columns so evaluation queries don't need to crack jsonb.

create table if not exists public.venture_jobs (
    id                      text         primary key,
    venture_id              text         not null references public.ventures(id) on delete cascade,
    owner_id                uuid         not null references public.users(id) on delete cascade,

    job_kind                text         not null,
    status                  text         not null
        check (status in ('queued','running','succeeded','failed','cancelled')),

    progress                numeric(4,3) not null default 0
        check (progress >= 0 and progress <= 1),
    step_label              text         null,

    input                   jsonb        not null,
    output_artifact_id      text         null references public.venture_artifacts(id) on delete set null,

    error_code              text         null,
    error_message           text         null,

    -- Observability (denormalised onto each job for the evaluation hot path).
    execution_duration_ms   integer      null,
    provider_name           text         null,
    provider_model          text         null,
    estimated_cost_cents    numeric(10,2) null,
    artifact_kind           text         null,
    artifact_version        integer      null,
    credential_id           uuid         null,

    created_at              timestamptz  not null default now(),
    started_at              timestamptz  null,
    finished_at             timestamptz  null
);

create index if not exists venture_jobs_venture_created_idx
    on public.venture_jobs (venture_id, created_at desc);

create index if not exists venture_jobs_owner_active_idx
    on public.venture_jobs (owner_id, status)
    where status in ('queued','running');

create index if not exists venture_jobs_eval_provider_idx
    on public.venture_jobs (owner_id, provider_name, finished_at desc);

create index if not exists venture_jobs_eval_artifact_idx
    on public.venture_jobs (venture_id, artifact_kind, artifact_version);

alter table public.venture_jobs enable row level security;

drop policy if exists vj_owner_select on public.venture_jobs;
create policy vj_owner_select on public.venture_jobs
    for select using (auth.uid() = owner_id);
drop policy if exists vj_owner_insert on public.venture_jobs;
create policy vj_owner_insert on public.venture_jobs
    for insert with check (auth.uid() = owner_id);
drop policy if exists vj_owner_update on public.venture_jobs;
create policy vj_owner_update on public.venture_jobs
    for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
