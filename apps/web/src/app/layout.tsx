import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

import './globals.css';

const TITLE = 'Foundry — AI-native Venture Operating System';
const DESCRIPTION =
  'Foundry helps product teams decide what deserves to be built before engineering begins — turning raw ideas into validated, execution-ready ventures.';

export const viewport: Viewport = {
  themeColor: '#8b7bf0',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ventureos-dun.vercel.app'),
  applicationName: 'Foundry',
  title: {
    default: TITLE,
    template: '%s · Foundry',
  },
  description: DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  keywords: [
    'venture operating system',
    'AI product validation',
    'idea validation',
    'agent workflows',
    'product discovery',
    'venture evaluation',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Foundry',
    title: TITLE,
    description: DESCRIPTION,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="app-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
