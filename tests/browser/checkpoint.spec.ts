import { expect, test } from '@playwright/test';
import { loadSave, openUpgrades } from './helpers';
import { saveWithProfile, untilChoice } from './fixtures';

test('save a checkpoint, take an ending, load it back and take another', async ({ page }) => {
  test.setTimeout(120_000);
  await loadSave(page, saveWithProfile(untilChoice('remove-oversight'), []));
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: 'SAVE CHECKPOINT' }).click();
  await expect(page.getByTestId('checkpoint-info')).toContainText('28 technologies');
  await page.getByRole('button', { name: 'Close settings' }).click();

  await openUpgrades(page);
  await page.locator('[data-choice="remove-oversight"]').click();
  await page.getByRole('button', { name: 'YES' }).click();
  await expect(page.getByTestId('ending-panel')).toContainText('You Have Been Optimized');

  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: 'LOAD CHECKPOINT' }).click();
  await page.getByRole('button', { name: 'LOAD IT' }).click();
  await expect(page.getByTestId('ending-panel')).toHaveCount(0);
  await expect(page.getByTestId('primary-action')).toBeVisible();

  await openUpgrades(page);
  await page.locator('[data-choice="keep-approval"]').click();
  await page.getByRole('button', { name: 'YES' }).click();
  await expect(page.getByTestId('ending-panel')).toContainText('The Human Approval API');
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('section.endings li')).toHaveCount(2);
});
