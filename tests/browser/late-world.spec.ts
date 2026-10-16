import { expect, test } from '@playwright/test';
import { loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

test('the final scene builds all 28 additions; the living cat is no longer visible', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const run = progressedRun(28);
  expect(run.cat.alive).toBe(true);
  await loadSave(page, saveText(run));
  const canvas = page.getByTestId('world-canvas');
  await expect
    .poll(async () => ((await canvas.getAttribute('data-built')) ?? '').split(',').length)
    .toBe(29);
  await expect(canvas).toHaveAttribute('data-cat-lod', 'hidden');
  await expect(page.getByTestId('primary-action')).toHaveText('OBSERVE');
  await expect(page.locator('header')).toContainText('Revenue');
  // The cat still exists: its status lives on in the header and Cat view.
  await expect(page.getByTestId('cat-button')).not.toHaveAttribute('aria-label', 'Cat. Gone.');
  // Rough headless frame timing (not a device measurement).
  const frameMs = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const times: number[] = [];
        let last = performance.now();
        const loop = () => {
          const now = performance.now();
          times.push(now - last);
          last = now;
          if (times.length < 60) requestAnimationFrame(loop);
          else resolve(times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)] ?? 0);
        };
        requestAnimationFrame(loop);
      }),
  );
  console.info(`headless p95 rAF interval with the final scene: ${frameMs.toFixed(1)} ms`);
  const sprites = Number(await canvas.getAttribute('data-sprites'));
  console.info(`final scene sprites: ${sprites}`);
  expect(sprites).toBeLessThan(2000);
});
