/**
 * RecentJobs — surfaces the venture's last few JobOrchestrator runs with
 * their observability footer (provider · model · duration · cost). Polls
 * once on mount; the workspace re-mounts it whenever it reloads, so we
 * don't poll forever.
 */
'use client';

import { useEffect, useState } from 'react';
import type { VentureJob } from '@foundry/contracts';

import { JOB_KIND_LABEL } from './artifacts/helpers';
import { jobStatusLabel } from '../lib/labels';

export function RecentJobs({ ventureId, limit = 6 }: { ventureId: string; limit?: number }) {
  const [jobs, setJobs] = useState<VentureJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const r = await fetch(`/api/ventures/${ventureId}/jobs?limit=${limit}`, { cache: 'no-store' });
        const j = await r.json();
        if (stopped) return;
        if (!j.ok) { setError(j.reason ?? 'Failed to load jobs.'); return; }
        setJobs(j.jobs as VentureJob[]);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : 'Failed to load jobs.');
      }
    })();
    return () => { stopped = true; };
  }, [ventureId, limit]);

  if (error) return <div style={{ color: '#ef6a6a', fontSize: '0.85rem' }}>{error}</div>;
  if (jobs.length === 0) return <div style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>No jobs run yet.</div>;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
      {jobs.map((j) => (
        <li key={j.jobId} style={{
          border: '1px solid #2a2a2a', borderRadius: 6,
          padding: '0.5rem 0.75rem', background: '#161616', fontSize: '0.8rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ color: '#d0d0d0', fontWeight: 500 }}>{JOB_KIND_LABEL[j.jobKind] ?? j.jobKind}</span>
            <span style={{ color: colourForStatus(j.status), fontWeight: 600 }}>{jobStatusLabel(j.status)}</span>
          </div>
          <div style={{ color: '#7a7a7a', fontSize: '0.72rem', marginTop: '0.15rem' }}>
            {footer(j)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function footer(j: VentureJob): string {
  const bits: string[] = [];
  if (j.providerName && j.providerModel) bits.push(`${j.providerName}·${j.providerModel}`);
  if (j.executionDurationMs != null) bits.push(`${(j.executionDurationMs / 1000).toFixed(1)}s`);
  if (j.estimatedCostCents != null) bits.push(`~$${(j.estimatedCostCents / 100).toFixed(3)}`);
  if (j.finishedAt) bits.push(new Date(j.finishedAt).toLocaleTimeString());
  return bits.join('  ·  ') || '—';
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
