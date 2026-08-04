/**
 * /access — Alpha Workspace access screen.
 *
 * Replaces the developer-cookie message that used to appear on Real Mode
 * routes in the deployed app. Four states:
 *
 *   1. Real Supabase user already signed in → quick "Continue to Real Mode".
 *   2. VENTUREOS_ALPHA_ACCESS=true on server + visitor has the cookie →
 *      "Alpha workspace active" with continue link + revoke option.
 *   3. VENTUREOS_ALPHA_ACCESS=true but no cookie → primary "Continue to Alpha
 *      Workspace" POST form that sets the cookie via /api/access/alpha.
 *   4. VENTUREOS_ALPHA_ACCESS not enabled → polished setup-required guidance
 *      with link to Demo Mode + deployment docs. Never shows dev-cookie text.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  ALPHA_USER,
  alphaAccessCookiePresent,
  alphaAccessEnabled,
  getCurrentUser,
} from '../../lib/auth';

export const metadata: Metadata = {
  title: 'Enter the Alpha Workspace',
  description:
    'Demo Mode is open without sign-in. Real Mode uses a temporary alpha workspace for testing BYOK providers, venture creation, validation, build planning and GitHub export.',
};

export const dynamic = 'force-dynamic';

interface AccessPageProps {
  searchParams?: { next?: string };
}

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const user = await getCurrentUser();
  const enabled = alphaAccessEnabled();
  const cookiePresent = alphaAccessCookiePresent();
  const next = isSafeNextPath(searchParams?.next) ? searchParams!.next! : '/settings/byok';

  // Real signed-in (non-alpha) user — Supabase session present.
  if (user && user.id !== ALPHA_USER.id) {
    return (
      <section style={layout}>
        <Header />
        <DemoNotice />
        <Card>
          <h2 style={h2}>You are signed in</h2>
          <p style={muted}>
            Real Mode is already available for <strong>{user.email}</strong>.
          </p>
          <div style={ctaRow}>
            <Link href={next} style={primaryBtn}>Continue to {pretty(next)}</Link>
            <Link href="/demo" style={secondaryBtn}>Open Demo Mode</Link>
          </div>
        </Card>
      </section>
    );
  }

  if (enabled && cookiePresent) {
    return (
      <section style={layout}>
        <Header />
        <DemoNotice />
        <Card>
          <h2 style={h2}>Alpha workspace active</h2>
          <p style={muted}>
            You are using the shared <code>alpha-user</code> testing identity. BYOK,
            ventures, labs and GitHub export are available.
          </p>
          <SafetyNote />
          <div style={ctaRow}>
            <Link href={next} style={primaryBtn}>Continue to {pretty(next)}</Link>
            <Link href="/demo" style={secondaryBtn}>Open Demo Mode</Link>
          </div>
          <p style={{ ...muted, marginTop: '1rem', fontSize: '0.8rem' }}>
            Done testing? <Link href="/access/revoke" style={inlineLink}>Revoke alpha access</Link>.
          </p>
        </Card>
      </section>
    );
  }

  if (enabled) {
    return (
      <section style={layout}>
        <Header />
        <DemoNotice />
        <Card>
          <h2 style={h2}>Choose how to enter Real Mode</h2>
          <p style={muted}>
            Demo Mode is open without sign-in. For Real Mode you have three options.
          </p>
          <ul style={optionList}>
            <li>
              <strong style={optionLabel}>Sign in with Google</strong>
              <span style={muted}>
                Recommended for invited testers. You get a private workspace with your own BYOK
                providers, ventures and GitHub export state.
              </span>
            </li>
            <li>
              <strong style={optionLabel}>Continue to Alpha Workspace</strong>
              <span style={muted}>
                Shared <code>alpha-user</code> identity. Useful for quick demos and shared
                testing. Not appropriate when multiple unrelated users will share the deployment.
              </span>
            </li>
            <li>
              <strong style={optionLabel}>Open Demo Mode</strong>
              <span style={muted}>
                Read-only walkthrough with seeded data. No sign-in, no API keys.
              </span>
            </li>
          </ul>
          <SafetyNote />
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <form action={`/api/auth/google/start?next=${encodeURIComponent(next)}`} method="post" style={{ display: 'inline' }}>
              <button type="submit" style={primaryBtn}>Continue with Google</button>
            </form>
            <form
              method="post"
              action={`/api/access/alpha?next=${encodeURIComponent(next)}`}
              style={{ display: 'inline' }}
            >
              <button type="submit" style={secondaryBtn}>Continue to Alpha Workspace</button>
            </form>
            <Link href="/demo" style={secondaryBtn}>Open Demo Mode</Link>
          </div>
        </Card>
      </section>
    );
  }

  // Alpha access not enabled on the server — still offer Google sign-in if
  // Supabase is configured, otherwise show setup guidance.
  if (process.env['NEXT_PUBLIC_SUPABASE_URL']) {
    return (
      <section style={layout}>
        <Header />
        <DemoNotice />
        <Card>
          <h2 style={h2}>Sign in to enter Real Mode</h2>
          <p style={muted}>
            Demo Mode is open without sign-in. Sign in with Google to create ventures, save BYOK
            providers, run validation workflows and export to GitHub.
          </p>
          <div style={ctaRow}>
            <form action={`/api/auth/google/start?next=${encodeURIComponent(next)}`} method="post" style={{ display: 'inline' }}>
              <button type="submit" style={primaryBtn}>Continue with Google</button>
            </form>
            <Link href="/demo" style={secondaryBtn}>Open Demo Mode</Link>
          </div>
          <p style={{ ...muted, fontSize: '0.85rem', marginTop: '1rem' }}>
            Access is restricted to an alpha allowlist. If your Google account is not on the
            list you will see a polite access-denied message.
          </p>
        </Card>
      </section>
    );
  }

  // Alpha access not enabled on the server — show polished setup guidance.
  return (
    <section style={layout}>
      <Header />
      <DemoNotice />
      <Card>
        <h2 style={h2}>Real Mode requires workspace access</h2>
        <p style={muted}>
          This deployment does not have a Real Mode workspace configured. Demo Mode is
          fully available and runs without any sign-in or API keys.
        </p>
        <p style={muted}>
          To enable Real Mode on a self-hosted deployment, set the following on the server
          and redeploy:
        </p>
        <pre style={code}>
{`# Enables a temporary shared workspace
VENTUREOS_ALPHA_ACCESS=true

# Required for Real Mode persistence (BYOK, ventures, artifacts)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VENTUREOS_CREDENTIAL_ENCRYPTION_KEY=...`}
        </pre>
        <p style={{ ...muted, fontSize: '0.85rem' }}>
          Provider API keys (OpenAI, Anthropic, Gemini, Azure OpenAI) and the GitHub PAT are
          never server env vars — they are entered through the BYOK UI and encrypted at rest.
        </p>
        <div style={ctaRow}>
          <Link href="/demo" style={primaryBtn}>Open Demo Mode</Link>
          <a
            href="https://github.com/amit1858/foundry-venture-os/blob/main/docs/deployment.md"
            target="_blank"
            rel="noreferrer"
            style={secondaryBtn}
          >
            View deployment docs
          </a>
        </div>
      </Card>
    </section>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isSafeNextPath(p: string | undefined): p is string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//');
}

function pretty(path: string): string {
  if (path === '/settings/byok') return 'BYOK settings';
  if (path === '/ventures') return 'My Ventures';
  if (path === '/ventures/new') return 'Create Venture';
  if (path.startsWith('/labs/')) return path.replace('/labs/', '').replace('-', ' ');
  return path;
}

function Header() {
  return (
    <header style={{ marginBottom: '1.5rem' }}>
      <p style={{ ...muted, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
        Workspace access
      </p>
      <h1 style={{ margin: '0.25rem 0 0' }}>Enter Foundry Alpha Workspace</h1>
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

function SafetyNote() {
  return (
    <p
      style={{
        marginTop: '1rem',
        padding: '0.75rem 1rem',
        border: '1px solid rgba(243, 179, 80, 0.35)',
        background: 'rgba(243, 179, 80, 0.08)',
        borderRadius: 6,
        color: '#f3b350',
        fontSize: '0.85rem',
      }}
    >
      Do not store production secrets in this alpha workspace. Provider keys are encrypted
      server-side with AES-256-GCM and can be deleted from BYOK settings.
    </p>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────

const layout: React.CSSProperties = { maxWidth: 720, margin: '0 auto' };
const h2: React.CSSProperties = { margin: 0, fontSize: '1.25rem' };
const muted: React.CSSProperties = {
  color: '#9aa0a6',
  lineHeight: 1.55,
  marginTop: '0.5rem',
};
const ctaRow: React.CSSProperties = {
  marginTop: '1.25rem',
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
};
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
const inlineLink: React.CSSProperties = { color: '#7aa3ff', textDecoration: 'underline' };
const code: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.75rem 1rem',
  background: '#0b0b0e',
  color: '#cbd0d4',
  borderRadius: 6,
  fontSize: '0.8rem',
  overflowX: 'auto',
  border: '1px solid #2a2a2a',
};
const optionList: React.CSSProperties = {
  margin: '1rem 0 0',
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: '0.85rem',
};
const optionLabel: React.CSSProperties = {
  display: 'block',
  color: '#e8e8ea',
  marginBottom: '0.15rem',
};
