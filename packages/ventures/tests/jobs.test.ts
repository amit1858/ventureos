import { describe, expect, it } from 'vitest';

import {
  InMemoryJobStore,
  InMemoryVentureStore,
  JobOrchestrator,
  VentureService,
  estimateCostCents,
  type JobHandler,
  type VentureJob,
} from '../src/index.js';

const OWNER = 'user_a';

/** Synchronous scheduler — awaits handler in-band so tests can assert end state. */
function makeOrchestrator() {
  let n = 0;
  const id = (prefix: string) => {
    n += 1;
    return `${prefix}_${n.toString().padStart(3, '0')}`;
  };
  const t0 = new Date('2026-06-01T00:00:00.000Z').getTime();
  let tick = 0;
  const now = () => {
    tick += 1;
    return new Date(t0 + tick * 1000);
  };
  const store = new InMemoryVentureStore();
  const svc = new VentureService(store, { now, generateId: id });
  const jobStore = new InMemoryJobStore();
  let pendingRun: Promise<void> | null = null;
  const orch = new JobOrchestrator(jobStore, svc, {
    now,
    generateId: id,
    scheduler: (run) => { pendingRun = run(); },
  });
  return {
    svc,
    orch,
    jobStore,
    drain: async () => { await pendingRun; pendingRun = null; },
  };
}

async function newVenture(svc: VentureService) {
  return svc.createVenture({ ownerId: OWNER, title: 'Faceless CRM' });
}

describe('JobOrchestrator — happy path', () => {
  it('runs a handler, attaches an artifact, populates all observability fields', async () => {
    const { svc, orch, drain } = makeOrchestrator();
    const v = await newVenture(svc);

    const handler: JobHandler = async (ctx) => {
      await ctx.reportProgress({ progress: 0.5, stepLabel: 'half way' });
      await ctx.recordUsage({ providerName: 'openai', providerModel: 'gpt-4o-mini', promptTokens: 1000, completionTokens: 500 });
      return {
        artifact: { artifactKind: 'persona_set', summary: '3 personas', payload: [{ id: 'p1' }] },
        finalStepLabel: 'done',
      };
    };
    orch.register('personalab.generate_personas', handler);

    const queued = await orch.enqueue({
      ownerId: OWNER, ventureId: v.ventureId,
      jobKind: 'personalab.generate_personas',
      input: { brief: 'crm' },
      credentialId: 'pc_1',
      providerName: 'openai',
    });
    expect(queued.status).toBe('queued');
    expect(queued.artifactKind).toBe('persona_set');

    await drain();

    const final = await orch.getJob(OWNER, queued.jobId);
    expect(final?.status).toBe('succeeded');
    expect(final?.progress).toBe(1);
    expect(final?.stepLabel).toBe('done');
    expect(final?.providerName).toBe('openai');
    expect(final?.providerModel).toBe('gpt-4o-mini');
    expect(final?.executionDurationMs).toBeGreaterThan(0);
    expect(final?.artifactVersion).toBe(1);
    expect(final?.outputArtifactId).toMatch(/^art_/);
    // 1000 in × 0.015 / 1k + 500 out × 0.06 / 1k = 0.015 + 0.03 = 0.045¢; rounded to 0.05 hundredths.
    expect(final?.estimatedCostCents).toBeGreaterThan(0);

    const events = await svc.listEvents(OWNER, v.ventureId);
    const eventKinds = events.map((e) => e.eventKind);
    expect(eventKinds).toContain('job_started');
    expect(eventKinds).toContain('job_progress');
    expect(eventKinds).toContain('job_succeeded');
    expect(eventKinds).toContain('persona_set_generated');
    const succeeded = events.find((e) => e.eventKind === 'job_succeeded');
    expect(succeeded?.metrics?.providerModel).toBe('gpt-4o-mini');
    expect(succeeded?.metrics?.artifactKind).toBe('persona_set');
    expect(succeeded?.metrics?.artifactVersion).toBe(1);
    expect(succeeded?.jobId).toBe(queued.jobId);
  });
});

