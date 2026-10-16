import { expect, test, type Page } from '@playwright/test';
import { loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

const saved = async (page: Page) =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('vibe-coder.save'))) ?? '{}') as {
    run: { activeMs: number; unlockedTechnologyIds: string[]; cat: { alive: boolean } };
  };

async function loseContext(page: Page, restore: boolean) {
  await page.evaluate((r) => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="world-canvas"]');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (!ext) throw new Error('WEBGL_lose_context unavailable');
    (window as unknown as { __lose: WEBGL_lose_context }).__lose = ext;
    if (!r) ext.loseContext();
    else ext.restoreContext();
  }, restore);
}

test('a lost WebGL context pauses the game, keeps the run, and rebuilds the same world', async ({
  page,
}) => {
  await loadSave(page, saveText(progressedRun(3)));
  const canvas = page.getByTestId('world-canvas');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-sprites')))
    .toBeGreaterThan(10);
  const sprites = Number(await canvas.getAttribute('data-sprites'));
  const before = await saved(page);

  await loseContext(page, false);
  await expect(page.getByTestId('graphics-warning')).toContainText('game is paused');
  const pausedAt = (await saved(page)).run.activeMs;
  await page.waitForTimeout(1500);
  expect((await saved(page)).run.activeMs).toBe(pausedAt);

  await page.evaluate(() =>
    (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext(),
  );
  await expect(page.getByTestId('graphics-warning')).toHaveCount(0, { timeout: 10_000 });
  await expect
    .poll(async () => Number(await page.getByTestId('world-canvas').getAttribute('data-sprites')))
    .toBe(sprites);
  await expect(page.getByTestId('world-canvas')).toHaveCount(1);
  const after = await saved(page);
  expect(after.run.unlockedTechnologyIds).toEqual(before.run.unlockedTechnologyIds);
  expect(after.run.cat.alive).toBe(true);
});
