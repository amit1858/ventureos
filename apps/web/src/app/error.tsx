'use client';

/**
 * Top-level error boundary for app routes.
 *
 * Catches uncaught render/server errors inside the app/ tree and shows a
 * friendly recovery card instead of a Next.js default error page. We never
 * render `error.message` or `error.stack` to the user — that would leak
 * stack traces and potentially redact-worthy strings to the browser.
 *
 * The optional digest is a short opaque ID Next.js attaches when a server
 * component throws; we surface it so support can correlate logs.
 */
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[app/error]', error.digest ?? 'no-digest');
    }
  }, [error]);

  return (
    <div
      style={{
        maxWidth: 560,
        margin: '6rem auto',
        padding: '1.5rem 1.6rem',
        border: '1px solid #26262c',
        borderRadius: 14,
        background: '#16161a',
        color: '#e8e8ea',
        lineHeight: 1.55,
      }}
    >
      <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8b7bf0', margin: 0, fontWeight: 700 }}>
        Something went wrong
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0.4rem 0 0.6rem' }}>
        That page hit an error.
      </h1>
      <p style={{ color: '#9aa0a6', margin: 0 }}>
        This is usually transient. Try the action again, head back to the homepage, or open the
        seeded demo, which never depends on configuration.
      </p>
      {error.digest ? (
        <p style={{ color: '#71767d', fontSize: 12, marginTop: '0.8rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          Trace: {error.digest}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: 10,
            background: '#8b7bf0',
            color: '#fff',
            border: '1px solid #8b7bf0',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            padding: '0.55rem 1rem',
            borderRadius: 10,
            background: '#1b1b20',
            color: '#e8e8ea',
            border: '1px solid #34343c',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go home
        </Link>
        <Link
          href="/demo/faceless-crm"
          style={{
            padding: '0.55rem 1rem',
            borderRadius: 10,
            background: '#1b1b20',
            color: '#e8e8ea',
            border: '1px solid #34343c',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open the demo
        </Link>
      </div>
    </div>
  );
}