describe('JobOrchestrator — failure path', () => {
  it('persists failure with sanitised message and emits job_failed', async () => {
    const { svc, orch, drain } = makeOrchestrator();
    const v = await newVenture(svc);

    orch.register('graphify.build', async () => {
      throw new Error('Boom: sk-AKIA-secret-leak-attempt and Bearer ghp_PRIVATE12345678');
    });

    const j = await orch.enqueue({
      ownerId: OWNER, ventureId: v.ventureId,
      jobKind: 'graphify.build', input: {},
    });
    await drain();

    const final = await orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('handler_error');
    expect(final?.errorMessage).not.toMatch(/sk-AKIA/);
    expect(final?.errorMessage).not.toMatch(/ghp_PRIVATE/);
    expect(final?.errorMessage).toMatch(/sk-\*\*\*/);

    const events = await svc.listEvents(OWNER, v.ventureId);
    expect(events.some((e) => e.eventKind === 'job_failed')).toBe(true);
  });

  it('fails with no_handler when no handler is registered for the kind', async () => {
    const { svc, orch, drain } = makeOrchestrator();
    const v = await newVenture(svc);
    const j = await orch.enqueue({
      ownerId: OWNER, ventureId: v.ventureId,
      jobKind: 'venturelab.recommend', input: {},
    });
    await drain();
    const final = await orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('no_handler');
  });
});

describe('JobOrchestrator — cancellation', () => {
  it('cancels a queued job before it runs', async () => {
    // Use a no-op scheduler so the job stays queued until we cancel.
    let n = 0;
    const id = (prefix: string) => { n += 1; return `${prefix}_${n}`; };
    const now = () => new Date('2026-06-01T00:00:00.000Z');
    const store = new InMemoryVentureStore();
    const svc = new VentureService(store, { now, generateId: id });
    const jobs = new InMemoryJobStore();
    const orch = new JobOrchestrator(jobs, svc, { now, generateId: id, scheduler: () => { /* park */ } });
    const v = await newVenture(svc);
    const j = await orch.enqueue({
      ownerId: OWNER, ventureId: v.ventureId,
      jobKind: 'github.export', input: {},
    });
    expect(j.status).toBe('queued');
    const cancelled = await orch.cancel(OWNER, j.jobId);
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.executionDurationMs).toBe(0);
    const events = await svc.listEvents(OWNER, v.ventureId);
    expect(events.some((e) => e.eventKind === 'job_failed' && e.jobId === j.jobId)).toBe(true);
  });
});

describe('JobOrchestrator — tenant isolation', () => {
  it('does not surface jobs to another owner', async () => {
    const { svc, orch, drain } = makeOrchestrator();
    const v = await newVenture(svc);
    orch.register('personalab.generate_personas', async () => ({
      artifact: { artifactKind: 'persona_set', summary: '', payload: [] },
    }));
    await orch.enqueue({
      ownerId: OWNER, ventureId: v.ventureId,
      jobKind: 'personalab.generate_personas', input: {},
    });
    await drain();
    const otherList = await orch.listJobs({ ownerId: 'user_b' });
    expect(otherList).toHaveLength(0);
  });
});

describe('estimateCostCents — pricing table', () => {
  it('returns null for unknown model (never lies about cost)', () => {
    expect(estimateCostCents('openai', 'gpt-future-9000', 1000, 1000)).toBeNull();
    expect(estimateCostCents(null, 'gpt-4o-mini', 1000, 1000)).toBeNull();
  });

  it('computes cents for a known model', () => {
    // gpt-4o-mini: 0.015 in + 0.06 out per 1K
    const cents = estimateCostCents('openai', 'gpt-4o-mini', 2000, 1000);
    expect(cents).not.toBeNull();
    // 2 × 0.015 + 1 × 0.06 = 0.09¢; allow small float tolerance.
    expect(cents!).toBeCloseTo(0.09, 2);
  });
});

describe('VentureJob shape', () => {
  it('seeds artifactKind from the job kind at enqueue', async () => {
    const { svc, orch } = makeOrchestrator();
    const v = await newVenture(svc);
    orch.register('buildsquad.plan', async () => ({}));
    const j: VentureJob = await orch.enqueue({
      ownerId: OWNER, ventureId: v.ventureId,
      jobKind: 'buildsquad.plan', input: {},
    });
    expect(j.artifactKind).toBe('buildsquad_pack');
  });
});
