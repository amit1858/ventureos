/**
 * Reliability / lifecycle regression matrix for the JobOrchestrator.
 *
 * Motivated by the production incident where `runFocusGroup` sat in RUNNING for
 * 6+ minutes: a hung provider call ran to the serverless function ceiling and the
 * invocation was killed before any terminal state was written, so the row froze at
 * `running` and the UI polled forever.
 *
 * The guarantee these tests lock in: **every job that starts reaches a terminal
 * state** (succeeded | failed | cancelled) — even when the provider hangs, the
 * handler throws, our own persistence throws, the invocation is orphaned, or the
 * user cancels — and a job is never resurrected or shown a partial artifact once
 * terminal (first-terminal-wins). They also cover stale reconciliation, durable
 * cancellation, duplicate-run detection, retry-after-terminal, and cross-user
 * isolation of every new lifecycle method.
 */
import { describe, expect, it } from 'vitest';

import {
  DuplicateActiveJobError,
  InMemoryJobStore,
  InMemoryVentureStore,
  JobOrchestrator,
  VentureService,
  type JobHandler,
  type JobStore,
  type VentureJob,
  type VentureJobKind,
} from '../src/index.js';

const OWNER = 'user_a';
const OTHER = 'user_b';

interface HarnessOpts {
  jobTimeoutMs?: number;
  staleJobMs?: number;
  /** When false, the scheduler parks the run so the caller drives the lifecycle. */
  autoRun?: boolean;
  jobStore?: JobStore;
}

/** Controllable-clock harness (distinct from jobs.test.ts's ticking clock). */
function harness(opts: HarnessOpts = {}) {
  let n = 0;
  const id = (prefix: string) => {
    n += 1;
    return `${prefix}_${n.toString().padStart(3, '0')}`;
  };
  let clockMs = new Date('2026-06-01T00:00:00.000Z').getTime();
  const now = () => new Date(clockMs);
  const advance = (ms: number) => {
    clockMs += ms;
  };

  const store = new InMemoryVentureStore();
  const svc = new VentureService(store, { now, generateId: id });
  const jobStore = opts.jobStore ?? new InMemoryJobStore();

  let pendingRun: Promise<void> | null = null;
  const autoRun = opts.autoRun !== false;
  const orch = new JobOrchestrator(jobStore, svc, {
    now,
    generateId: id,
    scheduler: autoRun
      ? (run) => {
          pendingRun = run();
        }
      : () => {
          /* park — the test drives the row manually */
        },
    ...(opts.jobTimeoutMs != null ? { jobTimeoutMs: opts.jobTimeoutMs } : {}),
    ...(opts.staleJobMs != null ? { staleJobMs: opts.staleJobMs } : {}),
  });

  return {
    svc,
    orch,
    jobStore,
    now,
    advance,
    drain: async () => {
      if (pendingRun) await pendingRun;
      pendingRun = null;
    },
  };
}

async function newVenture(svc: VentureService) {
  return svc.createVenture({ ownerId: OWNER, title: 'Faceless CRM' });
}

/** Enqueue then force the row to `running` with an explicit startedAt (no auto-run). */
async function makeRunningRow(
  h: ReturnType<typeof harness>,
  ventureId: string,
  jobKind: VentureJobKind,
  startedAtIso: string,
): Promise<VentureJob> {
  const q = await h.orch.enqueue({ ownerId: OWNER, ventureId, jobKind, input: {} });
  const running: VentureJob = { ...q, status: 'running', startedAt: startedAtIso };
  await h.jobStore.replaceJob(running);
  return running;
}

/** A JobStore that can silently drop or throw on the first `succeeded` write. */
class FlakyJobStore extends InMemoryJobStore {
  dropSucceeded = false;
  throwOnSucceededOnce = false;
  private thrown = false;

  override async replaceJob(j: VentureJob): Promise<void> {
    if (j.status === 'succeeded' && this.dropSucceeded) return; // ACK but don't persist
    if (j.status === 'succeeded' && this.throwOnSucceededOnce && !this.thrown) {
      this.thrown = true;
      throw new Error('terminal write failed');
    }
    return super.replaceJob(j);
  }
}

const PERSONAS: VentureJobKind = 'personalab.generate_personas';
const FOCUS: VentureJobKind = 'personalab.run_focus_group';

// ── 1–2 · provider hang / hard timeout ───────────────────────────────────────

