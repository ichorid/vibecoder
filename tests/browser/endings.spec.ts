import { expect, test } from '@playwright/test';
import { loadSave } from './helpers';
import { saveWithProfile, untilChoice } from './fixtures';

test('an ending, frozen Cat/History, restart with retained discoveries, then another ending', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loadSave(page, saveWithProfile(untilChoice('ship-original'), []));
  const card = page.locator('[data-choice="ship-original"]');
  await expect(card).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Three Users');
  await card.click();
  await expect(page.getByRole('group', { name: /Confirm/ })).toContainText('This ends the run.');
  await page.getByRole('button', { name: 'YES' }).click();

  const panel = page.getByTestId('ending-panel');
  await expect(panel).toContainText('Three Users');
  await expect(panel).toContainText('You shipped the app.');
  await expect(page.getByTestId('primary-action')).toHaveCount(0);

  // Cat and History stay open; needs are frozen.
  await page.getByTestId('cat-button').click();
  const fullness = page.locator('.meter', { hasText: 'Fullness' }).locator('.value');
  const before = await fullness.textContent();
  await page.waitForTimeout(6000);
  expect(await fullness.textContent()).toBe(before);
  await page.getByRole('button', { name: '← GAME' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('section.endings')).toContainText('Three Users');
  await page.getByRole('button', { name: '← GAME' }).click();

  // Restart: cancel first (nothing changes), then confirm.
  await page.getByRole('button', { name: 'NEW RUN…' }).click();
  await page.getByRole('button', { name: 'CANCEL' }).click();
  await expect(panel).toBeVisible();
  await page.getByRole('button', { name: 'NEW RUN…' }).click();
  await page.getByRole('button', { name: 'START NEW RUN' }).click();
  await expect(page.getByTestId('primary-action')).toHaveText('WRITE CODE');
  await expect(page.getByTestId('ending-panel')).toHaveCount(0);
  await expect(page.getByTestId('cat-button')).not.toHaveAttribute('aria-label', 'Cat. Gone.');
  await page.reload();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('section.endings')).toContainText('Three Users');
});

test('a second ending is added to the profile without duplicating the first', async ({ page }) => {
  test.setTimeout(120_000);
  const run = untilChoice('remove-oversight');
  await loadSave(
    page,
    saveWithProfile(run, [{ id: 'three-users', runId: 'earlier', activeMs: 300_000, order: 1 }]),
  );
  await page.locator('[data-choice="remove-oversight"]').click();
  await page.getByRole('button', { name: 'YES' }).click();
  await expect(page.getByTestId('ending-panel')).toContainText('You Have Been Optimized');
  await page.getByRole('button', { name: 'HISTORY' }).click();
  const endings = page.locator('section.endings li');
  await expect(endings).toHaveCount(2);
  await expect(endings.nth(0)).toContainText('Three Users');
  await expect(endings.nth(1)).toContainText('You Have Been Optimized');
});
