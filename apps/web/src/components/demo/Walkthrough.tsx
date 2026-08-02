import Link from 'next/link';

import type {
  BuyingCommitteeTranscript,
  CommitteePosition,
  CommitteeStance,
  PersonaLabPersona,
  ResearchGraph,
  ScoreDimension,
  VentureRecommendation,
  VentureTimelineEvent,
  VentureTimelineEventKind,
} from '@foundry/contracts';

import type { DemoVenture } from '../../lib/demo/types';
import type { DemoEvaluation, DemoExportFile } from '../../lib/demo/render';
import { CopyButton } from './CopyButton';
import { ReadinessRing } from './ReadinessRing';
import styles from './demo.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/** Join class names, coercing the `string | undefined` CSS-module values
 * (the workspace enables `noUncheckedIndexedAccess`) to a single string. */
function cx(...names: Array<string | undefined | false>): string {
  return names.filter(Boolean).join(' ');
}

function prob(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  problemStrength: 'Problem strength',
  buyerUrgency: 'Buyer urgency',
  willingnessToPay: 'Willingness to pay',
  differentiation: 'Differentiation',
  adoptionFriction: 'Adoption friction',
  committeeConfidence: 'Committee confidence',
  executionRisk: 'Execution risk',
  marketClarity: 'Market clarity',
};

const POSITION_LABELS: Record<CommitteePosition, string> = {
  support: 'Support',
  support_with_concerns: 'Support, with concerns',
  pilot_first: 'Pilot first',
  reject: 'Reject',
};

function positionClass(p: CommitteePosition): string {
  if (p === 'support') return cx(styles.proceed);
  if (p === 'support_with_concerns') return cx(styles.running);
  if (p === 'pilot_first') return cx(styles.pivot);
  return cx(styles.kill);
}

function stanceClass(s: CommitteeStance): string {
  if (s === 'champion') return cx(styles.proceed);
  if (s === 'supporter') return cx(styles.running);
  if (s === 'skeptic') return cx(styles.pivot);
  if (s === 'blocker') return cx(styles.kill);
  return cx(styles.neutral);
}

function decisionClass(d: string): string {
  const up = d.toUpperCase();
  if (up === 'PROCEED' || up === 'BUY') return cx(styles.proceed);
  if (up === 'PIVOT' || up === 'DEFER') return cx(styles.pivot);
  if (up === 'KILL' || up === 'REJECT') return cx(styles.kill);
  if (up === 'PILOT') return cx(styles.running);
  return cx(styles.neutral);
}

function scoreColor(score: number, higherIsBetter: boolean): string {
  const good = higherIsBetter ? score >= 70 : score <= 45;
  const bad = higherIsBetter ? score < 45 : score > 70;
  if (good) return cx(styles.barFillGreen);
  if (bad) return cx(styles.barFill); // blue baseline, avoids alarming red on intentional risk axes
  return cx(styles.barFillAmber);
}

const STEP_NAV: { id: string; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'idea', label: 'Idea' },
  { id: 'personas', label: 'Personas' },
  { id: 'committee', label: 'Buying Committee' },
  { id: 'research', label: 'Research Graph' },
  { id: 'validation', label: 'Validation' },
  { id: 'buildplan', label: 'Build Plan' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'export', label: 'GitHub Export' },
  { id: 'timeline', label: 'Timeline' },
];

function personaName(personas: PersonaLabPersona[], id: string): string {
  return personas.find((p) => p.id === id)?.name ?? id;
}

interface WalkthroughProps {
  demo: DemoVenture;
  evaluation: DemoEvaluation;
  exportFiles: DemoExportFile[];
}

