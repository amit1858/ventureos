'use client';

/**
 * Venture Workspace (Sprint 2A.5).
 *
 * The page a user lives on. Shows the venture overview, status controls,
 * progress + readiness, the timeline, the artifact registry, and quick-action
 * links that pre-bind ventureId for PersonaLab / Research Graph / VentureLab /
 * BuildSquad so no JSON ever has to be pasted between modules.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  Venture,
  VentureArtifact,
  VentureArtifactKind,
  VentureStatus,
  VentureSummary,
  VentureTimelineEvent,
  BuildSquadArtifactPack,
  VentureRecommendation,
  PersonaLabPersona,
  ResearchGraph,
} from '@ventureos/contracts';

import { RecentJobs } from '../../../components/RecentJobs';
import { JobProgress } from '../../../components/JobProgress';

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

const ARTIFACT_LABEL: Record<VentureArtifactKind, string> = {
  persona_set:            'Persona set',
  interview_transcript:   'Interview',
  focus_group_transcript: 'Focus group',
  buying_committee:       'Buying committee',
  persona_insights:       'Persona insights',
  research_graph:         'Research graph',
  venture_recommendation: 'Recommendation',
  buildsquad_pack:        'BuildSquad pack',
  evaluation_report:      'Evaluation report',
  github_repo:            'GitHub repo',
};

interface Props { params: { id: string } }

type SectionKey = 'overview' | 'research' | 'personas' | 'committee' | 'validation' | 'buildsquad' | 'history' | 'artifacts';

export default function VentureWorkspacePage({ params }: Props) {
  const [summary, setSummary] = useState<VentureSummary | null>(null);
  const [artifacts, setArtifacts] = useState<VentureArtifact[]>([]);
  const [events, setEvents] = useState<VentureTimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionKey>('overview');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, a, t] = await Promise.all([
        fetch(`/api/ventures/${params.id}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/ventures/${params.id}/artifacts`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/ventures/${params.id}/timeline`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (!s.ok) { setError(s.reason ?? 'Failed to load venture.'); return; }
      setSummary(s.summary as VentureSummary);
      setArtifacts((a.ok ? a.artifacts : []) as VentureArtifact[]);
      setEvents((t.ok ? t.events : []) as VentureTimelineEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load.');
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = useCallback(async (next: VentureStatus) => {
    setBusy(true);
    try {
      await fetch(`/api/ventures/${params.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ patch: { status: next } }),
      });
      await load();
    } finally { setBusy(false); }
  }, [params.id, load]);

  if (error) return <p style={{ padding: '1.5rem', color: '#ef6a6a' }}>{error}</p>;
  if (!summary) return <p style={{ padding: '1.5rem', color: '#9aa0a6' }}>Loading…</p>;

  const v = summary.venture;
  const personasArt = latestOf(artifacts, 'persona_set');
  const researchArt = latestOf(artifacts, 'research_graph');
  const recArt = latestOf(artifacts, 'venture_recommendation');
  const packArt = latestOf(artifacts, 'buildsquad_pack');
  const committeeArt = latestOf(artifacts, 'buying_committee');

  return (
    <section style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <a href="/ventures" style={{ color: '#7aa3ff', fontSize: '0.85rem', textDecoration: 'none' }}>← My Ventures</a>
          <h1 style={{ margin: '0.25rem 0' }}>{v.title}</h1>
          {v.description && <p style={{ color: '#9aa0a6', margin: 0 }}>{v.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ ...badge, background: STATUS_COLOUR[v.status] + '22', color: STATUS_COLOUR[v.status], borderColor: STATUS_COLOUR[v.status] + '55' }}>
            {v.status}
          </span>
          <select
            value={v.status}
            disabled={busy}
            onChange={(e) => void setStatus(e.target.value as VentureStatus)}
            style={inputStyle}
          >
            {STATUSES.map((s) => <option key={s} value={s}>Set status → {s}</option>)}
          </select>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '0.25rem', marginTop: '1rem', borderBottom: '1px solid #2a2a2a', overflowX: 'auto' }}>
        {(['overview', 'research', 'personas', 'committee', 'validation', 'buildsquad', 'history', 'artifacts'] as SectionKey[]).map((k) => (
          <button key={k} onClick={() => setSection(k)} style={tab(section === k)}>{k}</button>
        ))}
      </nav>

      <div style={{ marginTop: '1rem' }}>
        {section === 'overview' && <Overview summary={summary} artifacts={artifacts} />}
        {section === 'research' && <ResearchSection venture={v} researchArt={researchArt} />}
        {section === 'personas' && <PersonasSection venture={v} personasArt={personasArt} />}
        {section === 'committee' && <CommitteeSection venture={v} committeeArt={committeeArt} />}
        {section === 'validation' && <ValidationSection venture={v} recArt={recArt} />}
        {section === 'buildsquad' && <BuildSquadSection venture={v} packArt={packArt} recArt={recArt} researchArt={researchArt} personasArt={personasArt} />}
        {section === 'history' && <HistorySection events={events} />}
        {section === 'artifacts' && <ArtifactsSection artifacts={artifacts} />}
      </div>
    </section>
  );
}

function Overview({ summary, artifacts }: { summary: VentureSummary; artifacts: VentureArtifact[] }) {
  const r = summary.readiness;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
      <div style={card}>
        <h3 style={h3}>Readiness</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Ring score={r.overall} />
          <div style={{ flex: 1 }}>
            <Bar label="Persona coverage" value={r.personaCoverage} />
            <Bar label="Research coverage" value={r.researchCoverage} />
            <Bar label="Validation confidence" value={r.validationConfidence} />
            <Bar label="BuildSquad completeness" value={r.buildsquadCompleteness} />
            <Bar label="Risk coverage" value={r.riskCoverage} />
          </div>
        </div>
        {r.warnings.length > 0 && (
          <ul style={{ marginTop: '0.5rem', color: '#f3b350', fontSize: '0.8rem', paddingLeft: '1rem' }}>
            {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </div>

      <div style={card}>
        <h3 style={h3}>Progress</h3>
        <Bar label="Research" value={summary.progress.research} />
        <Bar label="Validation" value={summary.progress.validation} />
        <Bar label="Planning" value={summary.progress.planning} />
        <Bar label="Build-ready" value={summary.progress.buildReadiness} />
      </div>

      <div style={card}>
        <h3 style={h3}>Latest recommendation</h3>
        {summary.latestRecommendation ? (
          <>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{summary.latestRecommendation.decision}</div>
            <div style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>
              Score {summary.latestRecommendation.overallScore}/100 ·
              Confidence {Math.round(summary.latestRecommendation.confidenceScore * 100)}%
            </div>
            <div style={{ color: '#7a8088', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              {new Date(summary.latestRecommendation.createdAt).toLocaleString()}
            </div>
          </>
        ) : (
          <p style={{ color: '#9aa0a6' }}>No recommendation yet. Run VentureLab to generate one.</p>
        )}
      </div>

      <div style={card}>
        <h3 style={h3}>Artifact counts</h3>
        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem' }}>
          {(Object.keys(ARTIFACT_LABEL) as VentureArtifactKind[]).map((k) => {
            const n = artifacts.filter((a) => a.artifactKind === k).length;
            return (
              <li key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #1c1c20' }}>
                <span style={{ color: '#9aa0a6' }}>{ARTIFACT_LABEL[k]}</span>
                <strong>{n}</strong>
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ ...card, gridColumn: '1 / -1' }}>
        <h3 style={h3}>Recent jobs</h3>
        <RecentJobs ventureId={summary.venture.ventureId} />
      </div>
    </div>
  );
}

function ResearchSection({ venture, researchArt }: { venture: Venture; researchArt: VentureArtifact | null }) {
  return (
    <div style={card}>
      <header style={sectionHead}>
        <h3 style={h3}>Research Graph</h3>
        <a href={`/labs/research-graph?ventureId=${encodeURIComponent(venture.ventureId)}`} style={primaryBtnSm}>
          {researchArt ? 'Rebuild graph →' : 'Build graph →'}
        </a>
      </header>
      {researchArt ? (
        <ResearchSummary art={researchArt} />
      ) : (
        <p style={{ color: '#9aa0a6' }}>No research graph yet. Open Graphify to build one.</p>
      )}
    </div>
  );
}

function ResearchSummary({ art }: { art: VentureArtifact }) {
  const g = art.payload as ResearchGraph | undefined;
  if (!g) return <p style={{ color: '#9aa0a6' }}>Could not parse graph payload.</p>;
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#9aa0a6' }}>
        v{art.version} · {new Date(art.createdAt).toLocaleString()}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
        <Stat label="Nodes" value={g.stats?.nodes ?? 0} />
        <Stat label="Edges" value={g.stats?.edges ?? 0} />
        <Stat label="God-nodes" value={g.godNodes?.length ?? 0} />
        <Stat label="Contradictions" value={g.contradictions?.length ?? 0} />
      </div>
      {g.godNodes && g.godNodes.length > 0 && (
        <>
          <h4 style={h4}>Strongest signals</h4>
          <ol style={{ paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
            {g.godNodes.slice(0, 5).map((n, i) => <li key={i}>{n.label}</li>)}
          </ol>
        </>
      )}
    </div>
  );
}

function PersonasSection({ venture, personasArt }: { venture: Venture; personasArt: VentureArtifact | null }) {
  const personas = (personasArt?.payload as PersonaLabPersona[] | undefined) ?? [];
  return (
    <div style={card}>
      <header style={sectionHead}>
        <h3 style={h3}>PersonaLab</h3>
        <a href={`/labs/persona?ventureId=${encodeURIComponent(venture.ventureId)}`} style={primaryBtnSm}>
          {personasArt ? 'Re-run personas →' : 'Generate personas →'}
        </a>
      </header>
      {personasArt ? (
        <>
          <div style={{ fontSize: '0.75rem', color: '#9aa0a6', marginBottom: '0.5rem' }}>
            v{personasArt.version} · {personas.length} personas · {new Date(personasArt.createdAt).toLocaleString()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
            {personas.slice(0, 8).map((p) => (
              <div key={p.id} style={{ ...card, padding: '0.6rem' }}>
                <strong>{p.name}</strong>
                <div style={{ color: '#9aa0a6', fontSize: '0.75rem' }}>{p.role}</div>
                {p.quote && <p style={{ fontSize: '0.78rem', color: '#cbcbd1', margin: '0.3rem 0 0', fontStyle: 'italic' }}>“{p.quote}”</p>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ color: '#9aa0a6' }}>No personas yet.</p>
      )}
    </div>
  );
}

function CommitteeSection({ venture, committeeArt }: { venture: Venture; committeeArt: VentureArtifact | null }) {
  return (
    <div style={card}>
      <header style={sectionHead}>
        <h3 style={h3}>Buying Committee</h3>
        <a href={`/labs/persona?ventureId=${encodeURIComponent(venture.ventureId)}`} style={primaryBtnSm}>
          Run committee →
        </a>
      </header>
      {committeeArt ? (
        <div style={{ fontSize: '0.85rem' }}>
          <div style={{ color: '#9aa0a6', fontSize: '0.75rem' }}>
            v{committeeArt.version} · {new Date(committeeArt.createdAt).toLocaleString()}
          </div>
          <pre style={preStyle}>{JSON.stringify(committeeArt.payload, null, 2).slice(0, 1200)}…</pre>
        </div>
      ) : <p style={{ color: '#9aa0a6' }}>No buying committee transcript yet.</p>}
    </div>
  );
}

function ValidationSection({ venture, recArt }: { venture: Venture; recArt: VentureArtifact | null }) {
  const rec = recArt?.payload as VentureRecommendation | undefined;
  return (
    <div style={card}>
      <header style={sectionHead}>
        <h3 style={h3}>Venture Validation (VentureLab)</h3>
        <a href={`/labs/venture?ventureId=${encodeURIComponent(venture.ventureId)}`} style={primaryBtnSm}>
          {rec ? 'Re-analyse →' : 'Analyse →'}
        </a>
      </header>
      {rec ? (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ ...badge, fontSize: '0.85rem', padding: '0.25rem 0.75rem',
              background: rec.decision === 'PROCEED' ? '#56c59622' : rec.decision === 'PIVOT' ? '#f3b35022' : '#ef6a6a22',
              color: rec.decision === 'PROCEED' ? '#56c596' : rec.decision === 'PIVOT' ? '#f3b350' : '#ef6a6a',
            }}>{rec.decision}</span>
            <span style={{ color: '#9aa0a6', fontSize: '0.85rem' }}>
              Score {rec.overallScore}/100 · Confidence {Math.round(rec.confidenceScore * 100)}%
            </span>
          </div>
          <p style={{ fontSize: '0.9rem' }}>{rec.executiveSummary}</p>
          {rec.decisionRationale.length > 0 && (
            <>
              <h4 style={h4}>Decision rationale</h4>
              <ol style={{ paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                {rec.decisionRationale.map((d, i) => <li key={i}>{d}</li>)}
              </ol>
            </>
          )}
        </>
      ) : <p style={{ color: '#9aa0a6' }}>No recommendation yet. Run VentureLab.</p>}
    </div>
  );
}

function BuildSquadSection({ venture, packArt, recArt, researchArt, personasArt }: {
  venture: Venture; packArt: VentureArtifact | null;
  recArt: VentureArtifact | null; researchArt: VentureArtifact | null; personasArt: VentureArtifact | null;
}) {
  const pack = packArt?.payload as BuildSquadArtifactPack | undefined;
  const canRun = !!recArt;
  const [showExport, setShowExport] = useState(false);
  return (
    <div style={card}>
      <header style={sectionHead}>
        <h3 style={h3}>BuildSquad</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {pack ? (
            <button onClick={() => setShowExport((v) => !v)} style={primaryBtnSm}>
              {showExport ? 'Hide export →' : 'Export to GitHub →'}
            </button>
          ) : null}
          <a
            href={canRun ? `/labs/buildsquad?ventureId=${encodeURIComponent(venture.ventureId)}` : '#'}
            onClick={(e) => { if (!canRun) e.preventDefault(); }}
            style={{ ...primaryBtnSm, opacity: canRun ? 1 : 0.4, cursor: canRun ? 'pointer' : 'not-allowed' }}
            title={canRun ? '' : 'Generate a recommendation first.'}
          >
            {pack ? 'Re-run BuildSquad →' : 'Plan with BuildSquad →'}
          </a>
        </div>
      </header>
      {!recArt && <p style={{ color: '#9aa0a6' }}>BuildSquad needs a VentureLab recommendation first.</p>}
      {!personasArt && recArt && <p style={{ color: '#f3b350', fontSize: '0.85rem' }}>Tip: persona set + research graph improve BuildSquad output quality.</p>}
      {!researchArt && recArt && <p style={{ color: '#f3b350', fontSize: '0.85rem' }}>Tip: a research graph adds grounding for the architect.</p>}
      {pack ? (
        <>
          <div style={{ color: '#9aa0a6', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            v{packArt!.version} · mode {pack.mode} · {new Date(packArt!.createdAt).toLocaleString()}
          </div>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}><strong>Vision:</strong> {pack.productVision.problem}</p>
          {pack.userStories && (
            <p style={{ fontSize: '0.85rem', color: '#9aa0a6' }}>
              {pack.userStories.length} user stories · {pack.agentCritiques.length} agent critiques
            </p>
          )}
          {showExport ? (
            <ExportToGithubPanel ventureId={venture.ventureId} defaultRepoName={defaultRepoName(venture.title)} />
          ) : null}
        </>
      ) : <p style={{ color: '#9aa0a6' }}>No BuildSquad pack yet.</p>}
    </div>
  );
}

function defaultRepoName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || 'venture-export';
}

interface GithubProfileLite {
  id: string;
  providerType: string;
  displayName: string;
  validationStatus: string;
}

function ExportToGithubPanel({ ventureId, defaultRepoName: dflt }: { ventureId: string; defaultRepoName: string }) {
  const [profiles, setProfiles] = useState<GithubProfileLite[]>([]);
  const [credId, setCredId] = useState<string>('');
  const [repoName, setRepoName] = useState<string>(dflt);
  const [org, setOrg] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/byok/providers', { cache: 'no-store' });
        const body = (await r.json()) as { profiles?: GithubProfileLite[] };
        const github = (body.profiles ?? []).filter((p) => p.providerType === 'github' && p.validationStatus === 'active');
        setProfiles(github);
        if (github.length > 0) setCredId(github[0]!.id);
      } catch {
        setProfiles([]);
      }
    })();
  }, []);

  async function submit() {
    setError(null);
    if (!credId) { setError('Add a GitHub PAT in Settings → BYOK first.'); return; }
    if (!repoName) { setError('Repo name is required.'); return; }
    setBusy(true);
    try {
      const resp = await fetch(`/api/ventures/${ventureId}/export/github`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          providerCredentialId: credId,
          repoName,
          ...(org ? { org } : {}),
          private: isPrivate,
        }),
      });
      const body = (await resp.json()) as { ok: boolean; jobId?: string; reason?: string };
      if (!body.ok) { setError(body.reason ?? 'Export failed.'); return; }
      setJobId(body.jobId ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: '1rem', padding: '0.75rem', border: '1px solid #1c1c20', borderRadius: 6 }}>
      <h4 style={{ margin: '0 0 0.5rem' }}>Export to GitHub</h4>
      {profiles.length === 0 ? (
        <p style={{ color: '#f3b350', fontSize: '0.85rem', margin: 0 }}>
          No active GitHub PAT. <a href="/settings/byok" style={{ color: '#7aa3ff' }}>Add one in BYOK</a>.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem' }}>
              Credential
              <select value={credId} onChange={(e) => setCredId(e.target.value)} style={selectStyle}>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.85rem' }}>
              Repo name
              <input value={repoName} onChange={(e) => setRepoName(e.target.value)} style={selectStyle} />
            </label>
            <label style={{ fontSize: '0.85rem' }}>
              Org (optional — leave blank for personal account)
              <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="my-org" style={selectStyle} />
            </label>
            <label style={{ fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private repo
            </label>
          </div>
          {error ? <p style={{ color: '#ef6a6a', fontSize: '0.85rem' }}>{error}</p> : null}
          <button onClick={() => void submit()} disabled={busy} style={{ ...primaryBtnSm, marginTop: '0.5rem' }}>
            {busy ? 'Enqueuing…' : 'Create repo →'}
          </button>
          {jobId ? (
            <div style={{ marginTop: '0.75rem' }}>
              <JobProgress jobId={jobId} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.25rem',
  padding: '0.4rem 0.5rem',
  background: '#1a1a1f',
  color: '#e7e7ea',
  border: '1px solid #2a2a30',
  borderRadius: 4,
  fontSize: '0.85rem',
};

function HistorySection({ events }: { events: VentureTimelineEvent[] }) {
  if (events.length === 0) {
    return <div style={card}><p style={{ color: '#9aa0a6' }}>No events yet.</p></div>;
  }
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div style={card}>
      <h3 style={h3}>Timeline</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {sorted.map((e) => (
          <li key={e.eventId} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid #1c1c20' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7aa3ff', marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem' }}>{e.label}</div>
              <div style={{ color: '#7a8088', fontSize: '0.7rem' }}>{e.eventKind} · {new Date(e.at).toLocaleString()}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArtifactsSection({ artifacts }: { artifacts: VentureArtifact[] }) {
  if (artifacts.length === 0) {
    return <div style={card}><p style={{ color: '#9aa0a6' }}>No artifacts attached yet.</p></div>;
  }
  const sorted = [...artifacts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div style={card}>
      <h3 style={h3}>Artifact registry</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ color: '#9aa0a6', textAlign: 'left' }}>
            <th style={th}>Kind</th><th style={th}>v</th><th style={th}>Summary</th><th style={th}>Created</th><th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.artifactId} style={{ borderTop: '1px solid #1c1c20' }}>
              <td style={td}>{ARTIFACT_LABEL[a.artifactKind]}</td>
              <td style={td}>{a.version}</td>
              <td style={td}>{a.summary}</td>
              <td style={td}>{new Date(a.createdAt).toLocaleString()}</td>
              <td style={td}><button style={ghostBtnSm} onClick={() => download(a)}>JSON</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function download(a: VentureArtifact) {
  const blob = new Blob([JSON.stringify(a, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${a.artifactKind}-v${a.version}-${a.artifactId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function latestOf(arts: VentureArtifact[], kind: VentureArtifactKind): VentureArtifact | null {
  const list = arts.filter((a) => a.artifactKind === kind);
  if (list.length === 0) return null;
  return list.reduce((a, b) => (a.version >= b.version ? a : b));
}

function Ring({ score }: { score: number }) {
  const r = 32; const c = 2 * Math.PI * r; const off = c - (score / 100) * c;
  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      <circle cx={40} cy={40} r={r} fill="none" stroke="#2a2a2a" strokeWidth={6} />
      <circle cx={40} cy={40} r={r} fill="none" stroke="#56c596" strokeWidth={6} strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 40 40)" strokeLinecap="round" />
      <text x={40} y={45} textAnchor="middle" fontSize={18} fill="#e8e8ea" fontWeight={600}>{score}</text>
    </svg>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#9aa0a6' }}>
        <span>{label}</span><span>{value}</span>
      </div>
      <div style={{ height: 5, background: '#2a2a2a', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${value}%`, background: '#7aa3ff', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...card, padding: '0.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', color: '#9aa0a6' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const card: React.CSSProperties = { border: '1px solid #2a2a2a', borderRadius: 8, padding: '1rem', background: '#101015' };
const badge: React.CSSProperties = { fontSize: '0.7rem', padding: '0.15rem 0.6rem', borderRadius: 999, border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.04em' };
const h3: React.CSSProperties = { margin: '0 0 0.6rem', fontSize: '0.95rem' };
const h4: React.CSSProperties = { margin: '0.75rem 0 0.25rem', fontSize: '0.8rem', color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: '0.05em' };
const sectionHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' };
const inputStyle: React.CSSProperties = { padding: '0.4rem 0.5rem', background: '#101015', color: '#e8e8ea', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: '0.85rem' };
const primaryBtnSm: React.CSSProperties = { padding: '0.4rem 0.75rem', background: '#7aa3ff', color: '#0b0b0e', borderRadius: 6, fontWeight: 600, textDecoration: 'none', fontSize: '0.8rem' };
const ghostBtnSm: React.CSSProperties = { padding: '0.2rem 0.5rem', background: 'transparent', color: '#9aa0a6', border: '1px solid #2a2a2a', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
const th: React.CSSProperties = { padding: '0.4rem 0.5rem', fontWeight: 500, fontSize: '0.75rem' };
const td: React.CSSProperties = { padding: '0.4rem 0.5rem', verticalAlign: 'top' };
const preStyle: React.CSSProperties = { background: '#0b0b0e', padding: '0.5rem', borderRadius: 4, fontSize: '0.7rem', maxHeight: 240, overflow: 'auto', color: '#cbcbd1' };
const tab = (active: boolean): React.CSSProperties => ({
  padding: '0.5rem 0.85rem', background: 'transparent', border: 'none',
  borderBottom: active ? '2px solid #7aa3ff' : '2px solid transparent',
  color: active ? '#e8e8ea' : '#9aa0a6', cursor: 'pointer',
  fontSize: '0.85rem', textTransform: 'capitalize',
});
