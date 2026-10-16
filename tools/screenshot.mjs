// Dev utility: screenshot the running preview (`npx vite preview --port 4173`) for visual review.
// Usage: node tools/screenshot.mjs <out.png> [width] [height] [clicks] [theme]
import { chromium } from '@playwright/test';

const [out = 'shot.png', width = '390', height = '844', clicks = '0', theme = 'light'] =
  process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});
await page.goto('http://127.0.0.1:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
for (let i = 0; i < Number(clicks); i += 1) await page.getByTestId('primary-action').click();
if (theme === 'dark') {
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.keyboard.press('Escape');
}
await page.waitForTimeout(500);
await page.screenshot({ path: out });
await browser.close();
