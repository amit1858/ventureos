/**
 * JobProgress + useJob (Sprint 2A.6 / PR3).
 *
 * Polls /api/jobs/[id] every 750ms until the job hits a terminal state.
 * The component is intentionally small — render it next to whatever
 * triggered the job and unmount when the caller has consumed the result.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VentureJob } from '@ventureos/contracts';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

export function useJob(jobId: string | null, pollMs = 750): { job: VentureJob | null; error: string | null } {
  const [job, setJob] = useState<VentureJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
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

export interface JobProgressProps {
  jobId: string | null;
  onCancel?: () => void;
}

export function JobProgress({ jobId, onCancel }: JobProgressProps) {
  const { job, error } = useJob(jobId);
  const cancel = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
    onCancel?.();
  }, [jobId, onCancel]);

  if (!jobId) return null;
  if (error) return <div style={{ color: '#ef6a6a', fontSize: '0.85rem' }}>{error}</div>;
  if (!job) return <div style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>Starting…</div>;

  const pct = Math.round((job.progress ?? 0) * 100);
  const colour = colourForStatus(job.status);

  return (
    <div style={{
      border: '1px solid #2a2a2a',
      borderRadius: 6,
      padding: '0.75rem',
      background: '#161616',
      fontSize: '0.85rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: colour, fontWeight: 600 }}>{job.status}</span>
        <span style={{ color: '#9aa0a6' }}>{job.jobKind}</span>
        {(job.status === 'queued' || job.status === 'running') && (
          <button onClick={() => void cancel()} style={{
            background: 'transparent', border: '1px solid #5a5a5a',
            color: '#d0d0d0', borderRadius: 4, padding: '0.15rem 0.5rem',
            fontSize: '0.75rem', cursor: 'pointer',
          }}>Cancel</button>
        )}
      </div>
      {job.stepLabel && <div style={{ color: '#d0d0d0', marginTop: '0.25rem' }}>{job.stepLabel}</div>}
      <div style={{ height: 4, background: '#1f1f1f', borderRadius: 2, marginTop: '0.5rem', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width 200ms' }} />
      </div>
      <Metrics job={job} />
      {job.status === 'failed' && job.errorMessage && (
        <div style={{ color: '#ef6a6a', marginTop: '0.5rem' }}>{job.errorMessage}</div>
      )}
    </div>
  );
}

function Metrics({ job }: { job: VentureJob }) {
  const bits: string[] = [];
  if (job.providerName && job.providerModel) bits.push(`${job.providerName} · ${job.providerModel}`);
  if (job.executionDurationMs != null) bits.push(`${(job.executionDurationMs / 1000).toFixed(1)}s`);
  if (job.estimatedCostCents != null) bits.push(`~$${(job.estimatedCostCents / 100).toFixed(3)}`);
  if (bits.length === 0) return null;
  return <div style={{ color: '#7a7a7a', fontSize: '0.75rem', marginTop: '0.5rem' }}>{bits.join('  ·  ')}</div>;
}

function colourForStatus(s: VentureJob['status']): string {
  switch (s) {
    case 'queued':    return '#9aa0a6';
    case 'running':   return '#7aa3ff';
    case 'succeeded': return '#56c596';
    case 'failed':    return '#ef6a6a';
    case 'cancelled': return '#d589ff';
  }
}
