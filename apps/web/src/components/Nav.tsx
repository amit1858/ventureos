'use client';

import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';

import { AuthMenu } from './AuthMenu';
import styles from './nav.module.css';

/**
 * Primary navigation, organised around Foundry's operating model:
 *
 *   DISCOVER → EVALUATE → GOVERN → LEARN
 *
 * Each menu groups the tools that already exist under the phase they belong to,
 * with a one-line description so a first-time visitor (PM, founder, architect —
 * not only an AI engineer) understands what each surface does. This is visual
 * grouping only; no new destinations are invented.
 */

type Item = { href: string; label: string; desc: string; advanced?: boolean };
type Group = { id: string; label: string; blurb: string; items: Item[] };

const GROUPS: Group[] = [
  {
    id: 'discover',
    label: 'Discover',
    blurb: 'Understand the customer and the evidence',
    items: [
      { href: '/demo', label: 'Guided demo', desc: 'Walk a seeded venture from idea to build-ready' },
      { href: '/labs/persona', label: 'Personas', desc: 'Simulate buyers and surface their objections', advanced: true },
      { href: '/labs/research-graph', label: 'Research Graph', desc: 'Map evidence, gaps and contradictions', advanced: true },
    ],
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    blurb: 'Decide what deserves to be built',
    items: [
      { href: '/demo', label: 'Guided demo', desc: 'See a venture scored from idea to recommendation' },
      { href: '/labs/venture', label: 'Venture Validation', desc: 'A Proceed / Pivot / Kill call with a confidence score', advanced: true },
      { href: '/labs/buildsquad', label: 'Build Planning', desc: 'Turn a validated venture into a build-ready plan', advanced: true },
    ],
  },
  {
    id: 'govern',
    label: 'Govern',
    blurb: 'Oversee the venture portfolio',
    items: [
      { href: '/ventures', label: 'My Ventures', desc: 'Every venture, its readiness and its latest decision' },
      { href: '/ventures/new', label: 'New Venture', desc: 'Start a new venture from a short brief' },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    blurb: 'See the operating model end to end',
    items: [
      { href: '/demo', label: 'Guided demo', desc: 'Walk a seeded venture from idea to build-ready' },
      { href: '/about', label: 'About Foundry', desc: 'The operating model and the subsystems behind it' },
    ],
  },
];

const menuDivider: React.CSSProperties = {
  margin: '0.5rem 0.5rem 0.2rem',
  paddingTop: '0.5rem',
  borderTop: '1px solid var(--border)',
  fontSize: '0.66rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#6b7280',
};

export function Nav() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  function closeAll() {
    setOpen(null);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!open && !mobileOpen) return;
    function onDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) closeAll();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAll();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, mobileOpen]);

  return (
    <nav ref={navRef} style={navStyle}>
      <Link href="/" style={brand} onClick={closeAll}>
        <span style={brandMark} aria-hidden />
        <strong>Foundry</strong>
      </Link>

      <div className={styles.desktop}>
        <div style={groupRow}>
          {GROUPS.map((g) => (
            <div key={g.id} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-expanded={open === g.id}
                onClick={() => setOpen((cur) => (cur === g.id ? null : g.id))}
                style={{ ...groupBtn, ...(open === g.id ? groupBtnOpen : null) }}
              >
                {g.label}
                <span style={{ ...caret, transform: open === g.id ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>
              {open === g.id && (
                <div style={menu} role="menu">
                  <p style={menuBlurb}>{g.blurb}</p>
                  {g.items.map((it, i) => {
                    const showDivider = it.advanced && !g.items.slice(0, i).some((x) => x.advanced);
                    return (
                      <Fragment key={it.href}>
                        {showDivider && <div style={menuDivider}>Advanced · implementation workspace</div>}
                        <Link href={it.href} style={menuItem} role="menuitem" onClick={() => setOpen(null)}>
                          <span style={menuItemLabel}>{it.label}</span>
                          <span style={menuItemDesc}>{it.desc}</span>
                        </Link>
                      </Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <span style={{ flex: 1 }} />

        <Link href="/demo" style={demoCta} onClick={() => setOpen(null)}>
          Guided demo
        </Link>
        <Link href="/settings/byok" style={keysLink} onClick={() => setOpen(null)}>
          Provider keys
        </Link>
        <AuthMenu />
      </div>

      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d={mobileOpen ? 'M3 3l10 10M13 3L3 13' : 'M2 4h12M2 8h12M2 12h12'} strokeLinecap="round" />
          </svg>
          Menu
        </button>
      </div>

      {mobileOpen && (
        <div className={styles.panel} role="menu">
          <Link href="/demo" style={{ ...demoCta, alignSelf: 'flex-start', marginBottom: '0.35rem' }} onClick={closeAll}>
            Guided demo
          </Link>
          {(() => {
            const seen = new Set<string>(['/demo']);
            return GROUPS.map((g) => {
              const items = g.items.filter((it) => {
                if (seen.has(it.href)) return false;
                seen.add(it.href);
                return true;
              });
              if (items.length === 0) return null;
              return (
                <Fragment key={g.id}>
                  <div className={styles.panelGroupLabel}>{g.label}</div>
                  {items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={styles.panelItem}
                      role="menuitem"
                      onClick={closeAll}
                    >
                      <span className={styles.panelItemLabel}>{it.label}</span>
                      <span className={styles.panelItemDesc}>{it.desc}</span>
                    </Link>
                  ))}
                </Fragment>
              );
            });
          })()}
          <div className={styles.panelActions}>
            <Link href="/settings/byok" style={keysLink} onClick={closeAll}>
              Provider keys
            </Link>
            <AuthMenu />
          </div>
        </div>
      )}
    </nav>
  );
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.75rem 1.5rem',
  borderBottom: '1px solid var(--border)',
  background: '#0b0b0e',
  color: 'var(--text)',
  fontFamily: 'var(--font)',
  position: 'sticky',
  top: 0,
  zIndex: 40,
};
const brand: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: 'var(--text)',
  textDecoration: 'none',
  marginRight: '0.75rem',
  fontSize: '1.02rem',
};
const brandMark: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 4,
  background: 'linear-gradient(135deg, var(--accent), var(--info))',
  boxShadow: '0 0 0 1px var(--accent-line)',
};
const groupRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.15rem' };
const groupBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  background: 'transparent',
  border: '1px solid transparent',
  color: 'var(--muted)',
  fontSize: '0.9rem',
  fontWeight: 500,
  fontFamily: 'var(--font)',
  padding: '0.4rem 0.6rem',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
};
const groupBtnOpen: React.CSSProperties = {
  color: 'var(--text)',
  background: 'var(--surface)',
  borderColor: 'var(--border)',
};
const caret: React.CSSProperties = { fontSize: '0.62rem', color: 'var(--faint)', transition: 'transform 0.15s ease' };
const menu: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 0.4rem)',
  left: 0,
  minWidth: 288,
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow)',
  padding: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
};
const menuBlurb: React.CSSProperties = {
  margin: '0.2rem 0.55rem 0.4rem',
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--faint)',
  fontWeight: 700,
};
const menuItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.1rem',
  padding: '0.5rem 0.55rem',
  borderRadius: 'var(--radius-sm)',
  textDecoration: 'none',
  color: 'var(--text)',
};
const menuItemLabel: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 600 };
const menuItemDesc: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.4 };
const demoCta: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
  border: '1px solid var(--accent-line)',
  background: 'var(--accent-soft)',
  padding: '0.4rem 0.75rem',
  borderRadius: 'var(--radius-pill)',
};
const keysLink: React.CSSProperties = {
  color: 'var(--muted)',
  textDecoration: 'none',
  fontSize: '0.88rem',
};
