import { expect, test, type Page } from '@playwright/test';
import { loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';
import type { RunState } from '../../src/game/types';

/** A run at the Terminal Agent with code for a demo (and some left over). */
function readyForDemo(seed: number): RunState {
  const run = progressedRun(4, false, seed);
  return { ...run, economy: { ...run.economy, output: run.economy.output + 5000 } };
}

/** How many canvas pixels are not black (the picture really is drawn). */
const litPixels = (page: Page) =>
  page
    .getByTestId('demo-screen')
    .locator('canvas.picture')
    .evaluate((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4)
        if ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0) > 60) lit++;
      return lit;
    });

test('code a demo: depacking, a drawn picture, the title card; History plays it again', async ({
  page,
}) => {
  await loadSave(page, saveText(readyForDemo(41)));
  await expect(page.getByTestId('demo-design')).toHaveCount(0); // designing is on the demo screen
  const strip = page.getByTestId('demo-strip');
  await expect(strip).toContainText('DEMO #1');
  await strip.click();
  const demo = page.getByTestId('demo-screen');
  await expect(demo).toBeVisible();
  await expect(demo).toHaveAttribute('data-phase', 'play', { timeout: 5000 });
  await expect(page.getByTestId('demo-title')).not.toBeEmpty();
  await expect.poll(() => litPixels(page)).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'CLOSE' }).click();
  await expect(demo).toHaveCount(0);
  await expect(page.getByTestId('demo-strip')).toContainText('DEMO #2');
  await expect(page.getByRole('list', { name: 'Recent events' })).toContainText('It does nothing.');

  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await expect(page.getByTestId('demo-screen')).toHaveCount(0);
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await page.getByRole('button', { name: 'Watch demo 1' }).click();
  await expect(page.getByTestId('demo-screen')).toHaveAttribute('data-phase', 'play', {
    timeout: 5000,
  });
});

test('the demo fits a 390 px screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await loadSave(page, saveText(readyForDemo(41)));
  await page.getByTestId('demo-strip').click();
  await expect(page.getByTestId('demo-screen')).toHaveAttribute('data-phase', 'play', {
    timeout: 5000,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // the picture, the designer's four choices and CLOSE all fit without scrolling
  await expect(page.getByTestId('demo-variant-0')).toHaveAttribute('data-fingerprint', /./, {
    timeout: 5000,
  });
  for (const id of ['demo-variant-0', 'demo-mystery']) {
    const box = await page.getByTestId(id).boundingBox();
    expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  }
  const close = await page.getByRole('button', { name: 'CLOSE' }).boundingBox();
  expect((close?.y ?? 1e9) + (close?.height ?? 0)).toBeLessThanOrEqual(700);
});

test('the demo screen offers the next demo: the picked preview is what gets coded', async ({
  page,
}) => {
  await loadSave(page, saveText(readyForDemo(41)));
  await page.getByTestId('demo-strip').click();
  const demo = page.getByTestId('demo-screen');
  await expect(demo).toHaveAttribute('data-phase', 'play', { timeout: 5000 });
  const variant = demo.getByTestId('demo-variant-2');
  await expect(variant).toHaveAttribute('data-fingerprint', /^[0-9a-f]{8}$/, { timeout: 5000 });
  const wanted = await variant.getAttribute('data-fingerprint');
  await variant.click();
  await expect(variant).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'CLOSE' }).click();
  // a reload keeps the design
  await page.reload();
  await page.getByTestId('demo-strip').click();
  await expect(demo).toHaveAttribute('data-phase', 'play', { timeout: 5000 });
  await expect(demo).toHaveAttribute('data-fingerprint', wanted ?? '');
  await expect(demo.getByTestId('demo-designer')).toContainText('DESIGN DEMO #3');
  await demo.getByTestId('demo-mystery').click();
  await expect(demo.getByTestId('demo-mystery')).toHaveAttribute('aria-checked', 'true');
});

test('the Demo lab is a dev-server page only', async ({ page }) => {
  await loadSave(page, saveText(readyForDemo(41)));
  await page.getByRole('button', { name: /settings/i }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByTestId('demo-lab-open')).toHaveCount(0);
});
