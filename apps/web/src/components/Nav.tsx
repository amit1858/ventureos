import Link from 'next/link';

import { AuthMenu } from './AuthMenu';

const links: { href: string; label: string; accent?: boolean }[] = [
  { href: '/demo', label: 'Demo', accent: true },
  { href: '/ventures', label: 'My Ventures' },
  { href: '/ventures/new', label: 'Create Venture' },
  { href: '/labs/persona', label: 'PersonaLab' },
  { href: '/labs/research-graph', label: 'Research' },
  { href: '/labs/venture', label: 'VentureLab' },
  { href: '/labs/buildsquad', label: 'BuildSquad' },
  { href: '/settings/byok', label: 'BYOK Keys' },
];

export function Nav() {
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #2a2a2a',
        background: '#0b0b0e',
        color: '#e8e8ea',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Link href="/" style={{ color: '#e8e8ea', textDecoration: 'none', marginRight: '0.5rem' }}>
        <strong>VentureOS</strong>
      </Link>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={
            l.accent
              ? {
                  color: '#c8bfff',
                  textDecoration: 'none',
                  fontWeight: 600,
                  border: '1px solid rgba(139, 123, 240, 0.4)',
                  background: 'rgba(139, 123, 240, 0.14)',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 999,
                }
              : { color: '#9aa0a6', textDecoration: 'none' }
          }
        >
          {l.label}
        </Link>
      ))}
      <span style={{ flex: 1 }} />
      <AuthMenu />
    </nav>
  );
}
