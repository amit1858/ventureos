/**
 * /access-denied — shown when a signed-in user's email is not on
 * VENTUREOS_ALLOWED_EMAILS. The user is technically signed in with Supabase
 * but is treated as a denied identity everywhere else in the app.
 *
 * Copy is deliberately polite — never name the allowlist, never disclose
 * which emails are on it, never expose internal error messages.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { getAuthDecision } from '../../lib/auth';

export const metadata: Metadata = {
  title: 'Access not available — VentureOS',
  description: 'Your account is signed in but is not on the VentureOS alpha allowlist.',
};

export const dynamic = 'force-dynamic';

export default async function AccessDeniedPage() {
  const decision = await getAuthDecision();
  const deniedEmail = decision.kind === 'denied' ? decision.email : null;

  return (
    <section style={layout}>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ ...muted, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Workspace access
        </p>
        <h1 style={{ margin: '0.25rem 0 0' }}>Your account is not on the alpha allowlist</h1>
      </header>
      <div
        style={{
          border: '1px solid #2a2a2a',
          borderRadius: 10,
          padding: '1.5rem',
          background: '#15171c',
        }}
      >
        <p style={muted}>
          {deniedEmail ? (
            <>
              Your Google account <strong>{deniedEmail}</strong> is signed in, but it is not on
              the VentureOS alpha allowlist.
            </>
          ) : (
            <>Your account is signed in, but it is not on the VentureOS alpha allowlist.</>
          )}
          {' '}Use Demo Mode to explore the full product, or contact the project owner to be
          added.
        </p>
        <div style={ctaRow}>
          <Link href="/demo" style={primaryBtn}>Open Demo Mode</Link>
          <form action="/api/auth/signout" method="post" style={{ display: 'inline' }}>
            <button type="submit" style={secondaryBtn}>Sign out</button>
          </form>
        </div>
        <p style={fineprint}>
          The allowlist is intentionally kept private. No information about which accounts are
          on it is ever exposed to the browser.
        </p>
      </div>
    </section>
  );
}

const layout: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };
const muted: React.CSSProperties = { color: '#9aa0a6', lineHeight: 1.55, marginTop: '0.5rem' };
const ctaRow: React.CSSProperties = { marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' };
const primaryBtn: React.CSSProperties = {
  padding: '0.6rem 1rem',
  background: '#7aa3ff',
  color: '#0b0b0e',
  borderRadius: 6,
  fontWeight: 600,
  textDecoration: 'none',
  border: 0,
  cursor: 'pointer',
  fontSize: '0.95rem',
};
const secondaryBtn: React.CSSProperties = {
  padding: '0.6rem 1rem',
  background: 'transparent',
  color: '#cbd0d4',
  borderRadius: 6,
  textDecoration: 'none',
  border: '1px solid #2a2a2a',
  cursor: 'pointer',
  fontSize: '0.95rem',
};
const fineprint: React.CSSProperties = {
  marginTop: '1.25rem',
  color: '#6f7178',
  fontSize: '0.8rem',
  lineHeight: 1.55,
};
