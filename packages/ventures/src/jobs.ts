/**
 * Job orchestration for the Venture domain (Sprint 2A.6).
 *
 * Every long-running unit of work in Foundry is a VentureJob. Jobs persist
 * their full lifecycle (queued → running → succeeded|failed|cancelled) so the
 * workspace survives a process restart and so the UI never has to render a
 * mystery spinner.
 *
 * This module is store-agnostic: the JobOrchestrator takes a JobStore which
 * either runs in-memory (tests, dev) or against Supabase (demo, production).
 */
import type {
  ProviderId,
  VentureArtifact,
  VentureArtifactKind,
  VentureJob,
  VentureJobKind,
  VentureJobMetrics,
  VentureJobStatus,
  VentureTimelineEvent,
  VentureTimelineEventKind,
} from '@foundry/contracts';

import type { VentureService } from './service.js';

// ── public types ────────────────────────────────────────────────────────────

export interface EnqueueJobInput {
  ownerId: string;
  ventureId: string;
  jobKind: VentureJobKind;
  input: unknown;
  /** BYOK credential id when the job calls a model or external integration. */
  credentialId?: string | null;
  /** Optional model preference, refined to providerModel at start. */
  providerName?: ProviderId | null;
  providerModel?: string | null;
}

export interface JobProgressUpdate {
  progress?: number;
  stepLabel?: string;
}

export interface JobUsageReport {
  providerName?: ProviderId | null;
  providerModel?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  /** Optional explicit override; otherwise computed from the pricing table. */
  costCents?: number | null;
}

export interface JobHandlerContext {
  job: VentureJob;
  /**
   * Aborts when the job exceeds its hard timeout or is cancelled. Handlers that
   * make provider calls MUST forward this to the model SDK so a hung request is
   * cancelled promptly instead of running to the serverless function ceiling.
   */
  signal: AbortSignal;
  reportProgress(update: JobProgressUpdate): Promise<void>;
  recordUsage(usage: JobUsageReport): Promise<void>;
  isCancelled(): Promise<boolean>;
}

export interface JobHandlerResult {
  /** Optional artifact to attach on success. */
  artifact?: {
    artifactKind: VentureArtifactKind;
    summary: string;
    payload: unknown;
  };
  /** Optional terminal step label written into the final event. */
  finalStepLabel?: string;
}

export type JobHandler = (ctx: JobHandlerContext) => Promise<JobHandlerResult>;

/** Map a job kind to the artifact kind it produces (null = no artifact). */
export const JOB_KIND_TO_ARTIFACT_KIND: Record<VentureJobKind, VentureArtifactKind | null> = {
  'personalab.generate_personas': 'persona_set',
  'personalab.run_interview': 'interview_transcript',
  'personalab.run_focus_group': 'focus_group_transcript',
  'personalab.run_buying_committee': 'buying_committee',
  'personalab.extract_insights': 'persona_insights',
  'graphify.build': 'research_graph',
  'venturelab.recommend': 'venture_recommendation',
  'buildsquad.plan': 'buildsquad_pack',
  'github.export': 'github_repo',
};

// ── store interface ─────────────────────────────────────────────────────────

export interface ListJobsQuery {
  ownerId: string;
  ventureId?: string;
  statuses?: VentureJobStatus[];
  limit?: number;
}

export interface JobStore {
  createJob(job: VentureJob): Promise<void>;
  getJob(ownerId: string, jobId: string): Promise<VentureJob | null>;
  listJobs(q: ListJobsQuery): Promise<VentureJob[]>;
  replaceJob(job: VentureJob): Promise<void>;
}

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, VentureJob>();

  private key(ownerId: string, jobId: string): string {
    return `${ownerId}/${jobId}`;
  }

  async createJob(j: VentureJob): Promise<void> {
    this.jobs.set(this.key(j.ownerId, j.jobId), j);
  }

  async getJob(ownerId: string, jobId: string): Promise<VentureJob | null> {
    return this.jobs.get(this.key(ownerId, jobId)) ?? null;
  }

  async listJobs(q: ListJobsQuery): Promise<VentureJob[]> {
    let out = Array.from(this.jobs.values()).filter((j) => j.ownerId === q.ownerId);
    if (q.ventureId) out = out.filter((j) => j.ventureId === q.ventureId);
    if (q.statuses && q.statuses.length > 0) {
      const s = new Set(q.statuses);
      out = out.filter((j) => s.has(j.status));
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (q.limit) out = out.slice(0, q.limit);
    return out;
  }

  async replaceJob(j: VentureJob): Promise<void> {
    this.jobs.set(this.key(j.ownerId, j.jobId), j);
  }
}

