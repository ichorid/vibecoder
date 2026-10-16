import { expect, test } from '@playwright/test';
import { loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

test('the stats panel opens the setup with the economy, stacked upgrades and technologies', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const run = progressedRun(9);
  await loadSave(
    page,
    saveText({ ...run, upgradeLevels: { ...run.upgradeLevels, 'compute-slot': 2 } }),
  );
  await page.getByTestId('open-setup').click();
  const setup = page.getByTestId('setup-view');
  await expect(setup).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SETUP' })).toBeVisible();
  await expect(page.getByTestId('setup-total')).toContainText('code/s');
  await expect(page.getByTestId('setup-stacked')).toContainText('Compute slot');
  // Capacity has no practical cap any more: the level alone.
  await expect(page.getByTestId('setup-stacked')).toContainText('×2');
  await expect(page.getByTestId('setup-stacked')).not.toContainText('×2/');
  await expect(page.getByTestId('setup-technologies').locator('li')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  // Back to the game, by the button and by the browser's back gesture.
  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await page.getByTestId('open-setup').click();
  await expect(setup).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('primary-action')).toBeVisible();
});

test('the stats line in the upgrades popup opens the setup, and back returns to the popup', async ({
  page,
}) => {
  await loadSave(page, saveText(progressedRun(9)));
  await page.getByTestId('offers-toggle').click();
  const sheet = page.getByTestId('offers-sheet');
  await sheet.getByTestId('open-setup').click();
  await expect(page.getByTestId('setup-view')).toBeVisible();
  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('setup-view')).toHaveCount(0);
});
