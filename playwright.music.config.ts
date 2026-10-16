import { defineConfig, devices } from '@playwright/test';

/** `npm run test:music-browser`: real Tone/Web Audio checks against the dev-server fixture. */
export default defineConfig({
  testDir: 'tests/browser',
  testMatch: /music-.*\.spec\.ts/,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5174' },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/tests/music/browser/fixture.html',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
});
