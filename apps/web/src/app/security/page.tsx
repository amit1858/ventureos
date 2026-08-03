import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security',
  description:
    'How Foundry protects your provider keys and data: bring-your-own-key, encrypted at rest, decrypted server-side only, and never exposed to the browser, logs or exports.',
};

const REPO = 'https://github.com/amit1858/foundry-venture-os';

export default function SecurityPage() {
  return (
    <article className="fdry-prose">
      <p className="fdry-eyebrow">Security</p>
      <h1>Your keys. Your data. Server-side only.</h1>
      <p className="lead">
        Foundry is a bring-your-own-key product. We never ship our own provider credentials, never
        store your keys in plaintext, and never expose a credential to the browser. This is the
        model, in plain terms.
      </p>

      <h2>The contract</h2>
      <ul>
        <li><strong>Keys are encrypted at rest</strong> — provider keys are stored with AES-GCM envelope encryption, keyed per record.</li>
        <li><strong>Decrypted only server-side</strong> — decryption happens inside server-only modules; the result is never serialized to the client.</li>
        <li><strong>Never logged</strong> — provider and GitHub adapters explicitly redact tokens; the credential store never logs values.</li>
        <li><strong>Masked in the UI</strong> — settings only ever show the last four characters and an alias.</li>
        <li><strong>No secrets in exports</strong> — renderer tests assert that token-shaped strings never appear in exported files.</li>
        <li><strong>SDKs are isolated</strong> — an architecture lint blocks vendor SDKs outside their named adapter packages.</li>
      </ul>

      <h2>Provenance and auditability</h2>
      <p>
        Every artifact records which model and provider produced it. Recommendations carry a
        confidence score and the reasoning behind them, so a Proceed / Pivot / Kill decision can be
        traced back to its evidence rather than taken on trust.
      </p>

      <h2>Isolation</h2>
      <p>
        Work is scoped to your workspace. Credentials are decrypted in memory only for the duration
        of a single provider call and are never placed in subprocess environment variables, trace
        spans, or telemetry.
      </p>

      <hr />
      <p>
        Full detail lives in the repository:{' '}
        <a href={`${REPO}/blob/main/docs/security-byok.md`} target="_blank" rel="noreferrer">docs/security-byok.md</a>{' '}
        and{' '}
        <a href={`${REPO}/blob/main/docs/security.md`} target="_blank" rel="noreferrer">docs/security.md</a>.
        See also our <Link href="/privacy">privacy note</Link>.
      </p>
    </article>
  );
}