// ── pricing table (consulted by the orchestrator at recordUsage) ────────────

export interface PricingEntry {
  inputCentsPer1k: number;
  outputCentsPer1k: number;
}

/**
 * Hard-coded minimal pricing table. Unknown models → `null` cost (we don't
 * silently estimate $0 — that would lie on the dashboard).
 *
 * Sprint 2B promotes this to config; for now the seam exists so callers don't
 * scatter cost math.
 */
export const DEFAULT_PRICING_TABLE: Record<string, PricingEntry> = {
  // OpenAI — public list prices, cents per 1K tokens.
  'openai:gpt-4o-mini': { inputCentsPer1k: 0.015, outputCentsPer1k: 0.06 },
  'openai:gpt-4o': { inputCentsPer1k: 0.5, outputCentsPer1k: 1.5 },
  'openai:gpt-4.1-mini': { inputCentsPer1k: 0.04, outputCentsPer1k: 0.16 },
  // Anthropic (Claude 4.x).
  'anthropic:claude-haiku-4-5-20251001': { inputCentsPer1k: 0.1, outputCentsPer1k: 0.5 },
  'anthropic:claude-haiku-4-5': { inputCentsPer1k: 0.1, outputCentsPer1k: 0.5 },
  'anthropic:claude-sonnet-4-5': { inputCentsPer1k: 0.3, outputCentsPer1k: 1.5 },
  'anthropic:claude-opus-4-1': { inputCentsPer1k: 1.5, outputCentsPer1k: 7.5 },
  // Gemini.
  'gemini:gemini-2.0-flash': { inputCentsPer1k: 0.0125, outputCentsPer1k: 0.05 },
  // Azure OpenAI (priced same as OpenAI for the demo).
  'azure_openai:gpt-4o-mini': { inputCentsPer1k: 0.015, outputCentsPer1k: 0.06 },
  'azure_openai:gpt-4.1-mini': { inputCentsPer1k: 0.04, outputCentsPer1k: 0.16 },
};

export function estimateCostCents(
  providerName: ProviderId | null | undefined,
  providerModel: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
  table: Record<string, PricingEntry> = DEFAULT_PRICING_TABLE,
): number | null {
  if (!providerName || !providerModel) return null;
  const entry = table[`${providerName}:${providerModel}`];
  if (!entry) return null;
  const cents =
    (promptTokens / 1000) * entry.inputCentsPer1k +
    (completionTokens / 1000) * entry.outputCentsPer1k;
  // Round to a stable integer of cents × 100 (i.e. hundredths of a cent) so
  // pennies of demo spend remain visible.
  return Math.round(cents * 100) / 100;
}

// ── orchestrator ────────────────────────────────────────────────────────────

/** Statuses that represent a completed lifecycle — never overwritten once set. */
const TERMINAL_STATUSES: ReadonlySet<VentureJobStatus> = new Set([
  'succeeded',
  'failed',
  'cancelled',
]);
/** Statuses that represent work that has not yet reached a terminal state. */
const ACTIVE_STATUSES: readonly VentureJobStatus[] = ['queued', 'running'];

/**
 * Hard per-job execution timeout. Sits *below* the platform function ceiling
 * (Vercel Hobby + Fluid Compute = 300s) so we abort the provider call and record
 * a terminal state ourselves before the platform kills the invocation and orphans
 * the row. ~60s of headroom is left for the terminal write + poll observation.
 */
const DEFAULT_JOB_TIMEOUT_MS = 240_000;
/**
 * Age past which a still-active job is considered orphaned (its invocation was
 * terminated before it could finalise) and is reconciled to `failed`. Exceeds the
 * platform ceiling so a legitimately-running job is never reconciled prematurely.
 */
