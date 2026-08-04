import type { MetadataRoute } from 'next';

/**
 * Web app manifest — gives the installed/browser app a consistent Foundry
 * identity (name, theme colour, icon) instead of the framework default.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Foundry — AI-native Venture Operating System',
    short_name: 'Foundry',
    description:
      'Foundry helps product teams decide what deserves to be built before engineering begins.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0d10',
    theme_color: '#8b7bf0',
    icons: [{ src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
  };
}
