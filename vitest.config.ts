import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@game': path.resolve('src/game'),
      '@ui': path.resolve('src/ui'),
      '@content': path.resolve('src/content'),
      '@app': path.resolve('src/app'),
      '@world': path.resolve('src/world'),
      '@persistence': path.resolve('src/persistence'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'tools/*.test.ts'],
    environment: 'node',
  },
});
