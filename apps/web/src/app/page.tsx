import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './home.module.css';

export const metadata: Metadata = {
  title: 'Foundry — AI-native Venture Operating System',
  description:
    'Foundry helps product teams transform raw ideas into validated, execution-ready ventures using collaborative AI agents.',
};

const WORKFLOW = [
  { label: 'Idea Intake', desc: 'A brief, target market and constraints.' },
  { label: 'PersonaLab', desc: 'Synthetic SMB buyers, operators, finance.' },
  { label: 'Buying Committee', desc: 'Personas deliberate and converge.' },
  { label: 'Research Graph', desc: 'Evidence mapped, contradictions surfaced.' },
  { label: 'VentureLab', desc: 'Proceed / Pivot / Kill recommendation.' },
  { label: 'BuildSquad', desc: 'PRD, architecture, roadmap, stories.' },
  { label: 'Evaluation', desc: 'Provenance-aware readiness report.' },
  { label: 'GitHub Export', desc: 'Repo with 14 build-ready artifacts.' },
];

const AGENT_GROUPS: { title: string; role: string; desc: string }[] = [
  {
    title: 'Persona Agents',
    role: 'PersonaLab',
    desc: 'Synthetic SMB owners, sales reps, finance leads, operators and customers simulate real-world buying behavior, objections and workflow constraints.',
  },
  {
    title: 'Buying Committee Agents',
    role: 'PersonaLab → Committee',
    desc: 'Multiple personas deliberate, challenge one another, change positions and converge on support, pilot, defer or reject decisions.',
  },
  {
    title: 'Research Graph Agents',
    role: 'Graphify-inspired',
    desc: 'Research inputs are converted into a graph of problems, customers, competitors, risks, assumptions, contradictions and opportunities.',
  },
  {
    title: 'Venture Validation Agents',
    role: 'VentureLab',
    desc: 'The system scores problem strength, urgency, willingness to pay, differentiation, adoption friction, execution risk and confidence.',
  },
  {
    title: 'BuildSquad Agents',
    role: 'BuildSquad',
    desc: 'PM, UX, architecture, engineering, QA and GTM agents turn validated ventures into PRDs, roadmaps, user stories, architecture briefs and GitHub-ready artifacts.',
  },
  {
    title: 'Evaluation Agent',
    role: 'Evaluation Report',
    desc: 'Every venture generates a provenance-aware evaluation report with readiness, confidence, coverage, risks, assumptions and next validation steps.',
  },
];

const PIPELINE: { step: string; role: string; artifact: string; signal: string }[] = [
  { step: 'Idea Intake',       role: 'Single brief',                       artifact: 'Venture record',                       signal: 'Scope captured' },
  { step: 'PersonaLab',        role: 'Synthetic customer simulation',      artifact: 'Persona set + interviews',             signal: 'Persona coverage' },
  { step: 'Buying Committee',  role: 'Multi-persona deliberation',         artifact: 'Committee transcript + consensus',     signal: 'Objections, opinion changes, decision confidence' },
  { step: 'Research Graph',    role: 'Evidence mapping',                   artifact: 'Problem / customer / competitor graph', signal: 'Contradictions and god nodes' },
  { step: 'VentureLab',        role: 'Venture decision engine',            artifact: 'Proceed / Pivot / Kill recommendation', signal: 'Confidence score' },
  { step: 'BuildSquad',        role: 'Planning swarm (PM/UX/Arch/Eng/QA)', artifact: 'PRD, architecture, roadmap, stories',  signal: 'Build readiness' },
  { step: 'Evaluation',        role: 'Quality & provenance agent',         artifact: 'EVALUATION_REPORT.md',                 signal: 'Readiness + risk coverage' },
  { step: 'GitHub Export',     role: 'Execution handoff agent',            artifact: 'GitHub-ready repository (14 files)',   signal: 'Repo URL + commit SHA' },
];

