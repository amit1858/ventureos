import Link from 'next/link';

import styles from './home.module.css';

const MODEL: { phase: string; title: string; desc: string }[] = [
  {
    phase: 'Discover',
    title: 'Understand the customer',
    desc: 'Synthetic personas and a typed research graph turn assumptions into evidence — problems, segments, competitors and the contradictions between them.',
  },
  {
    phase: 'Evaluate',
    title: 'Decide what to build',
    desc: 'A validation engine weighs problem strength, urgency, willingness to pay and execution risk into a Proceed / Pivot / Kill call with a confidence score.',
  },
  {
    phase: 'Govern',
    title: 'Oversee the portfolio',
    desc: 'Every venture carries its readiness, latest decision and provenance in one place — so nothing advances to build on a hunch.',
  },
  {
    phase: 'Learn',
    title: 'Improve every pass',
    desc: 'Evaluation reports name the model and provider behind each artifact, turning every venture into a repeatable, auditable record.',
  },
];

const WORKFLOW = [
  { label: 'Idea Intake', desc: 'A brief, target market and constraints.' },
  { label: 'Personas', desc: 'Synthetic buyers, operators and finance leads.' },
  { label: 'Buying Committee', desc: 'Personas deliberate and converge.' },
  { label: 'Research Graph', desc: 'Evidence mapped, contradictions surfaced.' },
  { label: 'Validation', desc: 'Proceed / Pivot / Kill recommendation.' },
  { label: 'Build Planning', desc: 'PRD, architecture, roadmap, stories.' },
  { label: 'Evaluation', desc: 'Provenance-aware readiness report.' },
  { label: 'GitHub Export', desc: 'Repo with build-ready artifacts.' },
];

const DIFFERENTIATORS = [
  {
    title: 'Agents that collaborate',
    desc: 'Not one chatbot. Persona, committee, research, validation, planning and evaluation agents work through a shared venture context — each step an auditable job.',
  },
  {
    title: 'Decisions backed by evidence',
    desc: 'Every recommendation carries a confidence score and its reasoning, built on a research graph rather than a wall of bullet points.',
  },
  {
    title: 'Trust by design',
    desc: 'Bring your own provider keys. Secrets are encrypted, used server-side only, and never reach the browser, logs or exports.',
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      {/* Hero — problem → solution → operating model → one CTA */}
      <section className={styles.hero}>
        <p className={styles.eyebrow}>An AI-native Venture Operating System</p>
        <h1 className={styles.title}>Where ideas become execution-ready ventures.</h1>
        <p className={styles.subtitle}>
          Most teams commit engineering before they know an idea is worth building. Foundry runs
          discovery, evaluation and planning up front — so your team builds the ventures that have
          earned it, with the evidence to back the call.
        </p>

        <div className={styles.chips} aria-label="Operating model">
          <span className={styles.chip}>Discover</span>
          <span className={styles.chipArrow}>→</span>
          <span className={styles.chip}>Evaluate</span>
          <span className={styles.chipArrow}>→</span>
          <span className={styles.chip}>Govern</span>
          <span className={styles.chipArrow}>→</span>
          <span className={styles.chip}>Learn</span>
        </div>

        <div className={styles.ctaRow}>
          <Link href="/demo/faceless-crm" className={`${styles.btn} ${styles.btnPrimary}`}>
            See the guided demo →
          </Link>
        </div>
        <p className={styles.reassure}>
          A fully seeded venture, start to finish — no sign-in and no API keys.
        </p>
      </section>

      {/* Operating model — the OS mental model, made visible */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>The operating model</p>
          <h2 className={styles.h2}>An operating system for deciding what to build</h2>
          <p className={styles.lead}>
            Foundry is built for product teams, founders, venture studios and the architects who
            build what they choose — a single, repeatable path from raw idea to a decision you can
            defend.
          </p>
        </div>
        <div className={styles.modelGrid}>
          {MODEL.map((m) => (
            <div key={m.phase} className={styles.modelCard}>
              <span className={styles.modelPhase}>{m.phase}</span>
              <h3 className={styles.featureTitle}>{m.title}</h3>
              <p className={styles.featureDesc}>{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className={styles.section}>
        <div>
          <p className={styles.kicker}>How it works</p>
          <h2 className={styles.h2}>One idea in, an execution-ready venture out</h2>
          <p className={styles.lead}>
            Each step is a specialized agent or agent group. Each produces a versioned artifact the
            next step can read — so the reasoning is inspectable end to end.
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
      </section>

      {/* Why different */}
      <section className={styles.section}>
        <div>
          <p className={styles.kicker}>Why Foundry</p>
          <h2 className={styles.h2}>Evidence before engineering</h2>
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

      {/* Closing CTA band — single action */}
      <section className={styles.ctaBand}>
        <div>
          <h2 className={styles.h2}>See a venture go from idea to build-ready</h2>
          <p className={styles.lead}>
            Walk the full path on a seeded example — personas, committee, research graph, validation,
            planning and the evaluation report — in a few minutes.
          </p>
        </div>
        <Link href="/demo/faceless-crm" className={`${styles.btn} ${styles.btnPrimary}`}>
          See the guided demo →
        </Link>
      </section>
    </div>
  );
}

