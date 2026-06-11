import { defineConfig } from 'vitest/config';

/**
 * Web test config.
 *
 * The app's tsconfig uses `jsx: "preserve"` (Next handles JSX at build time),
 * but Vitest transpiles test files with esbuild, which would choke on preserved
 * JSX. Forcing the automatic runtime lets `.test.tsx` files render components
 * via `react-dom/server` without a manual React import. Node environment is
 * sufficient — we assert on static markup, no DOM required.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
  },
});