const DEFAULT_STALE_JOB_MS = 330_000;

/**
 * Thrown when a caller tries to start a job while an equivalent one is genuinely
 * still active for the same venture, letting the API layer answer 409 instead of
 * spawning duplicate concurrent runs.
 */
export class DuplicateActiveJobError extends Error {
  constructor(
    public readonly jobKind: VentureJobKind,
    public readonly existingJobId: string,
  ) {
    super(`A ${friendlyJobKind(jobKind)} job is already running for this venture.`);
    this.name = 'DuplicateActiveJobError';
  }
}

/** Internal sentinel: the hard timeout / cancellation aborted the handler race. */
class JobAbortedError extends Error {
  constructor() {
    super('Job aborted before the handler resolved.');
    this.name = 'JobAbortedError';
  }
}

export interface JobOrchestratorOptions {
  now?: () => Date;
  generateId?: (prefix: string) => string;
  pricingTable?: Record<string, PricingEntry>;
  /**
   * Schedules the handler. Default: run in-process via Promise.resolve so the
   * fire-and-forget pattern works for the demo. Tests typically pass a synchronous
   * scheduler so they can await the handler.
   */
  scheduler?: (run: () => Promise<void>) => void;
  /** Hard per-job execution timeout in ms (default 240000, below the 300s ceiling). */
  jobTimeoutMs?: number;
  /** Age in ms past which an active job is reconciled to failed (default 330000). */
  staleJobMs?: number;
}

export class JobOrchestrator {
  private readonly now: () => Date;
  private readonly generateId: (prefix: string) => string;
  private readonly pricingTable: Record<string, PricingEntry>;
  private readonly scheduler: (run: () => Promise<void>) => void;

  /** Handlers registered by callers — one per job kind. */
  private readonly handlers = new Map<VentureJobKind, JobHandler>();

  /** Per-job usage accumulators. */
  private readonly usage = new Map<string, { input: number; output: number }>();

  /** Per-job cooperative cancellation flag. */
  private readonly cancelled = new Set<string>();

  /** Live AbortControllers for in-process handlers, keyed by jobId (for cancel/timeout). */
  private readonly controllers = new Map<string, AbortController>();

  private readonly jobTimeoutMs: number;
  private readonly staleJobMs: number;

  constructor(
    private readonly jobs: JobStore,
    private readonly service: VentureService,
    opts: JobOrchestratorOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.generateId = opts.generateId ?? defaultJobIdGenerator();
    this.pricingTable = opts.pricingTable ?? DEFAULT_PRICING_TABLE;
    this.scheduler = opts.scheduler ?? ((run) => { void run(); });
    this.jobTimeoutMs = opts.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;
    this.staleJobMs = opts.staleJobMs ?? DEFAULT_STALE_JOB_MS;
  }

