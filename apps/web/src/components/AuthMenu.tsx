'use client';

/**
 * Auth-aware navigation island.
 *
 * Renders on the client and fetches /api/auth/me so that the rest of the app
 * tree can remain statically rendered (demo + landing pages especially).
 *
 * States:
 *   - Loading              → renders a lightweight placeholder
 *   - Signed-in real user  → email + Sign out
 *   - Alpha workspace      → "Alpha Workspace" badge + Sign in with Google + Exit
 *   - Denied               → "Access denied" badge + Sign out
 *   - Signed out           → Sign in
 *
 * No secrets are ever rendered — only email (which is already exposed by the
 * provider's user record). Never references the dev cookie.
 */
import { useEffect, useState } from 'react';

type AuthMe =
  | { kind: 'user'; user: { id: string; email: string }; via: string; alphaEnabled: boolean }
  | { kind: 'alpha'; user: { id: string; email: string }; alphaEnabled: boolean }
  | { kind: 'dev-cookie'; user: { id: string; email: string }; alphaEnabled: boolean }
  | { kind: 'denied'; email: string; reason: string; alphaEnabled: boolean }
  | { kind: 'none'; alphaEnabled: boolean };

export function AuthMenu() {
  const [state, setState] = useState<AuthMe | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json() as Promise<AuthMe>)
      .then((s) => { if (!cancelled) setState(s); })
      .catch(() => { if (!cancelled) setState({ kind: 'none', alphaEnabled: false }); });
    return () => { cancelled = true; };
  }, []);

  if (!state) {
    return <span style={{ color: '#5e6066', fontSize: '0.85rem' }}>…</span>;
  }

  if (state.kind === 'user' || state.kind === 'dev-cookie') {
    return (
      <span style={row}>
        <span style={emailPill} title={`Signed in as ${state.user.email}`}>
          {truncate(state.user.email, 28)}
        </span>
        <SignOutButton />
      </span>
    );
  }

  if (state.kind === 'alpha') {
    return (
      <span style={row}>
        <span style={alphaBadge}>Alpha Workspace</span>
        <a href="/signin" style={signInLink}>Sign in with Google</a>
        <SignOutButton label="Exit Alpha Workspace" />
      </span>
    );
  }

  if (state.kind === 'denied') {
    return (
      <span style={row}>
        <span style={deniedBadge}>Access denied</span>
        <SignOutButton />
      </span>
    );
  }

  // Signed out
  return (
    <span style={row}>
      <a href="/signin" style={signInLink}>Sign in</a>
    </span>
  );
}

function SignOutButton({ label = 'Sign out' }: { label?: string }) {
  return (
    <form action="/api/auth/signout" method="post" style={{ display: 'inline' }}>
      <button type="submit" style={signOutBtn}>{label}</button>
    </form>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

const row: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.6rem',
};
const emailPill: React.CSSProperties = {
  color: '#cbd0d4',
  fontSize: '0.85rem',
  padding: '0.25rem 0.6rem',
  borderRadius: 999,
  border: '1px solid #2a2a2a',
  background: '#15171c',
};
const alphaBadge: React.CSSProperties = {
  color: '#f3b350',
  fontSize: '0.78rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.2rem 0.55rem',
  borderRadius: 999,
  border: '1px solid rgba(243, 179, 80, 0.4)',
  background: 'rgba(243, 179, 80, 0.08)',
};
const deniedBadge: React.CSSProperties = {
  color: '#ef6a6a',
  fontSize: '0.78rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '0.2rem 0.55rem',
  borderRadius: 999,
  border: '1px solid rgba(239, 106, 106, 0.4)',
  background: 'rgba(239, 106, 106, 0.08)',
};
const signInLink: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 500,
};
const signOutBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#9aa0a6',
  border: 0,
  cursor: 'pointer',
  fontSize: '0.85rem',
  textDecoration: 'underline',
  padding: 0,
};
