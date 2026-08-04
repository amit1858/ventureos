import Link from 'next/link';

const year = new Date().getFullYear();

/**
 * Global footer. Gives every page a consistent trust surface: what the product
 * is, links to About / Security / Privacy, the repository, and a short, factual
 * note on the product's history.
 */
export function Footer() {
  return (
    <footer className="fdry-footer">
      <div className="fdry-footer-inner">
        <span>
          <strong style={{ color: 'var(--text)' }}>Foundry</strong> · An AI-native Venture
          Operating System
        </span>
        <span className="fdry-footer-spacer" />
        <Link href="/about">About</Link>
        <Link href="/security">Security</Link>
        <Link href="/privacy">Privacy</Link>
        <a href="https://github.com/amit1858/foundry-venture-os" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span style={{ color: 'var(--faint)' }}>© {year} Foundry</span>
      </div>
    </footer>
  );
}
