import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      '@game': path.resolve('src/game'),
      '@ui': path.resolve('src/ui'),
      '@content': path.resolve('src/content'),
      '@app': path.resolve('src/app'),
      '@world': path.resolve('src/world'),
      '@persistence': path.resolve('src/persistence'),
    },
    // Component tests run Svelte's client runtime under jsdom.
    conditions: ['browser'],
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'tools/**/*.test.ts', 'art/**/*.test.ts'],
    exclude: ['src/music/**', 'tests/music/**', 'tools/music/**', 'node_modules/**'],
    environment: 'node',
    // Whole-run scenarios take 2–4 s locally; shared CI runners need headroom over the 5 s default.
    testTimeout: 30_000,
    setupFiles: ['tests/helpers/yieldBetweenTests.ts'],
    // Long synchronous simulations on a small CI runner starve the main process when every core
    // runs a worker (Vitest then times out on worker RPC); two workers leave it room.
    ...(process.env.CI ? { maxWorkers: 2, minWorkers: 1 } : {}),
  },
});
