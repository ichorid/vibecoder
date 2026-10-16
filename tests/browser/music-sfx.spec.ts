import { expect, test } from '@playwright/test';

test('care sound effects over full music stay below clipping', async ({ page }) => {
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  const result = (await page.evaluate(() =>
    (window as unknown as { musicFixture: { sfxMix(): Promise<unknown> } }).musicFixture.sfxMix(),
  )) as { windows: number[]; peak: number };
  expect(result.peak).toBeLessThan(1);
  expect(Math.max(...result.windows)).toBeGreaterThan(0.01);
});
