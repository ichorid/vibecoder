import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('browser Web Crypto and node:crypto agree on the review content hash', async ({ page }) => {
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  const result = (await page.evaluate(() =>
    (
      window as unknown as { musicFixture: { hashParity(): Promise<unknown> } }
    ).musicFixture.hashParity(),
  )) as { canonical: string; hash: string };
  expect(result.canonical.length).toBeGreaterThan(500);
  expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(result.hash).toBe(createHash('sha256').update(result.canonical, 'utf8').digest('hex'));
});
