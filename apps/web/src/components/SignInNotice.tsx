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
  border: '1px solid #2b3a52',
  borderRadius: 8,
  background: '#141a24',
  marginBottom: '1rem',
};
const msg: CSSProperties = { color: '#cbd7e6', margin: 0, fontSize: '0.92rem', lineHeight: 1.5 };
const row: CSSProperties = { marginTop: '0.7rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' };
const primary: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: 6,
  background: 'var(--accent, #6c8bff)',
  color: '#0b0b0e',
  textDecoration: 'none',
  fontSize: '0.85rem',
  fontWeight: 600,
};
const ghost: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: 6,
  background: 'transparent',
  color: '#cbd0d4',
  border: '1px solid #2a3444',
  textDecoration: 'none',
  fontSize: '0.85rem',
};

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
        <a href={`/signin?next=${encodeURIComponent(next)}`} style={primary}>
          Sign in with Google
        </a>
        <a href="/demo" style={ghost}>
          Explore the demo
        </a>
      </div>
    </div>
  );
}
