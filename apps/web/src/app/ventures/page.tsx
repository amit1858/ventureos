'use client';

/**
 * My Ventures (Sprint 2A.5).
 *
 * Top-level dashboard for the Venture-centric experience. Lists every Venture
 * the signed-in user owns, with status, last update, latest recommendation,
 * readiness score and progress axes. Supports search + status filter + sort.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { VentureSummary, VentureStatus } from '@ventureos/contracts';

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
  const [ventures, setVentures] = useState<VentureSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | VentureStatus>('');
  const [sort, setSort] = useState<'updated_desc' | 'created_desc' | 'title_asc'>('updated_desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/ventures', { cache: 'no-store' });
      if (r.status === 401) { setError('Real Mode requires sign-in. Sign in with Google for a private workspace, or use Demo Mode without any keys.'); return; }
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

  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>My Ventures</h1>
          <p style={{ color: '#9aa0a6', margin: '0.25rem 0 0' }}>
            Every persona, research graph, recommendation and BuildSquad pack belongs to a Venture.
          </p>
        </div>
        <a href="/ventures/new" style={primaryBtn}>+ New venture</a>
      </header>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search title or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 240px' }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as '' | VentureStatus)} style={inputStyle}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={inputStyle}>
          <option value="updated_desc">Last updated</option>
          <option value="created_desc">Newest</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      {error && (
        <div style={{ ...card, padding: '1rem 1.25rem', marginBottom: '1rem' }}>
          <p style={{ color: '#ef6a6a', margin: 0 }}>{error}</p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="/signin?next=/ventures" style={{ ...primaryBtn, fontSize: '0.85rem' }}>Sign in with Google</a>
            <a
              href="/demo"
              style={{
                padding: '0.5rem 0.85rem',
                background: 'transparent',
                color: '#cbd0d4',
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                textDecoration: 'none',
                fontSize: '0.85rem',
              }}
            >
              Open Demo Mode
            </a>
          </div>
        </div>
      )}
      {loading && <p style={{ color: '#9aa0a6' }}>Loading…</p>}
      {!loading && filtered.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#9aa0a6' }}>
            No ventures match. {ventures.length === 0
              ? 'Create your first one to get started.'
              : 'Try clearing the search or filter.'}
          </p>
          {ventures.length === 0 && <a href="/ventures/new" style={primaryBtn}>Create a venture</a>}
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
          {v.status}
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
          ? <>Recommendation: <strong style={{ color: '#e8e8ea' }}>{summary.latestRecommendation.decision}</strong> · score {summary.latestRecommendation.overallScore}/100</>
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
        <div style={{ height: '100%', width: `${value}%`, background: '#7aa3ff', borderRadius: 2 }} />
      </div>
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
  padding: '0.5rem 0.85rem', background: '#7aa3ff', color: '#0b0b0e',
  borderRadius: 6, fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem',
};