describe('reliability · hard timeout', () => {
  it('1) a handler that never resolves is aborted and recorded failed(timed_out)', async () => {
    const h = harness({ jobTimeoutMs: 30 });
    const v = await newVenture(h.svc);
    // Ignores the signal entirely — models the hung provider call.
    h.orch.register(FOCUS, () => new Promise<never>(() => {}));

    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await h.drain();

    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('timed_out');
    expect(final?.outputArtifactId).toBeNull();
    // No partial artifact on timeout.
    expect(await h.svc.listArtifacts(OWNER, v.ventureId)).toHaveLength(0);
  });

  it('2) a signal-aware handler that rejects on abort is still recorded failed(timed_out)', async () => {
    const h = harness({ jobTimeoutMs: 30 });
    const v = await newVenture(h.svc);
    h.orch.register(FOCUS, (ctx) =>
      new Promise<never>((_, reject) => {
        ctx.signal.addEventListener('abort', () => reject(new Error('provider request aborted')), { once: true });
      }),
    );

    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await h.drain();

    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('timed_out');
  });
});

// ── 3–7 · error / persistence paths always end terminal ──────────────────────

describe('reliability · error paths reach terminal', () => {
  it('3) a handler that throws is recorded failed(handler_error)', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    h.orch.register(FOCUS, async () => {
      throw new Error('unexpected explosion');
    });
    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await h.drain();
    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('handler_error');
  });

  it('4) a JSON parse failure surfaces as failed(handler_error) with a sanitised message', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    h.orch.register(FOCUS, async () => {
      const e = new Error('Structured parse failed near token; key sk-abcdef1234567890 leaked');
      e.name = 'StructuredParseError';
      throw e;
    });
    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await h.drain();
    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('handler_error');
    expect(final?.errorMessage).not.toMatch(/sk-abcdef/);
    expect(final?.errorMessage).toMatch(/sk-\*\*\*/);
  });

  it('5) an artifact-persistence failure ends failed with no artifact left behind', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    // Break the artifact write specifically.
    h.svc.attachArtifact = async () => {
      throw new Error('supabase insert failed');
    };
    h.orch.register(PERSONAS, async () => ({
      artifact: { artifactKind: 'persona_set', summary: '3 personas', payload: [{ id: 'p1' }] },
    }));
    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    await h.drain();
    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('handler_error');
    expect(await h.svc.listArtifacts(OWNER, v.ventureId)).toHaveLength(0);
  });

  it('6) a throwing terminal write is caught and the job still ends terminal(failed)', async () => {
    const flaky = new FlakyJobStore();
    flaky.throwOnSucceededOnce = true;
    const h = harness({ jobStore: flaky });
    const v = await newVenture(h.svc);
    h.orch.register(PERSONAS, async () => ({
      artifact: { artifactKind: 'persona_set', summary: 'x', payload: [{ id: 'p1' }] },
    }));
    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    await h.drain();
    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
  });

  it('7) a silently-dropped terminal write is backstopped by the finally guard as failed(incomplete)', async () => {
    const flaky = new FlakyJobStore();
    flaky.dropSucceeded = true;
    const h = harness({ jobStore: flaky });
    const v = await newVenture(h.svc);
    h.orch.register(PERSONAS, async () => ({
      artifact: { artifactKind: 'persona_set', summary: 'x', payload: [{ id: 'p1' }] },
    }));
    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    await h.drain();
    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('incomplete');
  });
});

// ── 8–11 · stale reconciliation ──────────────────────────────────────────────

