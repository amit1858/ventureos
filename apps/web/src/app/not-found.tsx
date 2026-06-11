import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Not found · VentureOS',
};

export default function NotFound() {
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
        404
      </p>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0.4rem 0 0.6rem' }}>
        That page isn&apos;t here.
      </h1>
      <p style={{ color: '#9aa0a6', margin: 0 }}>
        The URL may have changed, the venture may not exist, or you may not have access. Try the
        homepage, your ventures dashboard, or the seeded demo.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
        <Link
          href="/"
          style={{
            padding: '0.55rem 1rem',
            borderRadius: 10,
            background: '#8b7bf0',
            color: '#fff',
            border: '1px solid #8b7bf0',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go home
        </Link>
        <Link
          href="/ventures"
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
          My ventures
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
