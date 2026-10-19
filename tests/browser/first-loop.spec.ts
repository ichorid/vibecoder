import { expect, test } from '@playwright/test';
import { buildCard, builtCode, closeDeck, freshGame, laneItem, pressPrimary } from './helpers';

test('first loop: write, build, announce, visit Cat, next offer, reload', async ({ page }) => {
  // Real presses, a reload and a Cat visit: generous for a slow runner.
  test.setTimeout(120_000);
  await freshGame(page);
  await expect(page.locator('body')).not.toContainText('Generated snippets');

  // The first presses go into the original project; then the first card appears.
  await pressPrimary(page, 5);
  const autocomplete = laneItem(page, /Autocomplete/);
  await expect(autocomplete).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('Generated snippets');
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

  // The build is done and nothing is picked: the lane asks what next, in place.
  await expect(page.getByTestId('deck-expanded')).toContainText('WHAT NEXT?');
  await expect(page.getByRole('button', { name: /Generated snippets/ }).first()).toBeVisible();
  // Meanwhile presses drift into the original project at half speed, and it says so.
  await expect(page.getByTestId('build-row')).toContainText('AUTO · ½');
  await expect(page.getByTestId('deck-tax')).toContainText('at ½ while you decide');
  await closeDeck(page);
  await pressPrimary(page, 4);
  await expect.poll(() => builtCode(page)).toBe('9');

  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await expect.poll(() => builtCode(page)).toBe('9');
  await expect(laneItem(page, /Generated snippets/)).toBeAttached();
  await expect(page.getByTestId('announcement')).toHaveCount(0);
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.getByRole('list').first()).toContainText('Autocomplete');
});

test('a press of code flies into the build it fills', async ({ page }) => {
  await freshGame(page);
  await page.getByTestId('primary-action').click();
  // The original project is the first build: the "+1" flies into its build row.
  await expect(page.locator('[data-testid="floating-gain"][data-flies="build"]')).toHaveCount(1);
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