  register(kind: VentureJobKind, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  /**
   * Enqueue a job and schedule its handler. Returns the freshly persisted job
   * (status='queued'). Callers should poll `getJob` / listen on the timeline.
   */
  async enqueue(input: EnqueueJobInput): Promise<VentureJob> {
    const at = this.now().toISOString();
    const job: VentureJob = {
      kind: 'VentureJob',
      jobId: this.generateId('job'),
      ventureId: input.ventureId,
      ownerId: input.ownerId,
      jobKind: input.jobKind,
      status: 'queued',
      progress: 0,
      stepLabel: null,
      input: input.input,
      outputArtifactId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: at,
      startedAt: null,
      finishedAt: null,
      executionDurationMs: null,
      providerName: input.providerName ?? null,
      providerModel: input.providerModel ?? null,
      estimatedCostCents: null,
      artifactKind: JOB_KIND_TO_ARTIFACT_KIND[input.jobKind],
      artifactVersion: null,
      credentialId: input.credentialId ?? null,
    };
    await this.jobs.createJob(job);
    this.usage.set(job.jobId, { input: 0, output: 0 });

    // Schedule. Default scheduler is fire-and-forget in this process.
    this.scheduler(() => this.run(job.jobId, job.ownerId));
    return job;
  }

  async getJob(ownerId: string, jobId: string): Promise<VentureJob | null> {
    return this.jobs.getJob(ownerId, jobId);
  }

  async listJobs(q: ListJobsQuery): Promise<VentureJob[]> {
    return this.jobs.listJobs(q);
  }

  /**
   * Cooperative + durable cancel. Signals any in-process handler to abort its
   * provider call, then persists a terminal `cancelled` state immediately so the
   * cancellation survives even when the original invocation is already gone.
   * Idempotent: a job that is already terminal is returned unchanged.
   */
  async cancel(ownerId: string, jobId: string): Promise<VentureJob | null> {
    const j = await this.jobs.getJob(ownerId, jobId);
    if (!j) return null;
    if (TERMINAL_STATUSES.has(j.status)) return j;

    this.cancelled.add(jobId);
    this.controllers.get(jobId)?.abort();

    const finishedAt = this.now();
    const wasQueued = j.status === 'queued';
    const startedAtMs = j.startedAt ? new Date(j.startedAt).getTime() : finishedAt.getTime();
    const { job: next, applied } = await this.finalize(j, {
      status: 'cancelled',
      finishedAt: finishedAt.toISOString(),
      executionDurationMs: wasQueued ? 0 : Math.max(0, finishedAt.getTime() - startedAtMs),
      estimatedCostCents: this.computeCostCents(j),
    });
    if (applied) {
      await this.emitTimeline(
        next,
        'job_failed',
        wasQueued
          ? `Cancelled before start: ${friendlyJobKind(j.jobKind)}`
          : `Cancelled: ${friendlyJobKind(j.jobKind)}`,
      );
    }
    this.usage.delete(jobId);
    return next;
  }

  /**
   * Internal: execute the handler under a hard timeout. Every path is wrapped so
   * the job ALWAYS reaches a terminal state — handler errors, provider hangs, and
   * even failures inside our own persistence are converted to a terminal row so a
   * job can never be left RUNNING forever.
   */
  private async run(jobId: string, ownerId: string): Promise<void> {
    let job = await this.jobs.getJob(ownerId, jobId);
    if (!job) return;
    // First-terminal-wins at the very start: a cancel (or reconcile) can land
    // between enqueue and the scheduler invoking us. Never resurrect that row to
    // `running` — and never spend a provider call on an already-cancelled job.
    if (TERMINAL_STATUSES.has(job.status)) {
      this.usage.delete(jobId);
      this.controllers.delete(jobId);
      return;
    }
    const handler = this.handlers.get(job.jobKind);
    if (!handler) {
      await this.markFailed(job, 'no_handler', `No handler registered for ${job.jobKind}.`);
      return;
    }

    // queued → running
    const startedAt = this.now();
    job = await this.persist({
      ...job,
      status: 'running',
      startedAt: startedAt.toISOString(),
    });
    await this.emitTimeline(
      job,
      'job_started',
      `Started ${friendlyJobKind(job.jobKind)}${job.providerName ? ` via ${job.providerName}${job.providerModel ? `/${job.providerModel}` : ''}` : ''}`,
    );

    // Hard timeout: abort the provider call (and lose the handler race) if it runs
    // past the platform-safe deadline, so we record a terminal state before the
    // serverless function is killed.
    const controller = new AbortController();
    this.controllers.set(jobId, controller);
    const timer = setTimeout(() => controller.abort(), this.jobTimeoutMs);
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      (timer as { unref: () => void }).unref();
    }

    try {
      const handlerPromise = handler(this.makeContext(job, controller.signal));
      // Swallow a late rejection from an abandoned (timed-out) handler so it can
      // never surface as an unhandled rejection after we've moved on.
      void handlerPromise.catch(() => {});
      const result = await this.raceAbort(handlerPromise, controller.signal);

      // First-terminal-wins: a concurrent cancel or stale-reconcile may have
      // finalised the row while the handler ran. Never resurrect it, and never
      // present an artifact for a job the user cancelled.
      const current = (await this.jobs.getJob(ownerId, jobId)) ?? job;
      if (TERMINAL_STATUSES.has(current.status)) {
        this.usage.delete(jobId);
        return;
      }
      if (this.cancelled.has(jobId)) {
        await this.finalizeCancelled(current, startedAt);
        return;
      }

      // Attach artifact (if produced) before marking succeeded so the timeline
      // ordering reads naturally: started → artifact attached → succeeded.
      let artifactVersion: number | null = null;
      let outputArtifactId: string | null = null;
      if (result.artifact) {
        const artifact = await this.service.attachArtifact({
          ownerId: current.ownerId,
          ventureId: current.ventureId,
          artifactKind: result.artifact.artifactKind,
          summary: result.artifact.summary,
          payload: result.artifact.payload,
        });
        artifactVersion = artifact.version;
        outputArtifactId = artifact.artifactId;
      }

      const finishedAt = this.now();
      const duration = finishedAt.getTime() - startedAt.getTime();
      const { job: finalised, applied } = await this.finalize(current, {
        status: 'succeeded',
        progress: 1,
        stepLabel: result.finalStepLabel ?? current.stepLabel,
        finishedAt: finishedAt.toISOString(),
        executionDurationMs: duration,
        estimatedCostCents: this.computeCostCents(current),
        artifactVersion,
        outputArtifactId,
      });
      if (applied) {
        await this.emitTimeline(
          finalised,
          'job_succeeded',
          `Completed ${friendlyJobKind(finalised.jobKind)}${artifactVersion ? ` v${artifactVersion}` : ''} in ${duration}ms${finalised.estimatedCostCents != null ? ` (~$${(finalised.estimatedCostCents / 100).toFixed(2)})` : ''}`,
        );
      }
      this.usage.delete(jobId);
    } catch (err) {
      const latest = (await this.jobs.getJob(ownerId, jobId)) ?? job;
      if (TERMINAL_STATUSES.has(latest.status)) {
        this.usage.delete(jobId);
      } else if (this.cancelled.has(jobId)) {
        await this.finalizeCancelled(latest, startedAt);
      } else if (err instanceof JobAbortedError || controller.signal.aborted) {
        await this.markFailed(
          latest,
          'timed_out',
          'The model did not respond within the allowed time and the request was aborted. Nothing was saved — you can retry.',
        );
      } else {
        await this.markFailed(latest, 'handler_error', sanitizeError(err));
      }
    } finally {
      clearTimeout(timer);
      this.controllers.delete(jobId);
      // Terminal guarantee: if any path above failed to persist a terminal state
      // (e.g. the store write itself threw), force one now.
      const check = await this.jobs.getJob(ownerId, jobId);
      if (check && !TERMINAL_STATUSES.has(check.status)) {
        await this.markFailed(check, 'incomplete', 'Job ended without reaching a terminal state.');
      }
    }
  }

