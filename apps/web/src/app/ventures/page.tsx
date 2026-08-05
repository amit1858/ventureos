'use client';

/**
 * My Ventures (Sprint 2A.5).
 *
 * Top-level dashboard for the Venture-centric experience. Lists every Venture
 * the signed-in user owns, with status, last update, latest recommendation,
 * readiness score and progress axes. Supports search + status filter + sort.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { VentureSummary, VentureStatus } from '@foundry/contracts';

import { SignInNotice } from '../../components/SignInNotice';
import { ventureStatusLabel, titleCase } from '../../lib/labels';

const STATUSES: VentureStatus[] = [
  'draft', 'researching', 'validating', 'pivoting', 'approved', 'building', 'archived', 'rejected',
];

const STATUS_COLOUR: Record<VentureStatus, string> = {
  draft:        '#9aa0a6',
  researching:  '#7aa3ff',
  validating:   '#f3b350',
  pivoting:     '#d589ff',
  approved:     '#56c596',
  building:     '#56c596',
  archived:     '#5a5a5a',
  rejected:     '#ef6a6a',
};

export default function MyVenturesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [ventures, setVentures] = useState<VentureSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | VentureStatus>('');
  const [sort, setSort] = useState<'updated_desc' | 'created_desc' | 'title_asc'>('updated_desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const r = await fetch('/api/ventures', { cache: 'no-store' });
      if (r.status === 401) { setNeedsAuth(true); return; }
      const body = (await r.json()) as { ok: boolean; ventures?: VentureSummary[]; reason?: string };
      if (!body.ok) { setError(body.reason ?? 'Failed to load ventures.'); return; }
      setVentures(body.ventures ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ventures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    let out = [...ventures];
    if (statusFilter) out = out.filter((s) => s.venture.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((s) =>
        s.venture.title.toLowerCase().includes(q) ||
        s.venture.description.toLowerCase().includes(q),
      );
    }
    out.sort((a, b) => {
      if (sort === 'created_desc') return b.venture.createdAt.localeCompare(a.venture.createdAt);
      if (sort === 'title_asc') return a.venture.title.localeCompare(b.venture.title);
      return b.venture.updatedAt.localeCompare(a.venture.updatedAt);
    });
    return out;
  }, [ventures, search, statusFilter, sort]);

  // Portfolio at a glance — derived purely from the ventures already loaded.
  const stats = useMemo(() => {
    const total = ventures.length;
    const inEval = ventures.filter((s) => ['researching', 'validating', 'pivoting'].includes(s.venture.status)).length;
    const advanced = ventures.filter((s) => ['approved', 'building'].includes(s.venture.status)).length;
    const avgReadiness = total ? Math.round(ventures.reduce((a, s) => a + s.readiness.overall, 0) / total) : 0;
    return { total, inEval, advanced, avgReadiness };
  }, [ventures]);

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>My Ventures</h1>
          <p style={{ color: '#9aa0a6', margin: '0.25rem 0 0' }}>
            Your portfolio of ventures — each with its research, validation and build plan in one place.
          </p>
        </div>
        <a href="/ventures/new" style={primaryBtn}>+ New venture</a>
      </header>

      {!error && ventures.length > 0 && (
        <div style={statStrip}>
          <StatTile label="Ventures" value={stats.total} />
          <StatTile label="In evaluation" value={stats.inEval} accent="#f3b350" />
          <StatTile label="Advanced to build" value={stats.advanced} accent="#56c596" />
          <StatTile label="Avg readiness" value={`${stats.avgReadiness}%`} accent="var(--accent)" />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 240px' }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | VentureStatus)} style={inputStyle}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{ventureStatusLabel(s)}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={inputStyle}>
          <option value="updated_desc">Last updated</option>
          <option value="created_desc">Newest</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      {needsAuth && <SignInNotice next="/ventures" />}
      {error && (
        <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <p style={{ color: '#ef6a6a', margin: 0 }}>{error}</p>
        </div>
      )}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }} aria-busy="true" aria-label="Loading ventures">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...card }}>
              <div className="fdry-skeleton fdry-skeleton--title" style={{ width: '55%' }} />
              <div className="fdry-skeleton fdry-skeleton--text" style={{ width: '90%', marginTop: '0.6rem' }} />
              <div className="fdry-skeleton fdry-skeleton--text" style={{ width: '70%', marginTop: '0.4rem' }} />
              <div className="fdry-skeleton-stack" style={{ marginTop: '1rem' }}>
                <div className="fdry-skeleton fdry-skeleton--line" />
                <div className="fdry-skeleton fdry-skeleton--line" />
                <div className="fdry-skeleton fdry-skeleton--line" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && !error && !needsAuth && ventures.length === 0 && (
        <div style={{ ...card, padding: '2rem', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 0.5rem' }}>Start your first venture</h2>
          <p style={{ color: '#9aa0a6', margin: '0 0 1.1rem', lineHeight: 1.6 }}>
            A venture is the home for one idea — its personas, research graph, validation
            recommendation and build plan all live together. Foundry walks it from a raw idea to a
            Proceed / Pivot / Kill decision you can defend.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/ventures/new" style={primaryBtn}>+ New venture</a>
            <a href="/demo/faceless-crm" style={ghostBtn}>See a worked example →</a>
          </div>
        </div>
      )}
      {!loading && !error && ventures.length > 0 && filtered.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#9aa0a6', margin: 0 }}>No ventures match. Try clearing the search or filter.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }}>
        {filtered.map((s) => <VentureCard key={s.venture.ventureId} summary={s} />)}
      </div>
    </section>
  );
}

function VentureCard({ summary }: { summary: VentureSummary }) {
  const v = summary.venture;
  return (
    <a href={`/ventures/${v.ventureId}`} style={{ ...card, color: '#e8e8ea', textDecoration: 'none', display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{v.title}</h3>
        <span style={{ ...badge, background: STATUS_COLOUR[v.status] + '22', color: STATUS_COLOUR[v.status], borderColor: STATUS_COLOUR[v.status] + '55' }}>
          {ventureStatusLabel(v.status)}
        </span>
      </div>
      {v.description && (
        <p style={{ color: '#9aa0a6', fontSize: '0.85rem', margin: '0.4rem 0 0.6rem', minHeight: '2.4em' }}>
          {v.description.length > 140 ? v.description.slice(0, 138) + '…' : v.description}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
        <ReadinessRing score={summary.readiness.overall} />
        <div style={{ flex: 1, marginLeft: '0.75rem' }}>
          <ProgressBar label="Research"   value={summary.progress.research} />
          <ProgressBar label="Validation" value={summary.progress.validation} />
          <ProgressBar label="Planning"   value={summary.progress.planning} />
          <ProgressBar label="Build-ready" value={summary.progress.buildReadiness} />
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#7a8088', marginTop: '0.5rem' }}>
        {summary.latestRecommendation
          ? <>Recommendation: <strong style={{ color: '#e8e8ea' }}>{titleCase(summary.latestRecommendation.decision)}</strong> · score {summary.latestRecommendation.overallScore}/100</>
          : <>No recommendation yet</>}
        <span style={{ float: 'right' }}>{summary.artifactCount} artifact(s)</span>
      </div>
    </a>
  );
}

function ReadinessRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#2a2a2a" strokeWidth={5} />
      <circle cx={28} cy={28} r={r} fill="none" stroke="#56c596" strokeWidth={5} strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 28 28)" strokeLinecap="round" />
      <text x={28} y={32} textAnchor="middle" fontSize={13} fill="#e8e8ea" fontWeight={600}>{score}</text>
    </svg>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#9aa0a6' }}>
        <span>{label}</span><span>{value}%</span>
      </div>
      <div style={{ height: 4, background: '#2a2a2a', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: 'var(--accent)', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, accent = '#e8e8ea' }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ ...card, padding: '0.85rem 1rem', flex: '1 1 150px' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{label}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem',
  background: '#101015',
};
const badge: React.CSSProperties = {
  fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 999,
  border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.04em',
};
const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem', background: '#101015', color: '#e8e8ea',
  border: '1px solid #2a2a2a', borderRadius: 6, fontSize: '0.9rem',
};
const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 0.85rem', background: 'var(--accent)', color: 'var(--on-accent)',
  borderRadius: 6, fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem',
};
const ghostBtn: React.CSSProperties = {
  padding: '0.5rem 0.85rem', background: 'transparent', color: '#cbd0d4',
  border: '1px solid #34343c', borderRadius: 6, fontWeight: 600,
  textDecoration: 'none', fontSize: '0.9rem',
};
const statStrip: React.CSSProperties = {
  display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem',
};
