import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'How Foundry handles your data: you bring your own keys, your ventures stay in your workspace, and nothing is sold or shared.',
};

export default function PrivacyPage() {
  return (
    <article className="fdry-prose">
      <p className="fdry-eyebrow">Privacy</p>
      <h1>What Foundry stores, and what it doesn&apos;t.</h1>
      <p className="lead">
        Foundry is designed so you stay in control of your ideas and your model spend. Here is what
        that means in practice.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li><strong>Your ventures and their artifacts</strong> — personas, research graphs, recommendations and build plans — live in your workspace.</li>
        <li><strong>Your provider keys</strong> — stored encrypted, decrypted server-side only, and shown masked in the UI.</li>
        <li><strong>Provenance metadata</strong> — which model and provider produced each artifact, so results stay auditable.</li>
      </ul>

      <h2>What is not done</h2>
      <ul>
        <li>We don&apos;t ship our own model keys — you bring your own, and only you authorize outbound calls.</li>
        <li>We don&apos;t sell or share your venture data.</li>
        <li>We don&apos;t put secrets in logs, exports, or anything sent to the browser.</li>
      </ul>

      <h2>Demo mode</h2>
      <p>
        The <a href="/demo/faceless-crm">guided demo</a> runs on a fully seeded venture and requires
        no sign-in and no keys — nothing you enter there leaves your session.
      </p>

      <h2>Your control</h2>
      <p>
        You can add, rotate or remove your provider keys at any time from settings. Removing a key
        stops any further calls made on your behalf with it.
      </p>

      <hr />
      <p>
        For the technical detail behind these commitments, see the{' '}
        <Link href="/security">security model</Link>.
      </p>
    </article>
  );
}
