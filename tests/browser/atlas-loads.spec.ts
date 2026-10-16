import { expect, test } from '@playwright/test';
import { loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

test('the sprite atlas loads once per theme, not on every game snapshot', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => {
    if (/sprites-(light|dark)\.json/.test(request.url())) requests += 1;
  });
  await loadSave(page, saveText(progressedRun(6)));
  // Game, Cat and History while the simulation keeps producing snapshots.
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId('cat-button').click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: '← BACK TO CODE' }).click();
    await page.getByRole('button', { name: 'HISTORY' }).click();
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: '← GAME' }).click();
    await page.getByTestId('primary-action').click();
  }
  // One for the world renderer, one for DOM sprites (header, Cat view), for the light theme.
  expect(requests).toBeLessThanOrEqual(2);
});
