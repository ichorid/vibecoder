import { expect, test } from '@playwright/test';
import { freshGame, headerStat, pressPrimary } from './helpers';

test('one real Pixi canvas survives Game → Cat → Game and resizing', async ({ page }) => {
  await freshGame(page);
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).toHaveCount(1);
  await canvas.evaluate((el) => {
    (el as HTMLCanvasElement & { marker?: string }).marker = 'first';
  });
  const pixels = await canvas.evaluate((el) => (el as HTMLCanvasElement).width);
  expect(pixels).toBeGreaterThan(0);

  await pressPrimary(page, 3);
  await page.getByTestId('cat-button').click();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect(page.getByTestId('world-canvas')).toHaveCount(1);
  expect(
    await page
      .getByTestId('world-canvas')
      .evaluate((el) => (el as HTMLCanvasElement & { marker?: string }).marker),
  ).toBe('first');

  const before = await headerStat(page);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.setViewportSize({ width: 412, height: 860 });
  await expect(page.getByTestId('world-canvas')).toHaveCount(1);
  expect(await headerStat(page)).toBe(before);
});
