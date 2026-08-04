/**
 * JobProgress + useJob (Sprint 2A.6 / PR3, productized).
 *
 * Polls /api/jobs/[id] every 750ms until the job hits a terminal state and
 * renders a transparent status card: live elapsed time, step label, progress,
 * provider · model · cost, and — on failure — sanitised error guidance plus a
 * re-run CTA that deep-links back to the originating lab (no retry endpoint
 * exists, so we send the user to re-run with the same prebound ventureId).
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VentureJob } from '@foundry/contracts';

import {
  cx,
  fmtCostCents,
  fmtDuration,
  JOB_KIND_LABEL,
  JobStatusBadge,
  labLinkForJob,
  styles,
} from './artifacts';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);
/** Error codes that represent a timeout/abort rather than a genuine handler error. */
const TIMEOUT_CODES = new Set(['timed_out', 'stale_timeout', 'provider_timeout', 'incomplete']);
/**
 * Absolute client-side polling cap. The server reconciles an orphaned job to a
 * terminal state well before this (stale threshold ~330s), so this only exists so
 * the UI can NEVER poll forever even if the server somehow keeps returning RUNNING.
 */
const MAX_POLL_MS = 360_000;

export function useJob(jobId: string | null, pollMs = 750): { job: VentureJob | null; error: string | null } {
  const [job, setJob] = useState<VentureJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopped = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    stopped.current = false;
    startedAt.current = Date.now();
    if (!jobId) { setJob(null); return; }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { cache: 'no-store' });
        const j = await r.json();
        if (stopped.current) return;
        if (!j.ok) { setError(j.reason ?? 'Failed to load job.'); return; }
        setJob(j.job as VentureJob);
        if (!TERMINAL.has(j.job.status)) {
          if (Date.now() - startedAt.current >= MAX_POLL_MS) {
            setError('This job is taking longer than expected. Refresh to check its latest status — it will be marked failed automatically if it stalled.');
            return;
          }
          timer = setTimeout(() => void tick(), pollMs);
        }
      } catch (e) {
        if (stopped.current) return;
        setError(e instanceof Error ? e.message : 'Polling failed.');
      }
    };
    void tick();
    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, pollMs]);

  return { job, error };
}

/** A live, ticking clock (1s) that stops once the job reaches a terminal state. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function elapsedMs(job: VentureJob, now: number): number | null {
  if (job.executionDurationMs != null) return job.executionDurationMs;
  const start = job.startedAt ?? job.createdAt;
  if (!start) return null;
  const t = new Date(start).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, now - t);
}

export interface JobProgressProps {
  jobId: string | null;
  onCancel?: () => void;
}

export function JobProgress({ jobId, onCancel }: JobProgressProps) {
  const { job, error } = useJob(jobId);
  const running = !!job && !TERMINAL.has(job.status);
  const now = useNow(running);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
    onCancel?.();
  }, [jobId, onCancel]);

  if (!jobId) return null;
  if (error) return <div className={cx(styles.jobError)}>{error}</div>;
  if (!job) return <div className={cx(styles.jobCard)}>Starting…</div>;

  const pctDone = Math.round((job.progress ?? 0) * 100);
  const elapsed = elapsedMs(job, now);
  const meta: string[] = [];
  if (job.providerName && job.providerModel) meta.push(`${job.providerName} · ${job.providerModel}`);
  if (elapsed != null) meta.push(fmtDuration(elapsed));
  if (job.estimatedCostCents != null) meta.push(fmtCostCents(job.estimatedCostCents));
  const rerun = labLinkForJob(job.jobKind, job.ventureId);

  return (
    <div className={cx(styles.jobCard)}>
      <div className={cx(styles.jobHead)}>
        <JobStatusBadge status={job.status} />
        <span className={cx(styles.jobKind)}>{JOB_KIND_LABEL[job.jobKind]}</span>
        <span className={cx(styles.jobSpacer)} />
        {(job.status === 'queued' || job.status === 'running') ? (
          <button type="button" onClick={() => void cancel()} className={cx(styles.btn, styles.btnGhost)}>Cancel</button>
        ) : null}
      </div>

      {job.stepLabel ? <div className={cx(styles.jobStep)}>{job.stepLabel}</div> : null}

      <div className={cx(styles.barTrack)}>
        <div
          className={cx(styles.barFill, job.status === 'failed' && styles.barFillAmber, job.status === 'succeeded' && styles.barFillGreen)}
          style={{ width: `${job.status === 'succeeded' ? 100 : pctDone}%`, transition: 'width 200ms' }}
        />
      </div>

      {meta.length > 0 ? <div className={cx(styles.jobMeta)}>{meta.join('  ·  ')}</div> : null}

      {job.status === 'failed' ? (
        <div className={cx(styles.jobError)}>
          <p className={cx(styles.jobErrorTitle)}>
            {job.errorCode && TIMEOUT_CODES.has(job.errorCode) ? 'Job timed out' : 'Job failed'}
            {job.errorCode ? ` · ${job.errorCode}` : ''}
          </p>
          {job.errorMessage ? <p style={{ margin: '0 0 0.4rem' }}>{job.errorMessage}</p> : null}
          <p style={{ margin: '0 0 0.5rem' }} className={cx(styles.muted)}>
            Nothing was saved. Check the related provider key is valid, then re-run — your venture context is preserved.
          </p>
          <a className={cx(styles.btn, styles.btnPrimary)} href={rerun.href}>{rerun.label} →</a>
        </div>
      ) : null}
    </div>
  );
}
