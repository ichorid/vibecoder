import { expect, test } from '@playwright/test';
import { buildCard, closeUpgrades, freshGame, openUpgrades, pressPrimary } from './helpers';

test('first loop: write, build, announce, visit Cat, next offer, reload', async ({ page }) => {
  // 24 real presses at the tap budget: ~35 s on a fast runner, over a minute on a slow one.
  test.setTimeout(120_000);
  await freshGame(page);
  await expect(page.locator('body')).not.toContainText('Generated snippets');

  // The first presses go into the original project; then the first card appears.
  await pressPrimary(page, 5);
  await openUpgrades(page);
  const autocomplete = page.getByRole('button', { name: /Autocomplete/ });
  await expect(autocomplete).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('Generated snippets');
  await closeUpgrades(page);
  await buildCard(page, /Autocomplete/);

  const announcement = page.getByTestId('announcement');
  await expect(announcement).toContainText('NEW TECHNOLOGY');
  await expect(announcement).toContainText('Autocomplete');
  await expect(page.locator('body')).not.toContainText('Generated snippets');

  await page.getByTestId('cat-button').click();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect(announcement).toBeVisible();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(announcement).toHaveCount(0);

  await openUpgrades(page);
  await expect(page.getByRole('button', { name: /Generated snippets/ })).toBeVisible();
  await closeUpgrades(page);
  // Nothing picked after the build: presses drift into the original project at half speed.
  await expect(page.getByTestId('ship-strip')).toContainText('AUTO · ½');
  await pressPrimary(page, 4);
  await expect(page.getByTestId('ship-strip')).toContainText('9/2K');

  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await expect(page.getByTestId('ship-strip')).toContainText('9/2K');
  await openUpgrades(page);
  await expect(page.getByRole('button', { name: /Generated snippets/ })).toBeVisible();
  await expect(page.getByTestId('announcement')).toHaveCount(0);
  await closeUpgrades(page);
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
