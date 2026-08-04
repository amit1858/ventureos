import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Foundry is an AI-native Venture Operating System that helps teams decide what deserves to be built before engineering begins.',
};

const REPO = 'https://github.com/amit1858/foundry-venture-os';

export default function AboutPage() {
  return (
    <article className="fdry-prose">
      <p className="fdry-eyebrow">About Foundry</p>
      <h1>Decide what deserves to be built — before engineering begins.</h1>
      <p className="lead">
        Foundry is an AI-native Venture Operating System. It turns a raw idea into a validated,
        execution-ready venture — with synthetic customer research, an evidence graph, a
        Proceed / Pivot / Kill recommendation, a build plan and a real repository — produced by a
        group of specialized agents working over one shared venture, not a single chatbot.
      </p>

      <h2>The problem</h2>
      <p>
        Most teams commit months of engineering to ventures that were never going to work. The
        bottleneck isn&apos;t engineering speed — it&apos;s the discovery-to-build loop. Customer
        discovery is slow and biased, opportunity sizing is anecdote-driven, and the gap between a
        validated insight and a buildable plan is usually re-done from scratch. Today&apos;s AI
        tools accelerate execution; Foundry accelerates the decision to build the right thing.
      </p>

      <h2>How it works</h2>
      <p>Foundry runs one repeatable path, expressed as four phases of an operating model:</p>
      <ul>
        <li><strong>Discover</strong> — synthetic personas and a typed research graph turn assumptions into evidence.</li>
        <li><strong>Evaluate</strong> — a validation engine weighs the opportunity into a Proceed / Pivot / Kill call with a confidence score.</li>
        <li><strong>Govern</strong> — every venture carries its readiness, latest decision and provenance in one place.</li>
        <li><strong>Learn</strong> — evaluation reports name the model and provider behind each artifact, so every pass is auditable.</li>
      </ul>
      <p>
        Under the hood these map to three labs — PersonaLab (simulate customers), VentureLab (score
        the opportunity), and BuildSquad (produce the PRD, architecture, roadmap and repository).
      </p>

      <h2>A note on the name</h2>
      <p>
        Foundry was originally developed and submitted as <strong>VentureOS</strong> for the
        Microsoft Build AI / HackerEarth challenge. It was renamed as the product evolved beyond the
        original submission. The historical submission materials are preserved, unchanged, under{' '}
        <code>docs/archive/ventureos-submission/</code> in the repository.
      </p>

      <hr />
      <p>
        Learn more in the <Link href="/security">security model</Link> and{' '}
        <Link href="/privacy">privacy</Link> notes, explore the{' '}
        <a href="/demo/faceless-crm">guided demo</a>, or read the source on{' '}
        <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>.
      </p>
    </article>
  );
}
