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

  constructor(
    private readonly jobs: JobStore,
    private readonly service: VentureService,
    opts: JobOrchestratorOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.generateId = opts.generateId ?? defaultJobIdGenerator();
    this.pricingTable = opts.pricingTable ?? DEFAULT_PRICING_TABLE;
    this.scheduler = opts.scheduler ?? ((run) => { void run(); });
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
   * Cooperative cancel. Queued jobs are terminated immediately. Running jobs
   * are flagged; the handler must check `ctx.isCancelled()` at checkpoints.
   * In-flight provider calls are not aborted (Sprint 2B).
   */
  async cancel(ownerId: string, jobId: string): Promise<VentureJob | null> {
    const j = await this.jobs.getJob(ownerId, jobId);
    if (!j) return null;
    if (j.status === 'queued') {
      const at = this.now().toISOString();
      const next: VentureJob = {
        ...j,
        status: 'cancelled',
        finishedAt: at,
        executionDurationMs: 0,
      };
      await this.jobs.replaceJob(next);
      await this.emitTimeline(next, 'job_failed', `Cancelled before start: ${friendlyJobKind(j.jobKind)}`);
      return next;
    }
    if (j.status === 'running') {
      this.cancelled.add(j.jobId);
      return j;
    }
    return j;
  }

  /**
   * Internal: execute the handler. Wraps every state transition in
   * try/catch so handler errors are persisted as `failed`, never thrown
   * out of the scheduler.
   */
  private async run(jobId: string, ownerId: string): Promise<void> {
    let job = await this.jobs.getJob(ownerId, jobId);
    if (!job) return;
    const handler = this.handlers.get(job.jobKind);
    if (!handler) {
      job = await this.markFailed(job, 'no_handler', `No handler registered for ${job.jobKind}.`);
      return;
    }

    // queued → running
    const startedAt = this.now();
    job = await this.persist({
      ...job,
      status: 'running',
      startedAt: startedAt.toISOString(),
      // providerModel is pinned at start; handler may have already passed it,
      // otherwise it stays null and is filled by the first recordUsage call.
    });
    await this.emitTimeline(
      job,
      'job_started',
      `Started ${friendlyJobKind(job.jobKind)}${job.providerName ? ` via ${job.providerName}${job.providerModel ? `/${job.providerModel}` : ''}` : ''}`,
    );

    let result: JobHandlerResult;
    try {
      result = await handler(this.makeContext(job));
    } catch (err) {
      const message = sanitizeError(err);
      // Refetch so usage-driven provider/model fields populated by the handler
      // before it threw are captured on the failed row.
      const latest = (await this.jobs.getJob(ownerId, jobId)) ?? job;
      await this.markFailed(latest, 'handler_error', message);
      return;
    }

    // Pick up any provider/model fields the handler populated via recordUsage.
    job = (await this.jobs.getJob(ownerId, jobId)) ?? job;

    if (this.cancelled.has(job.jobId)) {
      this.cancelled.delete(job.jobId);
      const finishedAt = this.now();
      const duration = finishedAt.getTime() - startedAt.getTime();
      const finalised = await this.persist({
        ...job,
        status: 'cancelled',
        finishedAt: finishedAt.toISOString(),
        executionDurationMs: duration,
        estimatedCostCents: this.computeCostCents(job),
      });
      await this.emitTimeline(finalised, 'job_failed', `Cancelled: ${friendlyJobKind(job.jobKind)}`);
      return;
    }

    // Attach artifact (if produced) before marking succeeded so the timeline
    // ordering reads naturally: started → artifact attached → succeeded.
    let artifactVersion: number | null = null;
    let outputArtifactId: string | null = null;
    if (result.artifact) {
      const artifact = await this.service.attachArtifact({
        ownerId: job.ownerId,
        ventureId: job.ventureId,
        artifactKind: result.artifact.artifactKind,
        summary: result.artifact.summary,
        payload: result.artifact.payload,
      });
      artifactVersion = artifact.version;
      outputArtifactId = artifact.artifactId;
    }

    const finishedAt = this.now();
    const duration = finishedAt.getTime() - startedAt.getTime();
    const finalised = await this.persist({
      ...job,
      status: 'succeeded',
      progress: 1,
      stepLabel: result.finalStepLabel ?? job.stepLabel,
      finishedAt: finishedAt.toISOString(),
      executionDurationMs: duration,
      estimatedCostCents: this.computeCostCents(job),
      artifactVersion,
      outputArtifactId,
    });

    await this.emitTimeline(
      finalised,
      'job_succeeded',
      `Completed ${friendlyJobKind(job.jobKind)}${artifactVersion ? ` v${artifactVersion}` : ''} in ${duration}ms${finalised.estimatedCostCents != null ? ` (~$${(finalised.estimatedCostCents / 100).toFixed(2)})` : ''}`,
    );
    this.usage.delete(job.jobId);
  }

  private makeContext(initial: VentureJob): JobHandlerContext {
    return {
      job: initial,
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
    const duration = finishedAt.getTime() - startedAtMs;
    const next = await this.persist({
      ...job,
      status: 'failed',
      finishedAt: finishedAt.toISOString(),
      executionDurationMs: duration,
      estimatedCostCents: this.computeCostCents(job),
      errorCode: code,
      errorMessage: message,
    });
    await this.emitTimeline(next, 'job_failed', `Failed ${friendlyJobKind(job.jobKind)}: ${message}`);
    this.usage.delete(job.jobId);
    return next;
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