export function Walkthrough({ demo, evaluation, exportFiles }: WalkthroughProps) {
  const { venture, brief, personas, committee, research, recommendation, pack, summary, timeline } = demo;
  const r = summary.readiness;

  const pipeline = [
    { label: 'Idea', fill: 100 },
    { label: 'Personas', fill: r.personaCoverage },
    { label: 'Research', fill: r.researchCoverage },
    { label: 'Validation', fill: r.validationConfidence },
    { label: 'Build Plan', fill: r.buildsquadCompleteness },
    { label: 'Export', fill: 100 },
  ];

  return (
    <div className={styles.page}>
      <JudgeBanner />
      <DemoBanner />

      <div className={styles.swarmStrip} role="note" aria-label="Agent Swarms framing">
        <strong>Agent Swarms:</strong> persona, committee, research-graph, venture-validation,
        BuildSquad and evaluation agents collaborate on a shared Venture context to produce
        versioned, GitHub-ready artifacts.
      </div>

      <nav className={styles.stepNav} aria-label="Demo sections">
        {STEP_NAV.map((s) => (
          <a key={s.id} href={`#${s.id}`} className={styles.stepPill}>
            {s.label}
          </a>
        ))}
      </nav>

      {/* ───────── Overview ───────── */}
      <section id="overview" className={styles.section}>
        <div className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Demo Venture · End to end</p>
            <h1 className={styles.heroTitle}>{venture.title}</h1>
            <p className={styles.heroTagline}>{demo.tagline}</p>
            <div className={styles.heroMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Decision</span>
                <span className={styles.metaValue}>
                  <span className={`${styles.badge} ${decisionClass(recommendation.decision)}`}>
                    {recommendation.decision}
                  </span>
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Confidence</span>
                <span className={styles.metaValue}>{prob(recommendation.confidenceScore)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Status</span>
                <span className={styles.metaValue}>{venture.status}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Artifacts</span>
                <span className={styles.metaValue}>{summary.artifactCount}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Last updated</span>
                <span className={styles.metaValue}>{fmtTime(venture.updatedAt)}</span>
              </div>
            </div>
          </div>
          <ReadinessRing value={r.overall} caption="Readiness" />
        </div>

        <div className={styles.pipeline}>
          {pipeline.map((step, i) => (
            <div key={step.label} className={styles.pipeStep}>
              <div className={styles.pipeTop}>
                <span className={styles.pipeIdx}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.pipeCheck}>✓</span>
              </div>
              <span className={styles.pipeLabel}>{step.label}</span>
              <div className={styles.pipeTrack}>
                <div className={styles.pipeFill} style={{ width: `${step.fill}%` }} />
              </div>
              <span className={styles.pipePct}>{pct(step.fill)}</span>
            </div>
          ))}
        </div>

        <div className={styles.grid4}>
          <Coverage label="Persona coverage" value={r.personaCoverage} />
          <Coverage label="Research coverage" value={r.researchCoverage} />
          <Coverage label="Validation confidence" value={r.validationConfidence} />
          <Coverage label="Risk coverage" value={r.riskCoverage} />
        </div>

        <div className={styles.card}>
          <p className={styles.cardTitle}>Next best action</p>
          <p className={styles.docText}>
            {recommendation.nextSteps[0]?.title ?? 'Proceed to build planning.'}
          </p>
        </div>
      </section>

      {/* ───────── Idea ───────── */}
      <Section id="idea" kicker="Step 1" title="The idea" desc="The single thing a founder types in Real Mode. Everything below is generated by the agent swarm.">
        <div className={styles.card}>
          <p className={styles.cardTitle}>{brief.title}</p>
          <p className={styles.docText}>{brief.summary}</p>
          <div className={styles.grid2} style={{ marginTop: '0.9rem' }}>
            <Field label="Target market" value={brief.targetMarket} />
            <Field label="Wedge" value={brief.wedge} />
            <Field label="Business model" value={brief.businessModelHypothesis} />
            <div>
              <p className={styles.miniLabel}>Tags</p>
              <div className={styles.chipRow}>
                {(brief.tags ?? []).map((t) => (
                  <span key={t} className={styles.chip}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <p className={styles.miniLabel} style={{ marginTop: '0.9rem' }}>Founder assumptions</p>
          <ul className={styles.bullets}>
            {(brief.founderAssumptions ?? []).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ───────── Personas ───────── */}
      <Section
        id="personas"
        kicker="Step 2 · PersonaLab"
        title={`${personas.length} synthetic personas`}
        desc="Rendered as cards — never raw JSON. Each persona carries goals, pains, objections and a confidence score."
      >
        <div className={styles.personaGrid}>
          {personas.map((p) => (
            <article key={p.id} className={styles.personaCard}>
              <div className={styles.personaTop}>
                <div>
                  <h3 className={styles.personaName}>{p.name}</h3>
                  <span className={styles.personaRole}>{p.role}</span>
                </div>
                <ReadinessRing value={p.confidenceScore * 100} size={52} caption="" unit="" />
              </div>
              <p className={styles.personaCtx}>{p.businessContext}</p>
              <blockquote className={styles.personaQuote}>“{p.quote}”</blockquote>
              <div className={styles.grid2}>
                <div>
                  <p className={styles.miniLabel}>Goals</p>
                  <ul className={styles.bullets}>
                    {p.goals.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
                <div>
                  <p className={styles.miniLabel}>Pain points</p>
                  <ul className={styles.bullets}>
                    {p.painPoints.map((g, i) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              </div>
              <div>
                <p className={styles.miniLabel}>Objections</p>
                <ul className={styles.bullets}>
                  {p.objections.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
              <div className={styles.chipRow}>
                <span className={styles.chip}>Decision power: {p.decisionPower}</span>
                <span className={styles.chip}>Confidence: {prob(p.confidenceScore)}</span>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* ───────── Buying committee ───────── */}
      <CommitteeSection committee={committee} personas={personas} />

      {/* ───────── Research graph ───────── */}
      <ResearchSection research={research} />

      {/* ───────── Validation ───────── */}
      <ValidationSection recommendation={recommendation} />

      {/* ───────── Build plan ───────── */}
      <BuildPlanSection pack={pack} />

      {/* ───────── Evaluation ───────── */}
      <Section
        id="evaluation"
        kicker="Step 7 · Evaluation"
        title="Evaluation report"
        desc="A first-class artifact rendered from the real renderer. Readiness, coverage and provenance in one auditable document."
      >
        <div className={styles.grid4}>
          <Stat value={`${r.overall}`} label="Readiness" sub="/ 100" />
          <Stat value={prob(recommendation.confidenceScore)} label="Confidence" />
          <Stat value={pct(r.researchCoverage)} label="Research coverage" />
          <Stat value={pct(r.riskCoverage)} label="Risk coverage" />
        </div>
        <div className={styles.card}>
          <div className={styles.copyRow}>
            <p className={styles.cardTitle} style={{ margin: 0 }}>EVALUATION_REPORT.md</p>
            <CopyButton text={evaluation.markdown} />
          </div>
          <pre className={styles.markdown}>{evaluation.markdown}</pre>
        </div>
      </Section>

      {/* ───────── GitHub export ───────── */}
      <ExportSection demo={demo} files={exportFiles} />

      {/* ───────── Timeline ───────── */}
      <TimelineSection events={timeline} />

      {/* ───────── CTA ───────── */}
      <div className={styles.ctaCard}>
        <p className={styles.cardTitle} style={{ margin: 0 }}>Ready to run this for your own idea?</p>
        <p className={styles.sectionDesc}>
          Demo Mode used zero keys. Real Mode runs the same pipeline on your idea with your own BYOK
          provider keys and a real GitHub export.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/ventures/new" className={`${styles.btn} ${styles.btnPrimary}`}>Create a real venture →</Link>
          <Link href="/settings/byok" className={styles.btn}>Configure BYOK</Link>
          <Link href="/demo" className={styles.btnGhost + ' ' + styles.btn}>← All demos</Link>
        </div>
      </div>

      <p className={styles.demoFooterNote}>
        This is a seeded demo. Real Mode uses BYOK and real GitHub export.
      </p>
    </div>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

function DemoBanner() {
  return (
    <div className={styles.banner}>
      <span className={styles.bannerDot} />
      <span className={styles.bannerText}>
        <strong>Demo Mode</strong> — seeded data, no API keys used. Nothing here calls a provider or GitHub.
      </span>
      <span className={styles.bannerSpacer} />
      <Link href="/settings/byok" className={styles.bannerLink}>Switch to Real Mode (BYOK) →</Link>
    </div>
  );
}

function JudgeBanner() {
  return (
    <div
      className={styles.judgeBanner}
      role="note"
      aria-label="Judge guidance"
      data-testid="judge-banner"
    >
      <div className={styles.judgeBannerHead}>
        <span className={styles.judgeBannerBadge}>For judges</span>
        <span className={styles.judgeBannerTitle}>Recommended judge path · zero-key demo</span>
      </div>
      <p className={styles.judgeBannerBody}>
        This is the recommended judge path. It is a seeded zero-key demo and does not require
        sign-in, provider keys, Supabase setup or GitHub access.
      </p>
      <p className={styles.judgeBannerMuted}>
        Real Mode supports BYOK, Google sign-in, Alpha Workspace and real GitHub export for
        deeper testing.
      </p>
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  desc,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionKicker}>{kicker}</span>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {desc ? <p className={styles.sectionDesc}>{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className={styles.miniLabel}>{label}</p>
      <p className={styles.docText}>{value ?? '—'}</p>
    </div>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub ? <span className={styles.statSub}>{sub}</span> : null}
    </div>
  );
}

function Coverage({ label, value }: { label: string; value: number }) {
  const cls = value >= 70 ? styles.barFillGreen : value >= 45 ? styles.barFillAmber : styles.barFill;
  return (
    <div className={styles.stat}>
      <div className={styles.barHead}>
        <span className={styles.barLabel}>{label}</span>
        <span className={styles.barVal}>{pct(value)}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${cls}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function CommitteeSection({
  committee,
  personas,
}: {
  committee: BuyingCommitteeTranscript;
  personas: PersonaLabPersona[];
}) {
  const d = committee.deliberation;
  return (
    <Section
      id="committee"
      kicker="Step 3 · Buying Committee"
      title="Agentic deliberation"
      desc="Five persona-agents take positions, challenge each other, respond, and converge — with opinion changes tracked explicitly."
    >
      <div className={styles.card}>
        <p className={styles.cardTitle}>Offer under evaluation</p>
        <p className={styles.docText}>{committee.offerSummary}</p>
        <div className={styles.chipRow} style={{ marginTop: '0.7rem' }}>
          <span className={`${styles.badge} ${decisionClass(committee.decision)}`}>Decision: {committee.decision}</span>
          {d ? <span className={styles.chip}>Consensus: {d.consensusLevel}</span> : null}
          {d ? <span className={styles.chip}>Confidence: {prob(d.confidenceScore)}</span> : null}
        </div>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Members</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Persona</th><th>Committee role</th><th>Stance</th><th>Rationale</th></tr>
            </thead>
            <tbody>
              {committee.members.map((m) => (
                <tr key={m.personaId}>
                  <td>{personaName(personas, m.personaId)}</td>
                  <td>{m.committeeRole}</td>
                  <td><span className={`${styles.badge} ${stanceClass(m.stance)}`}>{m.stance}</span></td>
                  <td>{m.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {d ? (
        <>
          <div className={styles.grid2}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Initial positions</p>
              <div className={styles.timeline}>
                {d.phases.initialPositions.map((o) => (
                  <div key={o.personaId} className={styles.turn}>
                    <div className={styles.turnHead}>
                      <span className={styles.turnRole}>{personaName(personas, o.personaId)}</span>
                      <span className={`${styles.badge} ${positionClass(o.position)}`}>{POSITION_LABELS[o.position]}</span>
                      <span className={styles.turnMeta}>enthusiasm {prob(o.enthusiasm)}</span>
                    </div>
                    <p className={styles.turnText}>{o.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Final consensus</p>
              <div className={styles.timeline}>
                {d.phases.consensus.map((o) => (
                  <div key={o.personaId} className={styles.turn}>
                    <div className={styles.turnHead}>
                      <span className={styles.turnRole}>{personaName(personas, o.personaId)}</span>
                      <span className={`${styles.badge} ${positionClass(o.position)}`}>{POSITION_LABELS[o.position]}</span>
                      <span className={styles.turnMeta}>enthusiasm {prob(o.enthusiasm)}</span>
                    </div>
                    <p className={styles.turnText}>{o.willingnessToAdopt}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Challenges & responses</p>
            <div className={styles.timeline}>
              {d.phases.challenges.map((c, i) => {
                const resp = d.phases.responses.find((rr) => rr.challengeIndex === i);
                return (
                  <div key={i} className={styles.turn}>
                    <div className={styles.turnHead}>
                      <span className={styles.turnRole}>{personaName(personas, c.fromPersonaId)}</span>
                      <span className={styles.changeArrow}>→</span>
                      <span className={styles.turnRole}>{personaName(personas, c.toPersonaId)}</span>
                      <span className={styles.chip}>{c.topic}</span>
                    </div>
                    <p className={styles.turnText}>{c.argument}</p>
                    {resp ? (
                      <p className={styles.turnMeta}>
                        ↳ <strong>{personaName(personas, resp.fromPersonaId)}</strong>: {resp.argument}
                        {resp.changedOpinion ? ' (changed position)' : ''}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {d.opinionChanges.length ? (
            <div className={styles.card}>
              <p className={styles.cardTitle}>Opinion changes</p>
              {d.opinionChanges.map((c, i) => (
                <div key={i} className={styles.changeRow}>
                  <strong>{personaName(personas, c.personaId)}</strong>
                  <span className={`${styles.badge} ${positionClass(c.fromPosition)}`}>{POSITION_LABELS[c.fromPosition]}</span>
                  <span className={styles.changeArrow}>→</span>
                  <span className={`${styles.badge} ${positionClass(c.toPosition)}`}>{POSITION_LABELS[c.toPosition]}</span>
                  <span>{c.reason}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.consensus}>
            <p className={styles.cardTitle}>Why pilot, not buy</p>
            <p className={styles.docText}>{committee.decisionRationale}</p>
            <div className={styles.grid2} style={{ marginTop: '0.8rem' }}>
              <div>
                <p className={styles.miniLabel}>Strongest supporting</p>
                <ul className={styles.bullets}>
                  {d.strongestSupportingArguments.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
              <div>
                <p className={styles.miniLabel}>Strongest opposing</p>
                <ul className={styles.bullets}>
                  {d.strongestOpposingArguments.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Section>
  );
}

function ResearchSection({ research }: { research: ResearchGraph }) {
  const nodes = research.nodes ?? [];
  const topNodes = [...nodes].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 6);
  return (
    <Section
      id="research"
      kicker="Step 4 · Research Graph"
      title="Research graph"
      desc="Evidence extracted from sources into a typed graph. God-nodes are the highest-leverage concepts; contradictions are surfaced, not hidden."
    >
      <div className={styles.grid4}>
        <Stat value={`${research.stats.nodes}`} label="Nodes" />
        <Stat value={`${research.stats.edges}`} label="Edges" />
        <Stat value={`${research.godNodes.length}`} label="God-nodes" />
        <Stat value={`${research.contradictions?.length ?? 0}`} label="Contradictions" />
      </div>

      <div className={styles.grid2}>
        <div className={styles.card}>
          <p className={styles.cardTitle}>God-nodes (highest centrality)</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Concept</th><th>Degree</th><th>Community</th></tr></thead>
              <tbody>
                {research.godNodes.map((g) => (
                  <tr key={g.label}><td>{g.label}</td><td>{g.degree}</td><td>{g.community}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.card}>
          <p className={styles.cardTitle}>Strongest signals</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Signal</th><th>Type</th><th>Conf.</th></tr></thead>
              <tbody>
                {topNodes.map((n) => (
                  <tr key={n.id}><td>{n.label}</td><td className={styles.mono}>{n.type}</td><td>{prob(n.confidence)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {research.contradictions?.length ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Contradictions</p>
          <ul className={styles.bullets}>
            {research.contradictions.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function ValidationSection({ recommendation }: { recommendation: VentureRecommendation }) {
  return (
    <Section
      id="validation"
      kicker="Step 5 · VentureLab"
      title="Validation & recommendation"
      desc="A deterministic rule engine scores eight dimensions, then PROCEED / PIVOT / KILL is computed — with evidence, counter-signals, risks and a validation roadmap."
    >
      <div className={styles.card}>
        <div className={styles.copyRow}>
          <span className={`${styles.badge} ${decisionClass(recommendation.decision)}`} style={{ fontSize: '0.9rem' }}>
            {recommendation.decision}
          </span>
          <span className={styles.barVal}>Score {recommendation.overallScore}/100 · Confidence {prob(recommendation.confidenceScore)}</span>
        </div>
        <p className={styles.docText} style={{ marginTop: '0.6rem' }}>{recommendation.executiveSummary}</p>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Scorecard</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {recommendation.scores.map((s) => (
            <div key={s.dimension} className={styles.bar}>
              <div className={styles.barHead}>
                <span className={styles.barLabel}>
                  {DIMENSION_LABELS[s.dimension]}
                  {!s.higherIsBetter ? <span className={styles.chip} style={{ marginLeft: '0.4rem' }}>lower is better</span> : null}
                </span>
                <span className={styles.barVal}>{s.score}/100</span>
              </div>
              <div className={styles.barTrack}>
                <div className={`${styles.barFill} ${scoreColor(s.score, s.higherIsBetter)}`} style={{ width: `${s.score}%` }} />
              </div>
              <span className={styles.statSub}>{s.explanation}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.grid2}>
        <div className={styles.card}>
          <p className={styles.cardTitle}>Supporting evidence</p>
          <ul className={styles.bullets}>
            {recommendation.evidence.map((e, i) => (
              <li key={i}>“{e.quote}” <span className={styles.statSub}>— {e.source}</span></li>
            ))}
          </ul>
        </div>
        <div className={styles.card}>
          <p className={styles.cardTitle}>Counter-signals</p>
          <ul className={styles.bullets}>
            {recommendation.counterSignals.map((e, i) => (
              <li key={i}>“{e.quote}” <span className={styles.statSub}>— {e.source}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Key assumptions</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Assumption</th><th>Type</th><th>Risk</th><th>How we validate</th></tr></thead>
            <tbody>
              {recommendation.assumptions.map((a) => (
                <tr key={a.id}>
                  <td>{a.text}</td>
                  <td className={styles.mono}>{a.type}</td>
                  <td><span className={`${styles.badge} ${a.riskLevel === 'high' || a.riskLevel === 'critical' ? styles.kill : a.riskLevel === 'medium' ? styles.pivot : styles.done}`}>{a.riskLevel}</span></td>
                  <td>{a.validationStrategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Risks</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Risk</th><th>Impact</th><th>Likelihood</th><th>Mitigation</th></tr></thead>
            <tbody>
              {recommendation.risks.map((rk) => (
                <tr key={rk.id}>
                  <td>{rk.risk}</td>
                  <td>{rk.impact}</td>
                  <td>{rk.likelihood}</td>
                  <td>{rk.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Validation roadmap</p>
        <div className={styles.timeline}>
          {recommendation.nextSteps.map((n) => (
            <div key={n.id} className={styles.turn}>
              <div className={styles.turnHead}>
                <span className={styles.storyId}>P{n.priority}</span>
                <span className={styles.turnRole}>{n.title}</span>
                {n.blocksDecision ? <span className={`${styles.badge} ${styles.pivot}`}>blocks decision</span> : null}
                <span className={styles.chip}>{n.category}</span>
                <span className={styles.chip}>effort: {n.effort}</span>
              </div>
              <p className={styles.turnMeta}>{n.rationale}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function BuildPlanSection({ pack }: { pack: DemoVenture['pack'] }) {
  const v = pack.productVision;
  const prd = pack.prd;
  const mvp = pack.mvpScope;
  return (
    <Section
      id="buildplan"
      kicker="Step 6 · BuildSquad"
      title="Build plan"
      desc="The PROCEED pack: product vision, PRD, MVP scope, user stories, architecture and a 4-week roadmap — readable artifacts, not raw JSON."
    >
      <div className={styles.card}>
        <p className={styles.cardTitle}>Product vision</p>
        <p className={styles.docText}><strong>{v.productPromise}</strong></p>
        <p className={styles.docText} style={{ marginTop: '0.5rem' }}>{v.problem}</p>
        <div className={styles.grid2} style={{ marginTop: '0.8rem' }}>
          <div>
            <p className={styles.miniLabel}>Differentiation</p>
            <ul className={styles.bullets}>{v.differentiation.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
          <div>
            <p className={styles.miniLabel}>Success metrics</p>
            <ul className={styles.bullets}>{v.successMetrics.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        </div>
      </div>

      {mvp ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>MVP scope</p>
          <div className={styles.grid3}>
            <div>
              <p className={styles.miniLabel}>Must have</p>
              <ul className={styles.bullets}>{mvp.mustHave.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <p className={styles.miniLabel}>Should have</p>
              <ul className={styles.bullets}>{mvp.shouldHave.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div>
              <p className={styles.miniLabel}>Later</p>
              <ul className={styles.bullets}>{mvp.later.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </div>
          <p className={styles.miniLabel} style={{ marginTop: '0.8rem' }}>Explicit cuts</p>
          <ul className={styles.bullets}>
            {mvp.explicitCuts.map((c, i) => <li key={i}><strong>{c.item}</strong> — {c.reason}</li>)}
          </ul>
        </div>
      ) : null}

      {pack.userStories?.length ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>User stories ({pack.userStories.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {pack.userStories.map((s) => (
              <div key={s.id} className={styles.storyCard}>
                <div className={styles.storyHead}>
                  <span className={styles.storyId}>{s.id}</span>
                  <span className={styles.storyTitle}>{s.title}</span>
                  <span className={`${styles.badge} ${s.priority === 'must' ? styles.proceed : styles.neutral}`}>{s.priority}</span>
                </div>
                <p className={styles.docText}>{s.story}</p>
                <ul className={styles.bullets}>{s.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pack.architectureBrief ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Architecture</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Component</th><th>Responsibility</th></tr></thead>
              <tbody>
                {pack.architectureBrief.components.map((c) => (
                  <tr key={c.name}><td className={styles.mono}>{c.name}</td><td>{c.responsibility}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pack.roadmap ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>4-week roadmap</p>
          <div className={styles.grid4}>
            {pack.roadmap.weeks.map((w) => (
              <div key={w.week} className={styles.stat}>
                <span className={styles.statLabel}>Week {w.week}</span>
                <span className={styles.barLabel} style={{ fontWeight: 600 }}>{w.theme}</span>
                <ul className={styles.bullets}>{w.deliverables.map((dlv, i) => <li key={i}>{dlv}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {prd ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>PRD requirements</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>ID</th><th>Requirement</th><th>Type</th></tr></thead>
              <tbody>
                {prd.requirements.map((req) => (
                  <tr key={req.id}><td className={styles.mono}>{req.id}</td><td>{req.text}</td><td>{req.type}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {pack.agentCritiques.length ? (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Agent critiques</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pack.agentCritiques.map((c, i) => (
              <div key={i} className={styles.critique}>
                <div className={styles.turnHead}>
                  <span className={styles.turnRole}>{c.role}</span>
                  <span className={`${styles.badge} ${c.severity === 'blocker' ? styles.kill : c.severity === 'warning' ? styles.pivot : styles.neutral}`}>{c.severity}</span>
                  <span className={styles.chip}>{c.targetSection}</span>
                </div>
                <p className={styles.docText}>{c.comment}</p>
                {c.suggestion ? <p className={styles.turnMeta}>↳ {c.suggestion}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function ExportSection({ demo, files }: { demo: DemoVenture; files: DemoExportFile[] }) {
  const ex = demo.export;
  return (
    <Section
      id="export"
      kicker="Step 8 · GitHub Export"
      title="GitHub export (simulated)"
      desc="Real Mode pushes these exact files to a new repository with your BYOK GitHub PAT. In Demo Mode nothing is pushed — the files are generated by the same renderer."
    >
      <div className={styles.repoCard}>
        <div className={styles.repoHead}>
          <span className={`${styles.badge} ${styles.demoBadge}`}>Simulated</span>
          <span className={styles.repoUrl}>{ex.htmlUrl}</span>
        </div>
        <div className={styles.chipRow}>
          <span className={styles.chip}>visibility: {ex.visibility}</span>
          <span className={styles.chip}>branch: {ex.defaultBranch}</span>
          <span className={styles.chip}>commit: {ex.commitSha.slice(0, 7)}</span>
          <span className={styles.chip}>{files.length} files</span>
        </div>
        <div className={styles.fileList}>
          {files.map((f) => (
            <div key={f.path} className={styles.fileRow}>
              <span className={styles.filePath}>{f.path}</span>
              <span className={styles.fileBytes}>{f.bytes.toLocaleString()} bytes</span>
            </div>
          ))}
        </div>
        <div className={styles.note}>
          <strong>BYOK & safety:</strong> {ex.credentialHint} No API keys, credentials, <code>.env</code> files
          or logs are ever included in an export.
        </div>
      </div>
    </Section>
  );
}

const EVENT_LABELS: Partial<Record<VentureTimelineEventKind, string>> = {
  venture_created: 'Created',
  research_graph_built: 'Research',
  persona_set_generated: 'Personas',
  buying_committee_run: 'Committee',
  recommendation_generated: 'Validation',
  buildsquad_pack_generated: 'Build Plan',
  evaluation_report_generated: 'Evaluation',
  buildsquad_repo_pushed: 'Export',
};

function TimelineSection({ events }: { events: VentureTimelineEvent[] }) {
  return (
    <Section
      id="timeline"
      kicker="Provenance"
      title="Venture timeline"
      desc="Every artifact is traceable to the job that produced it — provider, model, duration and estimated cost included."
    >
      <div className={styles.timeline}>
        {events.map((e) => (
          <div key={e.eventId} className={styles.turn}>
            <div className={styles.turnHead}>
              <span className={`${styles.badge} ${styles.neutral}`}>{EVENT_LABELS[e.eventKind] ?? e.eventKind}</span>
              <span className={styles.turnRole}>{e.label}</span>
            </div>
            <p className={styles.turnMeta}>
              {fmtTime(e.at)}
              {e.metrics ? (
                <>
                  {' · '}
                  {e.metrics.providerName}
                  {e.metrics.providerModel ? `/${e.metrics.providerModel}` : ''}
                  {typeof e.metrics.executionDurationMs === 'number' ? ` · ${Math.round(e.metrics.executionDurationMs / 1000)}s` : ''}
                  {typeof e.metrics.estimatedCostCents === 'number' ? ` · ~$${(e.metrics.estimatedCostCents / 100).toFixed(2)}` : ''}
                </>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
