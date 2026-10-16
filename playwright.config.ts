import { defineConfig, devices } from '@playwright/test';

/** Browser acceptance runs against the production build served by `vite preview`. */
export default defineConfig({
  testDir: 'tests/browser',
  // Real-Tone fixture specs run against the dev server (playwright.music.config.ts).
  testIgnore: /music-.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Presses wait for the tap budget (about 3 per second); under a fully parallel run each real
  // click is slow, so buying the first card can take ~25 s.
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
  ],
});
