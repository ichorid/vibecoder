import { defineConfig } from 'vitest/config';

/** `npm run test:music`: music core, director, data and tools (no browser audio). */
export default defineConfig({
  test: {
    include: ['src/music/**/*.test.ts', 'tests/music/**/*.test.ts', 'tools/music/**/*.test.ts'],
    environment: 'node',
  },
});
