import { expect, test } from '@playwright/test';
import { freshGame, headerStat, pressPrimary } from './helpers';

test('a second tab waits without running or writing, then continues from the latest save', async ({
  page,
  context,
}) => {
  await freshGame(page);
  await pressPrimary(page, 4);

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('tab-panel')).toContainText('open in another tab');
  await expect(second.getByTestId('primary-action')).toHaveCount(0);

  // The first tab keeps playing and saving; the waiting tab never writes.
  await pressPrimary(page, 3);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const latest = await page.evaluate(() => localStorage.getItem('vibe-coder.save'));
  await second.waitForTimeout(800);
  expect(await page.evaluate(() => localStorage.getItem('vibe-coder.save'))).toBe(latest);

  await page.close();
  await expect(second.getByTestId('primary-action')).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => headerStat(second)).toBe('7');
});

test('without Web Locks, a tab that sees a newer save from another tab stops writing (best effort)', async ({
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'locks', {
      configurable: true,
      get: () => undefined,
    });
  });
  const first = await context.newPage();
  await first.goto('/');
  await first.evaluate(() => localStorage.clear());
  await first.reload();
  await expect(first.getByTestId('primary-action')).toBeVisible();
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('primary-action')).toBeVisible();

  // The first tab writes newer progress (a purchase saves immediately).
  await pressPrimary(first, 12);
  await first.getByRole('button', { name: /Autocomplete/ }).click();
  await expect(second.getByTestId('tab-panel')).toContainText('continued in another tab');
  const saved = await first.evaluate(() => localStorage.getItem('vibe-coder.save'));
  await second.waitForTimeout(800);
  expect(await first.evaluate(() => localStorage.getItem('vibe-coder.save'))).toBe(saved);
});
