import Link from 'next/link';

const links: { href: string; label: string }[] = [
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
        gap: '1rem',
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #2a2a2a',
        background: '#0b0b0e',
        color: '#e8e8ea',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <strong style={{ marginRight: '1rem' }}>VentureOS</strong>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{ color: '#9aa0a6', textDecoration: 'none' }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
