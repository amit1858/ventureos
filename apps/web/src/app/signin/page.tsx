/**
 * /signin — Google sign-in entry point for Real Mode.
 *
 * Three CTAs (in order of preference):
 *   1. Continue with Google — primary path for invited testers. Submits a
 *      form POST to /api/auth/google/start which redirects to Supabase OAuth.
 *   2. Open Demo Mode — anyone can browse this without sign-in.
 *   3. Use Alpha Workspace — fallback for shared testing; only shown if
 *      VENTUREOS_ALPHA_ACCESS=true is set on the server.
 *
 * If the visitor is already signed in we short-circuit and offer "Continue".
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { ALPHA_USER, allowlistEmails, alphaAccessEnabled, getAuthDecision } from '../../lib/auth';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in with Google to create ventures, save BYOK providers, run validation workflows and export to GitHub.',
};

export const dynamic = 'force-dynamic';

interface SignInPageProps {
  searchParams?: { next?: string; error?: string };
}

const SIGNIN_ERRORS: Record<string, string> = {
  missing_code: 'Sign-in could not be completed — no authorization code returned.',
  exchange_failed: 'Sign-in could not be completed — your provider session could not be verified.',
  callback_error: 'Sign-in could not be completed — please try again.',
  auth_not_configured: 'Sign-in is not available on this deployment.',
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const decision = await getAuthDecision();
  const enabled = alphaAccessEnabled();
  // Only advertise an allowlist restriction when one is actually configured.
  // With an empty/unset allowlist, Google sign-in is open to any account.
  const restricted = allowlistEmails().size > 0;
  const next =
    typeof searchParams?.next === 'string' &&
    searchParams.next.startsWith('/') &&
    !searchParams.next.startsWith('//')
      ? searchParams.next
      : '/ventures';

  const errorKey = searchParams?.error;
  const errorMessage = errorKey ? SIGNIN_ERRORS[errorKey] : null;

  // Already signed in as a real user — offer a quick continue.
  if (decision.kind === 'user') {
    return (
      <section style={layout}>
        <Header />
        <DemoNotice />
        <Card>
          <h2 style={h2}>You are signed in</h2>
          <p style={muted}>Real Mode is already available for <strong>{decision.user.email}</strong>.</p>
          <div style={ctaRow}>
            <Link href={next} style={primaryBtn}>Continue</Link>
            <form action="/api/auth/signout" method="post" style={{ display: 'inline' }}>
              <button type="submit" style={secondaryBtn}>Sign out</button>
            </form>
          </div>
        </Card>
      </section>
    );
  }

  if (decision.kind === 'alpha') {
    return (
      <section style={layout}>
        <Header />
        <DemoNotice />
        <Card>
          <h2 style={h2}>Alpha workspace active</h2>
          <p style={muted}>
            You are using the shared <code>{ALPHA_USER.id}</code> testing identity. Sign in with
            Google to switch to a private workspace with your own BYOK keys and ventures.
          </p>
          <form
            action={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
            method="post"
            style={{ marginTop: '1rem' }}
          >
            <div style={ctaRow}>
              <button type="submit" style={primaryBtn}>Continue with Google</button>
              <Link href={next} style={secondaryBtn}>Stay in Alpha Workspace</Link>
            </div>
          </form>
        </Card>
      </section>
    );
  }

  return (
    <section style={layout}>
      <Header />
      <DemoNotice />
      <Card>
        <h2 style={h2}>Sign in to Foundry</h2>
        <p style={muted}>
          Demo Mode is open without sign-in. Sign in with Google to create ventures, save BYOK
          providers, run validation workflows and export to GitHub.
        </p>
        {errorMessage ? (
          <p style={errorNote}>{errorMessage}</p>
        ) : null}
        <form
          action={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
          method="post"
          style={{ marginTop: '1.25rem' }}
        >
          <div style={ctaRow}>
            <button type="submit" style={primaryBtn} aria-label="Continue with Google">
              <span aria-hidden="true" style={{ marginRight: 8 }}>🟢</span>
              Continue with Google
            </button>
            <Link href="/demo" style={secondaryBtn}>Open Demo Mode</Link>
            {enabled ? (
              <Link href={`/access?next=${encodeURIComponent(next)}`} style={secondaryBtn}>
                Use Alpha Workspace
              </Link>
            ) : null}
          </div>
        </form>
        <p style={fineprint}>
          {restricted ? (
            <>
              Sign-in is currently limited to an approved allowlist. If your Google account is
              not on the list you will see a polite access-denied message — your information is
              never stored beyond what Supabase needs for the session.
            </>
          ) : (
            <>
              Sign in with Google to create, save, and manage your ventures. Your information is
              never stored beyond what Supabase needs for the session.
            </>
          )}
        </p>
      </Card>
    </section>
  );
}

// ── presentational ───────────────────────────────────────────────────────────

function Header() {
  return (
    <header style={{ marginBottom: '1.5rem' }}>
      <p style={{ ...muted, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
        Workspace access
      </p>
      <h1 style={{ margin: '0.25rem 0 0' }}>Sign in to Foundry</h1>
    </header>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #2a2a2a',
        borderRadius: 10,
        padding: '1.5rem',
        background: '#15171c',
      }}
    >
      {children}
    </div>
  );
}

function DemoNotice() {
  return (
    <aside
      role="note"
      aria-label="Guided demo"
      data-testid="demo-notice"
      style={{
        marginBottom: '1rem',
        padding: '0.85rem 1rem',
        border: '1px solid rgba(122, 163, 255, 0.35)',
        background: 'linear-gradient(135deg, rgba(122, 163, 255, 0.10), rgba(139, 123, 240, 0.06))',
        borderRadius: 10,
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: '0.66rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '0.15rem 0.55rem',
          borderRadius: 999,
          color: '#cfe1ff',
          background: 'rgba(122, 163, 255, 0.16)',
          border: '1px solid rgba(122, 163, 255, 0.45)',
        }}
      >
        Product tour
      </span>
      <span style={{ color: '#e8e8ea', fontSize: '0.9rem' }}>
        Prefer to look around first? Open the guided demo — no keys needed.
      </span>
      <span style={{ flex: 1 }} />
      <Link
        href="/demo/faceless-crm"
        style={{
          padding: '0.45rem 0.9rem',
          background: '#7aa3ff',
          color: '#0b0b0e',
          borderRadius: 6,
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: '0.88rem',
        }}
      >
        Open the guided demo →
      </Link>
    </aside>
  );
}

const layout: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };
const h2: React.CSSProperties = { margin: 0, fontSize: '1.25rem' };
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
const errorNote: React.CSSProperties = {
  marginTop: '1rem',
  padding: '0.75rem 1rem',
  border: '1px solid rgba(239, 106, 106, 0.4)',
  background: 'rgba(239, 106, 106, 0.08)',
  borderRadius: 6,
  color: '#ef6a6a',
  fontSize: '0.9rem',
};
const fineprint: React.CSSProperties = {
  marginTop: '1.25rem',
  color: '#6f7178',
  fontSize: '0.8rem',
  lineHeight: 1.55,
};
