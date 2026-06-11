'use client';

/**
 * Venture Workspace — the central product surface (Sprint 2: Real productization).
 *
 * Eight tabs render every artifact as readable product content (never raw JSON
 * by default): Overview, Personas, Research, Validation, Build Plan, Evaluation,
 * Timeline, Artifacts. The Overview computes the next best action from the
 * artifacts present and surfaces active jobs + GitHub export status. Evaluation
 * is rendered client-side from the loaded artifacts via the same pure renderer
 * Real Mode's GitHub export uses.
 *
 * Preserves: Venture as the domain object, VentureJob as the async primitive,
 * BYOK-only GitHub export (no secrets in the browser).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  BuildSquadArtifactPack,
  BuyingCommitteeTranscript,
  GitHubRepoArtifactPayload,
  PersonaLabPersona,
  ResearchGraph,
  VentureArtifact,
  VentureArtifactKind,
  VentureJob,
  VentureRecommendation,
  VentureStatus,
  VentureSummary,
  VentureTimelineEvent,
} from '@ventureos/contracts';

import { JobProgress } from '../../../components/JobProgress';
import { RecentJobs } from '../../../components/RecentJobs';
import { GithubExportPanel } from '../../../components/GithubExportPanel';
import {
  ArtifactsView,
  Bar,
  BuildPlanView,
  CommitteeView,
  cx,
  DecisionBadge,
  EmptyState,
  EvaluationView,
  fmtTime,
  PersonaCards,
  ResearchGraphView,
  ScoreRing,
  styles,
  TimelineView,
  ValidationView,
  VentureStatusBadge,
} from '../../../components/artifacts';
import { buildEvaluationFromArtifacts } from '../../../lib/evaluation';

const STATUSES: VentureStatus[] = [
  'draft', 'researching', 'validating', 'pivoting', 'approved', 'building', 'archived', 'rejected',
];

type Tab =
  | 'overview' | 'personas' | 'research' | 'validation'
  | 'buildplan' | 'evaluation' | 'timeline' | 'artifacts';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'personas', label: 'Personas' },
  { key: 'research', label: 'Research' },
  { key: 'validation', label: 'Validation' },
  { key: 'buildplan', label: 'Build Plan' },
  { key: 'evaluation', label: 'Evaluation' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'artifacts', label: 'Artifacts' },
];

interface DerivedArtifacts {
  personas: PersonaLabPersona[] | null;
  graph: ResearchGraph | null;
  rec: VentureRecommendation | null;
  pack: BuildSquadArtifactPack | null;
  committee: BuyingCommitteeTranscript | null;
  github: GitHubRepoArtifactPayload | null;
  has: { personas: boolean; graph: boolean; rec: boolean; pack: boolean; committee: boolean; github: boolean };
}

interface Props { params: { id: string } }

export default function VentureWorkspacePage({ params }: Props) {
  const [summary, setSummary] = useState<VentureSummary | null>(null);
  const [artifacts, setArtifacts] = useState<VentureArtifact[]>([]);
  const [events, setEvents] = useState<VentureTimelineEvent[]>([]);
  const [jobs, setJobs] = useState<VentureJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, a, t, j] = await Promise.all([
        fetch(`/api/ventures/${params.id}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/ventures/${params.id}/artifacts`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/ventures/${params.id}/timeline`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/ventures/${params.id}/jobs?limit=25`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (!s.ok) { setError(s.reason ?? 'Failed to load venture.'); return; }
      setSummary(s.summary as VentureSummary);
      setArtifacts((a.ok ? a.artifacts : []) as VentureArtifact[]);
      setEvents((t.ok ? t.events : []) as VentureTimelineEvent[]);
      setJobs((j.ok ? j.jobs : []) as VentureJob[]);
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

  const derived = useMemo<DerivedArtifacts>(() => {
    const personasArt = latestOf(artifacts, 'persona_set');
    const researchArt = latestOf(artifacts, 'research_graph');
    const recArt = latestOf(artifacts, 'venture_recommendation');
    const packArt = latestOf(artifacts, 'buildsquad_pack');
    const committeeArt = latestOf(artifacts, 'buying_committee');
    const githubArt = latestOf(artifacts, 'github_repo');
    return {
      personas: (personasArt?.payload as PersonaLabPersona[] | undefined) ?? null,
      graph: (researchArt?.payload as ResearchGraph | undefined) ?? null,
      rec: (recArt?.payload as VentureRecommendation | undefined) ?? null,
      pack: (packArt?.payload as BuildSquadArtifactPack | undefined) ?? null,
      committee: (committeeArt?.payload as BuyingCommitteeTranscript | undefined) ?? null,
      github: (githubArt?.payload as GitHubRepoArtifactPayload | undefined) ?? null,
      has: {
        personas: !!personasArt, graph: !!researchArt, rec: !!recArt,
        pack: !!packArt, committee: !!committeeArt, github: !!githubArt,
      },
    };
  }, [artifacts]);

  const evaluation = useMemo(() => {
    if (!summary) return null;
    return buildEvaluationFromArtifacts({
      venture: summary.venture,
      readiness: summary.readiness,
      personas: derived.personas,
      graph: derived.graph,
      recommendation: derived.rec,
      committee: derived.committee,
      pack: derived.pack,
      sourceArtifacts: artifacts.map((a) => ({ kind: a.artifactKind, version: a.version })),
    });
  }, [summary, artifacts, derived]);

  if (error) return <p style={{ padding: '1.5rem', color: '#ef6a6a' }}>{error}</p>;
  if (!summary) return <p style={{ padding: '1.5rem', color: '#9aa0a6' }}>Loading…</p>;

  const v = summary.venture;
  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running');

  return (
    <section className={cx(styles.scope)} style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <a href="/ventures" style={{ color: '#7aa3ff', fontSize: '0.85rem', textDecoration: 'none' }}>← My Ventures</a>
          <h1 style={{ margin: '0.25rem 0' }}>{v.title}</h1>
          {v.description && <p style={{ color: '#9aa0a6', margin: 0 }}>{v.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <VentureStatusBadge status={v.status} />
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
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={tabStyle(tab === key)}>{label}</button>
        ))}
      </nav>

      <div style={{ marginTop: '1.25rem' }}>
        {tab === 'overview' && (
          <OverviewTab
            summary={summary}
            derived={derived}
            activeJobs={activeJobs}
            onJobChange={() => void load()}
            onGoToTab={setTab}
          />
        )}

        {tab === 'personas' && (
          derived.personas && derived.personas.length > 0 ? (
            <div className={cx(styles.stack)}>
              <PersonaCards personas={derived.personas} />
              {derived.committee ? (
                <div>
                  <h2 className={cx(styles.cardTitle)} style={{ margin: '0.5rem 0 0.75rem', fontSize: '1.05rem' }}>Buying committee</h2>
                  <CommitteeView committee={derived.committee} personas={derived.personas} />
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon="👥"
              title="No personas yet"
              text="Generate a synthetic persona set and buying committee to ground every downstream decision."
              action={{ href: `/labs/persona?ventureId=${encodeURIComponent(v.ventureId)}`, label: 'Generate personas →' }}
            />
          )
        )}

        {tab === 'research' && (
          derived.graph ? (
            <ResearchGraphView graph={derived.graph} />
          ) : (
            <EmptyState
              icon="🕸"
              title="No research graph yet"
              text="Build a research graph to surface god-nodes, contradictions and the strongest market signals."
              action={{ href: `/labs/research-graph?ventureId=${encodeURIComponent(v.ventureId)}`, label: 'Build research graph →' }}
            />
          )
        )}

        {tab === 'validation' && (
          derived.rec ? (
            <ValidationView recommendation={derived.rec} />
          ) : (
            <EmptyState
              icon="⚖"
              title="No recommendation yet"
              text="Run VentureLab to get a Proceed / Pivot / Kill call with a scorecard, evidence and a validation roadmap."
              action={{ href: `/labs/venture?ventureId=${encodeURIComponent(v.ventureId)}`, label: 'Run VentureLab →' }}
            />
          )
        )}

        {tab === 'buildplan' && (
          derived.pack ? (
            <div className={cx(styles.stack)}>
              <BuildPlanView pack={derived.pack} />
              <GithubExportPanel
                ventureId={v.ventureId}
                defaultRepoName={defaultRepoName(v.title)}
                github={derived.github}
                onJobChange={() => void load()}
              />
            </div>
          ) : (
            <EmptyState
              icon="🛠"
              title="No build plan yet"
              text={derived.has.rec
                ? 'Generate a BuildSquad pack to turn the recommendation into a PRD, MVP scope, user stories and an architecture brief.'
                : 'BuildSquad needs a VentureLab recommendation first. Run VentureLab, then come back here.'}
              action={derived.has.rec
                ? { href: `/labs/buildsquad?ventureId=${encodeURIComponent(v.ventureId)}`, label: 'Generate BuildSquad plan →' }
                : { href: `/labs/venture?ventureId=${encodeURIComponent(v.ventureId)}`, label: 'Run VentureLab →' }}
            />
          )
        )}

        {tab === 'evaluation' && evaluation && (
          <EvaluationView report={evaluation.report} markdown={evaluation.markdown} />
        )}

        {tab === 'timeline' && (
          events.length > 0 ? (
            <TimelineView events={events} />
          ) : (
            <EmptyState icon="🕗" title="No timeline events yet" text="Events appear here as jobs run and artifacts are created." />
          )
        )}

        {tab === 'artifacts' && (
          artifacts.length > 0 ? (
            <ArtifactsView artifacts={artifacts} events={events} />
          ) : (
            <EmptyState icon="📦" title="No artifacts yet" text="Run a lab to produce your first artifact — it will be registered here with full provenance." />
          )
        )}
      </div>
    </section>
  );
}

function OverviewTab({
  summary, derived, activeJobs, onJobChange, onGoToTab,
}: {
  summary: VentureSummary;
  derived: DerivedArtifacts;
  activeJobs: VentureJob[];
  onJobChange: () => void;
  onGoToTab: (t: Tab) => void;
}) {
  const v = summary.venture;
  const vid = encodeURIComponent(v.ventureId);
  const r = summary.readiness;

  const steps: { key: string; label: string; href: string | null; done: boolean; enabled: boolean; goTab: Tab }[] = [
    { key: 'personas', label: 'Generate personas', href: `/labs/persona?ventureId=${vid}`, done: derived.has.personas, enabled: true, goTab: 'personas' },
    { key: 'research', label: 'Build research graph', href: `/labs/research-graph?ventureId=${vid}`, done: derived.has.graph, enabled: true, goTab: 'research' },
    { key: 'validation', label: 'Run VentureLab', href: `/labs/venture?ventureId=${vid}`, done: derived.has.rec, enabled: true, goTab: 'validation' },
    { key: 'buildplan', label: 'Generate BuildSquad plan', href: `/labs/buildsquad?ventureId=${vid}`, done: derived.has.pack, enabled: derived.has.rec, goTab: 'buildplan' },
    { key: 'export', label: 'Export to GitHub', href: null, done: derived.has.github, enabled: derived.has.pack, goTab: 'buildplan' },
  ];
  const next = steps.find((s) => !s.done && s.enabled) ?? steps.find((s) => !s.done) ?? null;
  const missing = steps.filter((s) => !s.done);

  return (
    <div className={cx(styles.stack)}>
      <div className={cx(styles.grid2)}>
        <div className={cx(styles.card)}>
          <p className={cx(styles.cardTitle)}>Readiness</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <ScoreRing value={r.overall} />
            <div style={{ flex: 1 }}>
              <Bar label="Persona coverage" value={r.personaCoverage} />
              <Bar label="Research coverage" value={r.researchCoverage} />
              <Bar label="Validation confidence" value={r.validationConfidence} />
              <Bar label="BuildSquad completeness" value={r.buildsquadCompleteness} />
              <Bar label="Risk coverage" value={r.riskCoverage} />
            </div>
          </div>
          {r.warnings.length > 0 && (
            <ul style={{ marginTop: '0.75rem', color: '#f3b350', fontSize: '0.8rem', paddingLeft: '1.1rem' }}>
              {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>

        <div className={cx(styles.stack)}>
          <div className={cx(styles.card)}>
            <p className={cx(styles.cardTitle)}>Next best action</p>
            {next ? (
              <>
                <p className={cx(styles.docText)} style={{ marginBottom: '0.75rem' }}>
                  {next.enabled
                    ? `${next.label} to keep moving toward build-ready.`
                    : `${next.label} is blocked — complete the previous step first.`}
                </p>
                {next.href ? (
                  <a className={cx(styles.btn, styles.btnPrimary)} href={next.href}>{next.label} →</a>
                ) : (
                  <button className={cx(styles.btn, styles.btnPrimary)} onClick={() => onGoToTab(next.goTab)}>{next.label} →</button>
                )}
              </>
            ) : (
              <p className={cx(styles.docText)}>🎉 This venture is build-ready and exported. Nothing else is required.</p>
            )}
            {missing.length > 0 && (
              <div className={cx(styles.chipRow)} style={{ marginTop: '0.85rem' }}>
                {missing.map((s) => (
                  s.href ? (
                    <a key={s.key} className={cx(styles.btn, styles.btnGhost, !s.enabled && styles.btnDisabled)}
                       href={s.enabled ? s.href : undefined}
                       aria-disabled={!s.enabled}
                       onClick={(e) => { if (!s.enabled) e.preventDefault(); }}>
                      {s.label}
                    </a>
                  ) : (
                    <button key={s.key} className={cx(styles.btn, styles.btnGhost, !s.enabled && styles.btnDisabled)}
                            disabled={!s.enabled} onClick={() => onGoToTab(s.goTab)}>
                      {s.label}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>

          <div className={cx(styles.card)}>
            <p className={cx(styles.cardTitle)}>GitHub export</p>
            {derived.github ? (
              <>
                <p className={cx(styles.docText)} style={{ marginBottom: '0.4rem' }}>
                  Exported to <strong>{derived.github.owner}/{derived.github.name}</strong> · {derived.github.files.length} files on <code className={cx(styles.mono)}>{derived.github.defaultBranch}</code>
                  {' · commit '}<code className={cx(styles.mono)}>{derived.github.commitSha.slice(0, 7)}</code>.
                </p>
                <a className={cx(styles.btn, styles.btnPrimary)} href={derived.github.htmlUrl} target="_blank" rel="noreferrer">Open repository →</a>
              </>
            ) : (
              <p className={cx(styles.muted)}>Not exported yet. Generate a BuildSquad plan, then export repo-ready artifacts to GitHub with your BYOK PAT.</p>
            )}
          </div>
        </div>
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>Latest recommendation</p>
        {summary.latestRecommendation ? (
          <div className={cx(styles.chipRow)} style={{ alignItems: 'center' }}>
            <DecisionBadge decision={summary.latestRecommendation.decision} />
            <span className={cx(styles.muted)}>
              Score {summary.latestRecommendation.overallScore}/100 · Confidence {Math.round(summary.latestRecommendation.confidenceScore * 100)}% · {fmtTime(summary.latestRecommendation.createdAt)}
            </span>
            <span className={cx(styles.jobSpacer)} />
            <button className={cx(styles.btn, styles.btnGhost)} onClick={() => onGoToTab('validation')}>View validation →</button>
          </div>
        ) : (
          <p className={cx(styles.muted)}>No recommendation yet. Run VentureLab to get a Proceed / Pivot / Kill call.</p>
        )}
      </div>

      <div className={cx(styles.card)}>
        <p className={cx(styles.cardTitle)}>{activeJobs.length > 0 ? `Active jobs (${activeJobs.length})` : 'Recent jobs'}</p>
        {activeJobs.length > 0 ? (
          <div className={cx(styles.stack)}>
            {activeJobs.map((j) => <JobProgress key={j.jobId} jobId={j.jobId} onCancel={onJobChange} />)}
          </div>
        ) : (
          <RecentJobs ventureId={v.ventureId} />
        )}
      </div>
    </div>
  );
}

function defaultRepoName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || 'venture-export';
}

function latestOf(arts: VentureArtifact[], kind: VentureArtifactKind): VentureArtifact | null {
  const list = arts.filter((a) => a.artifactKind === kind);
  if (list.length === 0) return null;
  return list.reduce((a, b) => (a.version >= b.version ? a : b));
}

const inputStyle: React.CSSProperties = { padding: '0.4rem 0.5rem', background: '#101015', color: '#e8e8ea', border: '1px solid #2a2a2a', borderRadius: 6, fontSize: '0.85rem' };
const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.5rem 0.85rem', background: 'transparent', border: 'none',
  borderBottom: active ? '2px solid #7aa3ff' : '2px solid transparent',
  color: active ? '#e8e8ea' : '#9aa0a6', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap',
});
