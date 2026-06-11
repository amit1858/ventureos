import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './home.module.css';

export const metadata: Metadata = {
  title: 'VentureOS — turn raw ideas into validated, build-ready ventures',
  description:
    'VentureOS uses agent swarms, synthetic personas, research graphs, venture validation and BuildSquad planning to help teams decide what to build before they build it.',
};

const WORKFLOW = [
  { label: 'Idea', desc: 'One brief in' },
  { label: 'Personas', desc: 'Synthetic buyers' },
  { label: 'Research Graph', desc: 'Evidence, mapped' },
  { label: 'Validation', desc: 'Proceed / Pivot / Kill' },
  { label: 'Build Plan', desc: 'PRD, MVP, stories' },
  { label: 'GitHub Export', desc: 'Repo-ready' },
];

const DIFFERENTIATORS = [
  { title: 'BYOK-first', desc: 'Bring your own OpenAI, Anthropic, Gemini or Azure key. Keys are encrypted, server-side, and never reach the browser.' },
  { title: 'Agent swarms', desc: 'Persona, committee, research, validation and build agents collaborate — each step is an auditable VentureJob.' },
  { title: 'Synthetic personas', desc: 'Generate a buying committee, then watch them deliberate, challenge each other and converge on a decision.' },
  { title: 'Research graphs', desc: 'Sources become a typed graph of problems, segments, competitors and risks — with god-nodes and contradictions surfaced.' },
  { title: 'Evaluation reports', desc: 'A first-class, provenance-tracked report: readiness, coverage, assumptions and the model/provider behind every artifact.' },
  { title: 'GitHub-ready artifacts', desc: 'Export a vision, PRD, architecture, roadmap and evaluation report straight into a new repository.' },
];

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <p className={styles.eyebrow}>AI-native venture incubation</p>
        <h1 className={styles.title}>Turn raw ideas into validated, build-ready ventures.</h1>
        <p className={styles.subtitle}>
          VentureOS uses agent swarms, synthetic personas, research graphs, venture validation and
          BuildSquad planning to help teams decide what to build — before they build it.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/demo" className={`${styles.btn} ${styles.btnPrimary}`}>Try the demo →</Link>
          <Link href="/ventures/new" className={styles.btn}>Create a venture</Link>
          <Link href="/settings/byok" className={styles.btn}>Configure BYOK</Link>
        </div>
      </section>

      {/* Workflow */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>The workflow</p>
          <h2 className={styles.h2}>One idea in, an execution-ready venture out</h2>
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
      </section>

      {/* Differentiators */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>Why VentureOS</p>
          <h2 className={styles.h2}>Decide what to build, with evidence</h2>
          <p className={styles.lead}>
            For founders, product teams and venture studios who want to pressure-test an idea against
            synthetic buyers and real research before committing engineering time.
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

      {/* Demo scenario + Security */}
      <section className={styles.section}>
        <div className={styles.split}>
          <div className={`${styles.panel} ${styles.panelAccent}`}>
            <span className={styles.badge}>Demo Mode · No keys</span>
            <h3 className={styles.panelTitle}>See it on “Faceless CRM for SMB”</h3>
            <p className={styles.panelText}>
              Walk a real venture from idea to a simulated GitHub export — five synthetic personas, an
              agentic buying committee, a research graph, a PROCEED recommendation and a full build plan.
              No OpenAI, Anthropic, Supabase or GitHub key required.
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
    </div>
  );
}
