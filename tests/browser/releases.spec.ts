import { expect, test, type Page } from '@playwright/test';
import { closeUpgrades, loadSave, openUpgrades } from './helpers';
import { progressedRun, saveText } from './fixtures';
import type { RunState } from '../../src/game/types';

/** A run at the Terminal Agent (window v0.1 open) with enough code to ship it. */
function readyToShip(seed: number): RunState {
  const run = progressedRun(4, false, seed);
  return { ...run, economy: { ...run.economy, output: run.economy.output + 2500 } };
}

async function ship(page: Page) {
  await openUpgrades(page);
  const card = page.locator('[data-release="1"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Ship v0.1');
  await card.click();
  await expect(page.getByTestId('release-wheel')).toBeVisible();
}

test('ship a release: wheel, result, back to work, a frame on the wall, the card gone', async ({
  page,
}) => {
  await loadSave(page, saveText(readyToShip(41)));
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-release-frames', '0');
  await ship(page);
  await expect(page.getByTestId('wheel-odds')).toContainText('RETIRE: 0.2 %');
  // After a second a tap skips the spin to the committed result.
  await page.waitForTimeout(1100);
  await page.getByTestId('release-wheel').click();
  await expect(page.getByTestId('release-result')).toBeVisible();
  await expect(page.getByTestId('release-wheel')).toContainText('Top comment:');
  await page.getByRole('button', { name: 'BACK TO WORK' }).click();
  await expect(page.getByTestId('release-wheel')).toHaveCount(0);
  // The next release is on offer at once — and all the code is gone.
  await openUpgrades(page);
  await expect(page.locator('[data-release="2"]')).toContainText('Ship v0.2');
  await expect(page.locator('[data-release="1"]')).toHaveCount(0);
  await closeUpgrades(page);
  await expect(page.getByRole('list', { name: 'Recent events' })).toContainText('Shipped v0.1:');
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-release-frames', '1');

  // A reload never replays the wheel; the release stays in History.
  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await expect(page.getByTestId('release-wheel')).toHaveCount(0);
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('ol.timeline')).toContainText(/Shipped v0\.1: /);
});

test('the wheel fits a 390 px screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await loadSave(page, saveText(readyToShip(41)));
  await ship(page);
  const box = await page.getByTestId('release-wheel').boundingBox();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

for (const catAlive of [true, false]) {
  test(`jackpot: the ending waits for the wheel, then the beach ${catAlive ? 'with' : 'without'} the cat`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    let run = readyToShip(1868);
    if (!catAlive) {
      run = { ...run, cat: { ...run.cat, alive: false, health: 0, diedAtActiveMs: run.activeMs } };
    }
    await loadSave(page, saveText(run));
    await ship(page);
    await expect(page.getByTestId('ending-panel')).toHaveCount(0);
    await expect(page.getByTestId('ending-panel')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('release-wheel')).toHaveCount(0);
    await expect(page.getByTestId('ending-panel')).toContainText('The Infinite Weekend');
    await expect(page.getByTestId('ending-picture')).toHaveAttribute(
      'data-picture',
      catAlive ? 'ending-infinite-weekend' : 'ending-infinite-weekend-nocat',
    );
    await expect(page.getByTestId('ending-panel')).toContainText(
      catAlive ? 'The cat sleeps on your chest.' : 'The hammock has room for two.',
    );
  });
}
