/**
 * /access/revoke — small confirmation page that submits DELETE /api/access/alpha
 * via a button form. Avoids putting a destructive action on a GET link.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Revoke Alpha Access — VentureOS',
};

export const dynamic = 'force-dynamic';

export default function RevokePage() {
  return (
    <section style={{ maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 0.5rem' }}>Revoke alpha access</h1>
      <p style={{ color: '#9aa0a6', lineHeight: 1.55 }}>
        This will clear the <code>ventureos_alpha_access</code> cookie. Your encrypted BYOK
        credentials remain on the server until you delete them from the BYOK page.
      </p>
      <form
        method="post"
        action="/api/access/alpha?revoke=1"
        style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
      >
        <input type="hidden" name="_method" value="DELETE" />
        {/*
          Browsers can't natively send DELETE from a form. Route handler treats
          POST with ?revoke=1 as a revoke; see api/access/alpha/route.ts.
        */}
        <button
          type="submit"
          formMethod="post"
          formAction="/api/access/alpha?revoke=1"
          style={{
            padding: '0.6rem 1rem',
            background: '#ef6a6a',
            color: '#0b0b0e',
            borderRadius: 6,
            fontWeight: 600,
            border: 0,
            cursor: 'pointer',
          }}
        >
          Revoke alpha access
        </button>
        <Link
          href="/access"
          style={{
            padding: '0.6rem 1rem',
            background: 'transparent',
            color: '#cbd0d4',
            borderRadius: 6,
            border: '1px solid #2a2a2a',
            textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
      </form>
    </section>
  );
}
