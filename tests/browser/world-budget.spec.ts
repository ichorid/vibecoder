import { expect, test } from '@playwright/test';
import { freshGame, loadSave, pressPrimary } from './helpers';
import { progressedRun, saveText } from './fixtures';

test('the world ticker stops while Game is hidden and resumes on return', async ({ page }) => {
  await freshGame(page);
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).toHaveAttribute('data-ticker', 'running');
  await page.getByTestId('cat-button').click();
  await expect(canvas).toHaveAttribute('data-ticker', 'stopped');
  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect(canvas).toHaveAttribute('data-ticker', 'running');
});

test('ordinary updates never rebuild the scene sprites', async ({ page }) => {
  await loadSave(page, saveText(progressedRun(3)));
  const canvas = page.getByTestId('world-canvas');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-sprites')))
    .toBeGreaterThan(10);
  const count = await canvas.getAttribute('data-sprites');
  await pressPrimary(page, 15);
  await page.waitForTimeout(1500);
  expect(await canvas.getAttribute('data-sprites')).toBe(count);
});

test('a failed illustration shows a fallback and never blocks the discovery', async ({ page }) => {
  await page.route('**/assets/technologies/**', (route) => route.abort());
  await freshGame(page);
  await pressPrimary(page, 10);
  await page.getByRole('button', { name: /Autocomplete/ }).click();
  const announcement = page.getByTestId('announcement');
  await expect(announcement.locator('.fallback')).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.getByRole('button', { name: /Generated snippets/ })).toBeVisible();
});