describe('reliability · stale reconciliation', () => {
  it('8) reconcileStale flips an orphaned running row to failed(stale_timeout)', async () => {
    const h = harness({ staleJobMs: 1000, autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    h.advance(1500); // past the stale threshold

    const reconciled = await h.orch.reconcileStale({ ownerId: OWNER, ventureId: v.ventureId });
    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]?.jobId).toBe(running.jobId);
    expect(reconciled[0]?.status).toBe('failed');
    expect(reconciled[0]?.errorCode).toBe('stale_timeout');
  });

  it('9) getJobReconciled reconciles a single stale row on read', async () => {
    const h = harness({ staleJobMs: 1000, autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    h.advance(1500);
    const read = await h.orch.getJobReconciled(OWNER, running.jobId);
    expect(read?.status).toBe('failed');
    expect(read?.errorCode).toBe('stale_timeout');
  });

  it('10) getJobReconciled leaves a fresh running row untouched (no premature reconcile)', async () => {
    const h = harness({ staleJobMs: 1000, autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    h.advance(200); // well under the threshold
    const read = await h.orch.getJobReconciled(OWNER, running.jobId);
    expect(read?.status).toBe('running');
    expect(read?.errorCode).toBeNull();
  });

  it('11) reconcileStale is a no-op when nothing is stale', async () => {
    const h = harness({ staleJobMs: 1000, autoRun: false });
    const v = await newVenture(h.svc);
    await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    h.advance(200);
    expect(await h.orch.reconcileStale({ ownerId: OWNER, ventureId: v.ventureId })).toHaveLength(0);
  });
});

// ── 12–15 · durable cancellation ─────────────────────────────────────────────

describe('reliability · cancellation', () => {
  it('12) cancels a running job with a live handler and aborts its provider call', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    let started!: () => void;
    const startedP = new Promise<void>((r) => {
      started = r;
    });
    const handler: JobHandler = (ctx) =>
      new Promise<never>((_, reject) => {
        started();
        ctx.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    h.orch.register(FOCUS, handler);

    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await startedP; // row is now running, controller registered
    const cancelled = await h.orch.cancel(OWNER, j.jobId);
    expect(cancelled?.status).toBe('cancelled');
    await h.drain();
    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('cancelled');
  });

  it('13) cancels an orphaned running job even with no live handler (durable cancel)', async () => {
    const h = harness({ autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    const cancelled = await h.orch.cancel(OWNER, running.jobId);
    expect(cancelled?.status).toBe('cancelled');
    const final = await h.orch.getJob(OWNER, running.jobId);
    expect(final?.status).toBe('cancelled');
  });

  it('14) cancel is idempotent — a terminal job is returned unchanged', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    h.orch.register(PERSONAS, async () => ({
      artifact: { artifactKind: 'persona_set', summary: 'x', payload: [{ id: 'p1' }] },
    }));
    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    await h.drain();
    expect((await h.orch.getJob(OWNER, j.jobId))?.status).toBe('succeeded');
    const again = await h.orch.cancel(OWNER, j.jobId);
    expect(again?.status).toBe('succeeded'); // not flipped to cancelled
    const failedEvents = (await h.svc.listEvents(OWNER, v.ventureId)).filter(
      (e) => e.eventKind === 'job_failed' && e.jobId === j.jobId,
    );
    expect(failedEvents).toHaveLength(0);
  });

  it('15) no partial artifact is attached when a job is cancelled mid-flight', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    let started!: () => void;
    const startedP = new Promise<void>((r) => {
      started = r;
    });
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const handler: JobHandler = async (ctx) => {
      started();
      await gate;
      void ctx;
      return { artifact: { artifactKind: 'persona_set', summary: 'late', payload: [{ id: 'p1' }] } };
    };
    h.orch.register(PERSONAS, handler);

    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    await startedP;
    await h.orch.cancel(OWNER, j.jobId);
    release(); // handler resolves with an artifact AFTER cancellation
    await h.drain();

    expect((await h.orch.getJob(OWNER, j.jobId))?.status).toBe('cancelled');
    expect(await h.svc.listArtifacts(OWNER, v.ventureId)).toHaveLength(0);
  });
});

// ── 16 · first-terminal-wins on the success path ─────────────────────────────

describe('reliability · first-terminal-wins', () => {
  it('16) a handler that succeeds after the row was reconciled does not overwrite it or attach an artifact', async () => {
    const h = harness({ staleJobMs: 1000, jobTimeoutMs: 100_000 });
    const v = await newVenture(h.svc);
    let started!: () => void;
    const startedP = new Promise<void>((r) => {
      started = r;
    });
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    h.orch.register(PERSONAS, async () => {
      started();
      await gate;
      return { artifact: { artifactKind: 'persona_set', summary: 'x', payload: [{ id: 'p1' }] } };
    });

    const j = await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    await startedP; // running
    h.advance(1500);
    await h.orch.reconcileStale({ ownerId: OWNER, ventureId: v.ventureId }); // → failed(stale_timeout), no abort
    release(); // handler now resolves successfully
    await h.drain();

    const final = await h.orch.getJob(OWNER, j.jobId);
    expect(final?.status).toBe('failed');
    expect(final?.errorCode).toBe('stale_timeout');
    expect(await h.svc.listArtifacts(OWNER, v.ventureId)).toHaveLength(0);
  });
});

// ── 17–21 · duplicate detection + retry-after-terminal ───────────────────────

describe('reliability · duplicate detection and retry', () => {
  it('17) findActiveJob returns a genuinely active job of the same kind', async () => {
    const h = harness({ staleJobMs: 1_000_000, autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    const found = await h.orch.findActiveJob(OWNER, v.ventureId, FOCUS);
    expect(found?.jobId).toBe(running.jobId);
  });

  it('18) DuplicateActiveJobError carries the offending kind and existing job id', () => {
    const err = new DuplicateActiveJobError(FOCUS, 'job_123');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('DuplicateActiveJobError');
    expect(err.jobKind).toBe(FOCUS);
    expect(err.existingJobId).toBe('job_123');
    expect(err.message).toMatch(/already running/i);
  });

  it('19) retry is allowed after a failed job (findActiveJob → null)', async () => {
    const h = harness();
    const v = await newVenture(h.svc);
    h.orch.register(FOCUS, async () => {
      throw new Error('boom');
    });
    await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await h.drain();
    expect(await h.orch.findActiveJob(OWNER, v.ventureId, FOCUS)).toBeNull();
  });

  it('20) retry is allowed after a cancelled job (findActiveJob → null)', async () => {
    const h = harness({ autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    await h.orch.cancel(OWNER, running.jobId);
    expect(await h.orch.findActiveJob(OWNER, v.ventureId, FOCUS)).toBeNull();
  });

  it('21) retry is allowed after a timed-out job (findActiveJob → null)', async () => {
    const h = harness({ jobTimeoutMs: 30 });
    const v = await newVenture(h.svc);
    h.orch.register(FOCUS, () => new Promise<never>(() => {}));
    await h.orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: FOCUS, input: {} });
    await h.drain();
    expect(await h.orch.findActiveJob(OWNER, v.ventureId, FOCUS)).toBeNull();
  });
});

// ── 22 · cross-user isolation of every new lifecycle method ──────────────────

describe('reliability · cross-user isolation', () => {
  it('22) another owner cannot read, reconcile, cancel, or discover a job', async () => {
    const h = harness({ staleJobMs: 1000, autoRun: false });
    const v = await newVenture(h.svc);
    const running = await makeRunningRow(h, v.ventureId, FOCUS, h.now().toISOString());
    h.advance(5000); // stale for the real owner

    // The other user sees nothing and cannot mutate the row.
    expect(await h.orch.getJobReconciled(OTHER, running.jobId)).toBeNull();
    expect(await h.orch.cancel(OTHER, running.jobId)).toBeNull();
    expect(await h.orch.findActiveJob(OTHER, v.ventureId, FOCUS)).toBeNull();
    expect(await h.orch.reconcileStale({ ownerId: OTHER })).toHaveLength(0);

    // The row is untouched for the real owner (still reconcilable by them).
    const ownerView = await h.orch.getJob(OWNER, running.jobId);
    expect(ownerView?.status).toBe('running');
  });
});

// ── 23 · first-terminal-wins at the start of run() (cancel-before-run) ────────

describe('reliability · cancel before the scheduler fires', () => {
  it('23) a job cancelled while queued is never resurrected to running or given a provider call', async () => {
    // Reproduces the live-scheduler race: cancel() lands after enqueue but before
    // the scheduler invokes run(). run() must observe the terminal row and bail —
    // not clobber `cancelled` back to `running`, and not spend a provider call.
    let clockMs = new Date('2026-06-01T00:00:00.000Z').getTime();
    let seq = 0;
    const id = (p: string) => `${p}_${(seq += 1).toString().padStart(3, '0')}`;
    const store = new InMemoryVentureStore();
    const svc = new VentureService(store, { now: () => new Date(clockMs), generateId: id });
    const jobStore = new InMemoryJobStore();

    let capturedRun: (() => Promise<void>) | null = null;
    const orch = new JobOrchestrator(jobStore, svc, {
      now: () => new Date(clockMs),
      generateId: id,
      scheduler: (run) => {
        capturedRun = run; // capture but DO NOT fire — the test drives it
      },
    });

    let handlerInvoked = false;
    const handler: JobHandler = async () => {
      handlerInvoked = true;
      return { artifact: { artifactKind: 'persona_set', summary: 'x', payload: [{ id: 'p1' }] } };
    };
    orch.register(PERSONAS, handler);

    const v = await svc.createVenture({ ownerId: OWNER, title: 'Faceless CRM' });
    const q = await orch.enqueue({ ownerId: OWNER, ventureId: v.ventureId, jobKind: PERSONAS, input: {} });
    expect(q.status).toBe('queued');

    const cancelled = await orch.cancel(OWNER, q.jobId);
    expect(cancelled?.status).toBe('cancelled');

    // Now the scheduler finally fires the run it captured earlier.
    expect(capturedRun).not.toBeNull();
    await capturedRun!();

    expect(handlerInvoked).toBe(false); // no wasted provider call
    expect((await orch.getJob(OWNER, q.jobId))?.status).toBe('cancelled'); // never resurrected
    expect(await svc.listArtifacts(OWNER, v.ventureId)).toHaveLength(0);
  });
});
