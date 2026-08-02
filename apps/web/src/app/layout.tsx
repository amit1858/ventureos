import type { ReactNode } from 'react';
import { Nav } from '@/components/Nav';

export const metadata = {
  title: 'Foundry',
  description: 'An AI-native Venture Operating System.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: '#111114',
          color: '#e8e8ea',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <Nav />
        <main style={{ padding: '2rem 1.5rem', maxWidth: 960, margin: '0 auto' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