  private makeContext(initial: VentureJob, signal: AbortSignal): JobHandlerContext {
    return {
      job: initial,
      signal,
      reportProgress: async (update) => {
        const j = await this.jobs.getJob(initial.ownerId, initial.jobId);
        if (!j) return;
        const next: VentureJob = {
          ...j,
          progress: update.progress != null ? clamp01(update.progress) : j.progress,
          stepLabel: update.stepLabel != null ? update.stepLabel : j.stepLabel,
        };
        await this.jobs.replaceJob(next);
        await this.emitTimeline(next, 'job_progress', next.stepLabel ?? `Progress ${(next.progress * 100).toFixed(0)}%`);
      },
      recordUsage: async (usage) => {
        const acc = this.usage.get(initial.jobId) ?? { input: 0, output: 0 };
        acc.input += usage.promptTokens ?? 0;
        acc.output += usage.completionTokens ?? 0;
        this.usage.set(initial.jobId, acc);
        // Pin provider name + model on first call if the enqueuer didn't.
        const j = await this.jobs.getJob(initial.ownerId, initial.jobId);
        if (!j) return;
        const next: VentureJob = {
          ...j,
          providerName: j.providerName ?? usage.providerName ?? null,
          providerModel: j.providerModel ?? usage.providerModel ?? null,
        };
        await this.jobs.replaceJob(next);
      },
      isCancelled: async () => this.cancelled.has(initial.jobId),
    };
  }