const DIFFERENTIATORS = [
  { title: 'BYOK-first', desc: 'Bring your own OpenAI, Anthropic, Gemini or Azure OpenAI key plus a GitHub PAT. Keys are encrypted, server-side, and never reach the browser.' },
  { title: 'Agent swarms', desc: 'Persona, committee, research-graph, validation, BuildSquad and evaluation agents collaborate — each step is an auditable VentureJob.' },
  { title: 'Synthetic personas', desc: 'TinyTroupe-style persona simulation: a generated buying committee deliberates, challenges itself, and converges on a decision.' },
  { title: 'Research graphs', desc: 'Graphify-inspired workflows turn sources into a typed graph of problems, segments, competitors and risks — with god-nodes and contradictions surfaced.' },
  { title: 'Evaluation reports', desc: 'A first-class, provenance-tracked report: readiness, coverage, assumptions and the model/provider behind every artifact.' },
  { title: 'GitHub-ready artifacts', desc: 'Export a vision, PRD, architecture, roadmap, user stories, evaluation report and persona/research docs straight into a new repository.' },
];

const PROD_POINTS: string[] = [
  'BYOK provider layer: OpenAI · Anthropic · Gemini · Azure OpenAI.',
  'GitHub PAT support for one-click repository export.',
  'Encrypted credential storage; secrets never reach the browser or logs.',
  'VentureJob execution model with status, progress, provider · model · cost.',
  'Typed contracts and artifact versioning across every lab.',
  'Research graph and evaluation report as first-class artifacts.',
  'GitHub export with preview, classified errors and short commit SHA in-app.',
  'Import-boundary checks keep provider SDKs out of app and labs.',
];

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <p className={styles.eyebrow}>AI-native Venture Operating System</p>
        <h1 className={styles.title}>Turn raw ideas into validated, execution-ready ventures with agent swarms.</h1>
        <p className={styles.subtitle}>
          Foundry orchestrates synthetic customers, research graph agents, venture validation
          agents, BuildSquad planners and evaluation agents to help teams decide what to build —
          before they write code.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/demo/faceless-crm" className={`${styles.btn} ${styles.btnPrimary}`}>Try the demo →</Link>
          <Link href="/ventures/new" className={styles.btn}>Create a venture</Link>
          <Link href="/settings/byok" className={styles.btn}>Configure BYOK</Link>
          <a href="https://github.com/amit1858/foundry" className={styles.btn} target="_blank" rel="noreferrer">View GitHub repo</a>
          <Link href="/#architecture" className={styles.btn}>View architecture</Link>
        </div>
      </section>

      {/* Judge guidance — primary judging path call-out */}
      <section
        aria-label="Judge guidance"
        className={styles.judgeCard}
        data-testid="judge-guidance"
      >
        <div className={styles.judgeHead}>
          <span className={styles.judgeBadge}>For judges</span>
          <h2 className={styles.judgeTitle}>Start with the zero-key demo</h2>
        </div>
        <p className={styles.judgeBody}>
          Use the Faceless CRM demo to evaluate Foundry without sign-in, provider keys or
          setup. It walks through the full agent swarm pipeline — personas, buying committee,
          research graph, venture validation, BuildSquad planning, evaluation report and
          GitHub-ready artifacts.
        </p>
        <div className={styles.judgeCtaRow}>
          <Link href="/demo/faceless-crm" className={`${styles.btn} ${styles.btnPrimary}`}>
            Open Judge Demo →
          </Link>
          <a
            href="https://github.com/amit1858/foundry"
            className={styles.btn}
            target="_blank"
            rel="noreferrer"
          >
            View GitHub repo
          </a>
          <Link href="/access" className={styles.judgeMutedLink}>
            Sign in / Alpha Workspace for Real Mode
          </Link>
        </div>
      </section>

      {/* Agent swarm pipeline (workflow) */}
      <section id="pipeline" className={styles.section}>
        <div>
          <p className={styles.kicker}>The pipeline</p>
          <h2 className={styles.h2}>Powered by an agent swarm pipeline</h2>
          <p className={styles.lead}>
            One idea in, an execution-ready venture out. Each step is a specialized agent or
            agent group; each produces a versioned artifact that the next step can read.
          </p>
        </div>
        <div className={styles.workflow}>
          {WORKFLOW.map((s, i) => (
            <div key={s.label} className={styles.flowStep}>
              <span className={styles.flowIdx}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.flowLabel}>{s.label}</span>
              <span className={styles.flowDesc}>{s.desc}</span>
            </div>
          ))}
        </div>

        <div className={styles.pipelineTable}>
          <div className={`${styles.pipeRow} ${styles.pipeHead}`}>
            <span>Step</span><span>Agent role</span><span>Artifact</span><span>Signal</span>
          </div>
          {PIPELINE.map((p) => (
            <div key={p.step} className={styles.pipeRow}>
              <span className={styles.pipeStep}>{p.step}</span>
              <span className={styles.pipeMuted}>{p.role}</span>
              <span>{p.artifact}</span>
              <span className={styles.pipeMuted}>{p.signal}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Multi-agent architecture */}
      <section id="architecture" className={styles.section}>
        <div>
          <p className={styles.kicker}>Multi-agent system</p>
          <h2 className={styles.h2}>Built as a multi-agent venture system</h2>
          <p className={styles.lead}>
            Foundry is not one chatbot. It coordinates specialized agents that simulate
            customers, map evidence, challenge assumptions, validate opportunities and generate
            build-ready artifacts.
          </p>
        </div>
        <div className={styles.grid}>
          {AGENT_GROUPS.map((g) => (
            <div key={g.title} className={styles.feature}>
              <p className={styles.kicker} style={{ margin: 0 }}>{g.role}</p>
              <h3 className={styles.featureTitle}>{g.title}</h3>
              <p className={styles.featureDesc}>{g.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Differentiators */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>Why Foundry</p>
          <h2 className={styles.h2}>Decide what to build, with evidence</h2>
          <p className={styles.lead}>
            For founders, product teams and venture studios who want to pressure-test an idea
            against synthetic buyers and real research before committing engineering time.
          </p>
        </div>
        <div className={styles.grid}>
          {DIFFERENTIATORS.map((f) => (
            <div key={f.title} className={styles.feature}>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Production-minded architecture */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>Engineering</p>
          <h2 className={styles.h2}>Production-minded architecture</h2>
          <p className={styles.lead}>
            Foundry is alpha-quality but built on the patterns we&apos;d ship in production —
            typed contracts, BYOK isolation, jobs as first-class objects, and
            import-boundary checks.
          </p>
        </div>
        <ul className={styles.prodList}>
          {PROD_POINTS.map((p) => <li key={p} className={styles.prodItem}>{p}</li>)}
        </ul>
      </section>

      {/* Demo + Security */}
      <section className={styles.section}>
        <div className={styles.split}>
          <div className={`${styles.panel} ${styles.panelAccent}`}>
            <span className={styles.badge}>Demo Mode · No keys</span>
            <h3 className={styles.panelTitle}>See the swarm in action: Faceless CRM for SMB</h3>
            <p className={styles.panelText}>
              Walk through a complete Foundry pipeline where synthetic SMB buyers, a buying
              committee, a research graph, the venture validation engine, BuildSquad planners
              and an evaluation report work together to produce a GitHub-ready venture plan —
              with no API keys.
            </p>
            <Link href="/demo/faceless-crm" className={`${styles.btn} ${styles.btnPrimary}`}>
              Open the Faceless CRM demo →
            </Link>
          </div>

          <div className={styles.panel}>
            <span className={styles.badge}>Security</span>
            <h3 className={styles.panelTitle}>Your keys, your data</h3>
            <ul className={styles.bullets}>
              <li>BYOK — bring your own provider keys; no provider lock-in.</li>
              <li>Keys are encrypted at rest and used only server-side.</li>
              <li>Secrets are never exposed to the browser or written to logs.</li>
              <li>Exports never include <code>.env</code> files, tokens or credentials.</li>
            </ul>
            <Link href="/settings/byok" className={styles.btn}>Configure BYOK</Link>
          </div>
        </div>
      </section>

      {/* Why this fits Agent Swarms */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>Agent Swarms</p>
          <h2 className={styles.h2}>Why Foundry fits Agent Swarms</h2>
          <p className={styles.lead}>
            Foundry uses multiple specialized agents instead of a single assistant.
            Persona agents simulate buyers. Committee agents debate and challenge assumptions.
            Research graph agents structure evidence. Venture validation agents score
            opportunity quality. BuildSquad agents produce execution artifacts. Evaluation
            agents generate provenance-aware reports. Together, they transform a raw idea
            into a validated, build-ready venture.
          </p>
        </div>
        <div className={styles.swarmStrip}>
          <span className={styles.swarmCell}>Agent Swarm</span>
          <span className={styles.swarmArrow}>→</span>
          <span className={styles.swarmCell}>Shared Venture Context</span>
          <span className={styles.swarmArrow}>→</span>
          <span className={styles.swarmCell}>Versioned Artifacts</span>
          <span className={styles.swarmArrow}>→</span>
          <span className={styles.swarmCell}>GitHub-ready Output</span>
        </div>
      </section>
    </div>
  );
}

