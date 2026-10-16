import { expect, test } from '@playwright/test';
import { freshGame, headerStat, pressPrimary } from './helpers';

test('first loop: write, buy, announce, visit Cat, next offer, reload', async ({ page }) => {
  await freshGame(page);
  await expect(page.locator('body')).not.toContainText('Generated snippets');

  await pressPrimary(page, 10);
  const autocomplete = page.getByRole('button', { name: /Autocomplete/ });
  await expect(autocomplete).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('Generated snippets');
  await autocomplete.click();

  const announcement = page.getByTestId('announcement');
  await expect(announcement).toContainText('NEW TECHNOLOGY');
  await expect(announcement).toContainText('Autocomplete');
  await expect(page.locator('body')).not.toContainText('Generated snippets');

  await page.getByTestId('cat-button').click();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
  await page.getByRole('button', { name: '← GAME' }).click();
  await expect(announcement).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(announcement).toHaveCount(0);

  await expect(page.getByRole('button', { name: /Generated snippets/ })).toBeVisible();
  await pressPrimary(page, 4);
  await expect.poll(() => headerStat(page)).toBe('8');

  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await expect.poll(() => headerStat(page)).toBe('8');
  await expect(page.getByRole('button', { name: /Generated snippets/ })).toBeVisible();
  await expect(page.getByTestId('announcement')).toHaveCount(0);
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.getByRole('list').first()).toContainText('Autocomplete');
});

test('each accepted press floats its real gain up from the button', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const button = page.getByTestId('primary-action');
  await button.click();
  const float = page.getByTestId('floating-gain').first();
  await expect(float).toHaveText('+1');
  // It removes itself when its animation ends.
  await expect(page.getByTestId('floating-gain')).toHaveCount(0, { timeout: 3000 });
});