  private async markFailed(
    job: VentureJob,
    code: string,
    message: string,
  ): Promise<VentureJob> {
    const finishedAt = this.now();
    const startedAtMs = job.startedAt ? new Date(job.startedAt).getTime() : finishedAt.getTime();
    const duration = Math.max(0, finishedAt.getTime() - startedAtMs);
    const { job: next, applied } = await this.finalize(job, {
      status: 'failed',
      finishedAt: finishedAt.toISOString(),
      executionDurationMs: duration,
      estimatedCostCents: this.computeCostCents(job),
      errorCode: code,
      errorMessage: message,
    });
    if (applied) {
      await this.emitTimeline(next, 'job_failed', `Failed ${friendlyJobKind(job.jobKind)}: ${message}`);
    }
    this.usage.delete(job.jobId);
    return next;
  }

  /**
   * The single writer for terminal states. Re-reads the row and refuses to
   * overwrite an already-terminal job (first-terminal-wins), which prevents a
   * late handler from resurrecting a cancelled/timed-out job or presenting a
   * partial artifact as complete. Returns whether the write was actually applied
   * so callers emit a timeline event exactly once.
   */
  private async finalize(
    job: VentureJob,
    patch: Partial<VentureJob>,
  ): Promise<{ job: VentureJob; applied: boolean }> {
    const current = (await this.jobs.getJob(job.ownerId, job.jobId)) ?? job;
    if (TERMINAL_STATUSES.has(current.status)) {
      return { job: current, applied: false };
    }
    const next: VentureJob = { ...current, ...patch };
    await this.jobs.replaceJob(next);
    return { job: next, applied: true };
  }

  private async finalizeCancelled(job: VentureJob, startedAt: Date): Promise<void> {
    const finishedAt = this.now();
    const duration = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const { job: next, applied } = await this.finalize(job, {
      status: 'cancelled',
      finishedAt: finishedAt.toISOString(),
      executionDurationMs: duration,
      estimatedCostCents: this.computeCostCents(job),
    });
    if (applied) {
      await this.emitTimeline(next, 'job_failed', `Cancelled: ${friendlyJobKind(job.jobKind)}`);
    }
    this.cancelled.delete(job.jobId);
    this.usage.delete(job.jobId);
  }

