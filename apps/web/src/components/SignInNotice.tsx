import type { CSSProperties } from 'react';

/**
 * Informational (not error) notice shown when a surface needs sign-in.
 *
 * Signing in is optional — the guided demo works with no account and no keys —
 * so this is styled as a calm, neutral notice rather than a red warning. Red
 * styling is reserved for genuine failures.
 */

const wrap: CSSProperties = {
  padding: '0.85rem 1.1rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  background: 'var(--surface-2)',
  marginBottom: '1rem',
};
const msg: CSSProperties = { color: 'var(--muted)', margin: 0, fontSize: '0.92rem', lineHeight: 1.5 };
const row: CSSProperties = { marginTop: '0.7rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' };

export function SignInNotice({
  next,
  message = 'Sign in to save and manage your own ventures — or keep exploring the guided demo. No account or keys needed.',
}: {
  next: string;
  message?: string;
}) {
  return (
    <div style={wrap} role="note">
      <p style={msg}>{message}</p>
      <div style={row}>
        <a href={`/signin?next=${encodeURIComponent(next)}`} className="fdry-btn fdry-btn--primary fdry-btn--sm">
          Sign in with Google
        </a>
        <a href="/demo" className="fdry-btn fdry-btn--ghost fdry-btn--sm">
          Explore the demo
        </a>
      </div>
    </div>
  );
}
