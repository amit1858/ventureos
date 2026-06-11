/**
 * Supabase-backed implementations of VentureStore and JobStore (Sprint 2A.6).
 *
 * SERVER-ONLY. Construct with a service-role SupabaseClient. The service-role
 * key bypasses RLS, so this file is the trust boundary: every method filters
 * by `owner_id` explicitly. RLS in the migration is the floor (defence in
 * depth); these filters are the ceiling.
 *
 * The package declares @supabase/supabase-js as an OPTIONAL peer dependency.
 * Consumers that only use the in-memory store don't need it installed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ProviderId,
  Venture,
  VentureArtifact,
  VentureArtifactKind,
  VentureJob,
  VentureJobKind,
  VentureJobStatus,
  VentureStatus,
  VentureTimelineEvent,
  VentureTimelineEventKind,
  VentureJobMetrics,
} from '@ventureos/contracts';

import type { JobStore, ListJobsQuery } from './jobs.js';
import type { ListVenturesQuery, VentureStore } from './types.js';

// ── DB row shapes ───────────────────────────────────────────────────────────

interface DbVenture {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  problem_statement: string;
  target_market: string;
  customer_type: string;
  region: string;
  business_size: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DbArtifact {
  id: string;
  venture_id: string;
  owner_id: string;
  artifact_kind: string;
  version: number;
  summary: string;
  payload: unknown;
  created_at: string;
}

interface DbEvent {
  id: string;
  venture_id: string;
  owner_id: string;
  event_kind: string;
  label: string;
  artifact_id: string | null;
  job_id: string | null;
  metrics: VentureJobMetrics | null;
  at: string;
}

interface DbJob {
  id: string;
  venture_id: string;
  owner_id: string;
  job_kind: string;
  status: string;
  progress: number | string;
  step_label: string | null;
  input: unknown;
  output_artifact_id: string | null;
  error_code: string | null;
  error_message: string | null;
  execution_duration_ms: number | null;
  provider_name: string | null;
  provider_model: string | null;
  estimated_cost_cents: number | string | null;
  artifact_kind: string | null;
  artifact_version: number | null;
  credential_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const T_VENTURES = 'ventures';
const T_ARTIFACTS = 'venture_artifacts';
const T_EVENTS = 'venture_timeline_events';
const T_JOBS = 'venture_jobs';

// ── SupabaseVentureStore ────────────────────────────────────────────────────

export class SupabaseVentureStore implements VentureStore {
  constructor(private readonly client: SupabaseClient) {}

  async createVenture(v: Venture): Promise<void> {
    const { error } = await this.client.from(T_VENTURES).insert(ventureToDb(v));
    if (error) throw new Error(`SupabaseVentureStore.createVenture: ${error.message}`);
  }

  async getVenture(ownerId: string, ventureId: string): Promise<Venture | null> {
    const { data, error } = await this.client
      .from(T_VENTURES)
      .select('*')
      .eq('owner_id', ownerId)
      .eq('id', ventureId)
      .maybeSingle();
    if (error) throw new Error(`SupabaseVentureStore.getVenture: ${error.message}`);
    return data ? ventureFromDb(data as DbVenture) : null;
  }

  async listVentures(q: ListVenturesQuery): Promise<Venture[]> {
    let qry = this.client.from(T_VENTURES).select('*').eq('owner_id', q.ownerId);
    if (q.status) qry = qry.eq('status', q.status);
    if (q.search) {
      const s = q.search.replace(/[%_]/g, '\\$&');
      qry = qry.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const sort = q.sort ?? 'updated_desc';
    if (sort === 'created_desc') qry = qry.order('created_at', { ascending: false });
    else if (sort === 'title_asc') qry = qry.order('title', { ascending: true });
    else qry = qry.order('updated_at', { ascending: false });

    const { data, error } = await qry;
    if (error) throw new Error(`SupabaseVentureStore.listVentures: ${error.message}`);
    return (data as DbVenture[] | null ?? []).map(ventureFromDb);
  }

  async replaceVenture(v: Venture): Promise<void> {
    const { error } = await this.client
      .from(T_VENTURES)
      .update(ventureToDb(v))
      .eq('owner_id', v.ownerId)
      .eq('id', v.ventureId);
    if (error) throw new Error(`SupabaseVentureStore.replaceVenture: ${error.message}`);
  }

  async appendArtifact(a: VentureArtifact): Promise<void> {
    const { error } = await this.client.from(T_ARTIFACTS).insert(artifactToDb(a));
    if (error) throw new Error(`SupabaseVentureStore.appendArtifact: ${error.message}`);
  }

  async listArtifacts(ownerId: string, ventureId: string): Promise<VentureArtifact[]> {
    const { data, error } = await this.client
      .from(T_ARTIFACTS)
      .select('*')
      .eq('owner_id', ownerId)
      .eq('venture_id', ventureId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`SupabaseVentureStore.listArtifacts: ${error.message}`);
    return (data as DbArtifact[] | null ?? []).map(artifactFromDb);
  }

  async latestArtifactByKind(
    ownerId: string,
    ventureId: string,
    kind: VentureArtifactKind,
  ): Promise<VentureArtifact | null> {
    const { data, error } = await this.client
      .from(T_ARTIFACTS)
      .select('*')
      .eq('owner_id', ownerId)
      .eq('venture_id', ventureId)
      .eq('artifact_kind', kind)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`SupabaseVentureStore.latestArtifactByKind: ${error.message}`);
    return data ? artifactFromDb(data as DbArtifact) : null;
  }

  async appendEvent(e: VentureTimelineEvent): Promise<void> {
    const { error } = await this.client.from(T_EVENTS).insert(eventToDb(e));
    if (error) throw new Error(`SupabaseVentureStore.appendEvent: ${error.message}`);
  }

  async listEvents(ownerId: string, ventureId: string): Promise<VentureTimelineEvent[]> {
    const { data, error } = await this.client
      .from(T_EVENTS)
      .select('*')
      .eq('owner_id', ownerId)
      .eq('venture_id', ventureId)
      .order('at', { ascending: true });
    if (error) throw new Error(`SupabaseVentureStore.listEvents: ${error.message}`);
    return (data as DbEvent[] | null ?? []).map(eventFromDb);
  }
}

// ── SupabaseJobStore ────────────────────────────────────────────────────────

export class SupabaseJobStore implements JobStore {
  constructor(private readonly client: SupabaseClient) {}

  async createJob(j: VentureJob): Promise<void> {
    const { error } = await this.client.from(T_JOBS).insert(jobToDb(j));
    if (error) throw new Error(`SupabaseJobStore.createJob: ${error.message}`);
  }

  async getJob(ownerId: string, jobId: string): Promise<VentureJob | null> {
    const { data, error } = await this.client
      .from(T_JOBS)
      .select('*')
      .eq('owner_id', ownerId)
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw new Error(`SupabaseJobStore.getJob: ${error.message}`);
    return data ? jobFromDb(data as DbJob) : null;
  }

  async listJobs(q: ListJobsQuery): Promise<VentureJob[]> {
    let qry = this.client.from(T_JOBS).select('*').eq('owner_id', q.ownerId);
    if (q.ventureId) qry = qry.eq('venture_id', q.ventureId);
    if (q.statuses && q.statuses.length > 0) qry = qry.in('status', q.statuses);
    qry = qry.order('created_at', { ascending: false });
    if (q.limit) qry = qry.limit(q.limit);
    const { data, error } = await qry;
    if (error) throw new Error(`SupabaseJobStore.listJobs: ${error.message}`);
    return (data as DbJob[] | null ?? []).map(jobFromDb);
  }

  async replaceJob(j: VentureJob): Promise<void> {
    const { error } = await this.client
      .from(T_JOBS)
      .update(jobToDb(j))
      .eq('owner_id', j.ownerId)
      .eq('id', j.jobId);
    if (error) throw new Error(`SupabaseJobStore.replaceJob: ${error.message}`);
  }
}

// ── row converters ──────────────────────────────────────────────────────────

function ventureToDb(v: Venture): DbVenture {
  return {
    id: v.ventureId,
    owner_id: v.ownerId,
    title: v.title,
    description: v.description,
    problem_statement: v.problemStatement,
    target_market: v.targetMarket,
    customer_type: v.customerType,
    region: v.region,
    business_size: v.businessSize,
    status: v.status,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  };
}

function ventureFromDb(r: DbVenture): Venture {
  return {
    kind: 'Venture',
    ventureId: r.id,
    ownerId: r.owner_id,
    title: r.title,
    description: r.description,
    problemStatement: r.problem_statement,
    targetMarket: r.target_market,
    customerType: r.customer_type,
    region: r.region,
    businessSize: r.business_size,
    status: r.status as VentureStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function artifactToDb(a: VentureArtifact): DbArtifact {
  return {
    id: a.artifactId,
    venture_id: a.ventureId,
    owner_id: a.ownerId,
    artifact_kind: a.artifactKind,
    version: a.version,
    summary: a.summary,
    payload: a.payload,
    created_at: a.createdAt,
  };
}

function artifactFromDb(r: DbArtifact): VentureArtifact {
  return {
    kind: 'VentureArtifact',
    artifactId: r.id,
    ventureId: r.venture_id,
    ownerId: r.owner_id,
    artifactKind: r.artifact_kind as VentureArtifactKind,
    version: r.version,
    summary: r.summary,
    payload: r.payload,
    createdAt: r.created_at,
  };
}

function eventToDb(e: VentureTimelineEvent): DbEvent {
  return {
    id: e.eventId,
    venture_id: e.ventureId,
    owner_id: e.ownerId,
    event_kind: e.eventKind,
    label: e.label,
    artifact_id: e.artifactId ?? null,
    job_id: e.jobId ?? null,
    metrics: e.metrics ?? null,
    at: e.at,
  };
}

function eventFromDb(r: DbEvent): VentureTimelineEvent {
  return {
    kind: 'VentureTimelineEvent',
    eventId: r.id,
    ventureId: r.venture_id,
    ownerId: r.owner_id,
    eventKind: r.event_kind as VentureTimelineEventKind,
    label: r.label,
    at: r.at,
    ...(r.artifact_id ? { artifactId: r.artifact_id } : {}),
    ...(r.job_id ? { jobId: r.job_id } : {}),
    ...(r.metrics ? { metrics: r.metrics } : {}),
  };
}

function jobToDb(j: VentureJob): DbJob {
  return {
    id: j.jobId,
    venture_id: j.ventureId,
    owner_id: j.ownerId,
    job_kind: j.jobKind,
    status: j.status,
    progress: j.progress,
    step_label: j.stepLabel,
    input: j.input,
    output_artifact_id: j.outputArtifactId,
    error_code: j.errorCode,
    error_message: j.errorMessage,
    execution_duration_ms: j.executionDurationMs,
    provider_name: j.providerName,
    provider_model: j.providerModel,
    estimated_cost_cents: j.estimatedCostCents,
    artifact_kind: j.artifactKind,
    artifact_version: j.artifactVersion,
    credential_id: j.credentialId,
    created_at: j.createdAt,
    started_at: j.startedAt,
    finished_at: j.finishedAt,
  };
}

function jobFromDb(r: DbJob): VentureJob {
  return {
    kind: 'VentureJob',
    jobId: r.id,
    ventureId: r.venture_id,
    ownerId: r.owner_id,
    jobKind: r.job_kind as VentureJobKind,
    status: r.status as VentureJobStatus,
    progress: typeof r.progress === 'string' ? parseFloat(r.progress) : r.progress,
    stepLabel: r.step_label,
    input: r.input,
    outputArtifactId: r.output_artifact_id,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    executionDurationMs: r.execution_duration_ms,
    providerName: r.provider_name as ProviderId | null,
    providerModel: r.provider_model,
    estimatedCostCents:
      r.estimated_cost_cents == null
        ? null
        : typeof r.estimated_cost_cents === 'string'
          ? parseFloat(r.estimated_cost_cents)
          : r.estimated_cost_cents,
    artifactKind: (r.artifact_kind as VentureArtifactKind | null) ?? null,
    artifactVersion: r.artifact_version,
    credentialId: r.credential_id,
  };
}