  /** Race the handler against its abort signal; rejects with JobAbortedError on abort. */
  private raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(new JobAbortedError());
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new JobAbortedError());
      signal.addEventListener('abort', onAbort, { once: true });
      work.then(
        (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
        (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
      );
    });
  }

  /**
   * If a job is active but older than the stale threshold, reconcile it to
   * `failed(stale_timeout)`. Safe because nothing legitimate runs past the
   * platform ceiling; returns the (possibly updated) job.
   */
  private async reconcileOne(job: VentureJob): Promise<VentureJob> {
    if (!ACTIVE_STATUSES.includes(job.status)) return job;
    const anchorIso = job.startedAt ?? job.createdAt;
    const ageMs = this.now().getTime() - new Date(anchorIso).getTime();
    if (ageMs < this.staleJobMs) return job;
    const finishedAt = this.now();
    const { job: next, applied } = await this.finalize(job, {
      status: 'failed',
      finishedAt: finishedAt.toISOString(),
      executionDurationMs: job.startedAt
        ? Math.max(0, finishedAt.getTime() - new Date(job.startedAt).getTime())
        : 0,
      estimatedCostCents: this.computeCostCents(job),
      errorCode: 'stale_timeout',
      errorMessage:
        'This job exceeded the platform execution window and was reconciled as failed. Nothing was saved — you can retry.',
    });
    if (applied) {
      await this.emitTimeline(next, 'job_failed', `Reconciled stale ${friendlyJobKind(job.jobKind)} as failed`);
      this.usage.delete(job.jobId);
      this.controllers.delete(job.jobId);
    }
    return next;
  }

  /** Read a job, reconciling it first if it is an orphaned (stale) active row. */
  async getJobReconciled(ownerId: string, jobId: string): Promise<VentureJob | null> {
    const job = await this.jobs.getJob(ownerId, jobId);
    if (!job) return null;
    return this.reconcileOne(job);
  }

  /** Sweep active jobs for an owner (optionally one venture); fail any that are orphaned. */
  async reconcileStale(q: { ownerId: string; ventureId?: string }): Promise<VentureJob[]> {
    const active = await this.jobs.listJobs({
      ownerId: q.ownerId,
      ...(q.ventureId ? { ventureId: q.ventureId } : {}),
      statuses: [...ACTIVE_STATUSES],
    });
    const reconciled: VentureJob[] = [];
    for (const job of active) {
      const before = job.status;
      const next = await this.reconcileOne(job);
      if (before !== next.status) reconciled.push(next);
    }
    return reconciled;
  }

  /**
   * Find a genuinely-active job of the given kind for a venture, after first
   * reconciling any stale rows. Used to prevent duplicate concurrent runs.
   */
  async findActiveJob(
    ownerId: string,
    ventureId: string,
    jobKind: VentureJobKind,
  ): Promise<VentureJob | null> {
    await this.reconcileStale({ ownerId, ventureId });
    const active = await this.jobs.listJobs({
      ownerId,
      ventureId,
      statuses: [...ACTIVE_STATUSES],
    });
    return active.find((j) => j.jobKind === jobKind) ?? null;
  }

  private async persist(j: VentureJob): Promise<VentureJob> {
    await this.jobs.replaceJob(j);
    return j;
  }

  private computeCostCents(job: VentureJob): number | null {
    const acc = this.usage.get(job.jobId);
    if (!acc) return job.estimatedCostCents;
    const latest = { providerName: job.providerName, providerModel: job.providerModel };
    return estimateCostCents(latest.providerName, latest.providerModel, acc.input, acc.output, this.pricingTable);
  }

  private async emitTimeline(
    job: VentureJob,
    eventKind: VentureTimelineEventKind,
    label: string,
  ): Promise<void> {
    const metrics: VentureJobMetrics = {
      executionDurationMs: job.executionDurationMs,
      providerName: job.providerName,
      providerModel: job.providerModel,
      estimatedCostCents: job.estimatedCostCents,
      artifactKind: job.artifactKind,
      artifactVersion: job.artifactVersion,
    };
    const event: VentureTimelineEvent = {
      kind: 'VentureTimelineEvent',
      eventId: this.generateId('evt'),
      ventureId: job.ventureId,
      ownerId: job.ownerId,
      eventKind,
      label,
      at: this.now().toISOString(),
      jobId: job.jobId,
      ...(job.outputArtifactId ? { artifactId: job.outputArtifactId } : {}),
      metrics,
    };
    // The service holds the only writer to the event log so RLS + ordering
    // stay consistent with non-job events.
    await this.service.appendRawEvent(event);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

export function friendlyJobKind(kind: VentureJobKind): string {
  switch (kind) {
    case 'personalab.generate_personas': return 'Generate personas';
    case 'personalab.run_interview':     return 'Run interview';
    case 'personalab.run_focus_group':   return 'Run focus group';
    case 'personalab.run_buying_committee': return 'Run buying committee';
    case 'personalab.extract_insights':  return 'Extract persona insights';
    case 'graphify.build':               return 'Build research graph';
    case 'venturelab.recommend':         return 'Generate recommendation';
    case 'buildsquad.plan':              return 'Generate BuildSquad pack';
    case 'github.export':                return 'Export to GitHub';
    default:                              return kind;
  }
}

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***')
    .replace(/gh[pousr]_[A-Za-z0-9_]{16,}/g, 'ghp_***')
    .slice(0, 500);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function defaultJobIdGenerator(): (prefix: string) => string {
  let counter = 0;
  return (prefix) => {
    counter += 1;
    const t = Date.now().toString(36);
    const c = counter.toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${t}_${c}_${r}`;
  };
}

// `_` prefix used so a future re-export through index.ts is intentional.
export type { VentureArtifact };
