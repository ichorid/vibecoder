import { expect, test, type Page } from '@playwright/test';
import { builtCode, loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

const canvas = (page: Page) => page.getByTestId('world-canvas');
const zoom = async (page: Page) => Number(await canvas(page).getAttribute('data-zoom'));

async function centre(page: Page) {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('no canvas');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('the world can be zoomed, panned and fitted again', async ({ page }) => {
  await loadSave(page, saveText(progressedRun(6)));
  await expect(canvas(page)).toHaveAttribute('data-view', 'fit');
  const before = await zoom(page);
  const c = await centre(page);

  // Wheel zooms in around the cursor; a FIT button appears.
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -400);
  // (The emulated phone scales wheel distances by its pixel ratio, so expect a clear zoom only.)
  await expect.poll(() => zoom(page)).toBeGreaterThan(before * 1.15);
  await expect(canvas(page)).toHaveAttribute('data-view', 'adjusted');
  await expect(page.getByTestId('world-fit')).toBeVisible();

  // Dragging pans the view.
  await page.mouse.down();
  await page.mouse.move(c.x + 60, c.y + 30, { steps: 6 });
  await page.mouse.up();

  // A double tap is two presses now, not a gesture: the view stays where the player put it.
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForTimeout(400);
  await expect(canvas(page)).toHaveAttribute('data-view', 'adjusted');

  // FIT brings back the automatic framing.
  await page.getByTestId('world-fit').click();
  await expect(canvas(page)).toHaveAttribute('data-view', 'fit');
  await expect.poll(() => zoom(page)).toBeCloseTo(before, 3);
  await expect(page.getByTestId('world-fit')).toHaveCount(0);
});

test('a drag over an empty spot pans and presses nothing', async ({ page }) => {
  await loadSave(page, saveText(progressedRun(1)));
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('no canvas');
  const stat = await builtCode(page);
  await page.mouse.move(box.x + 12, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 72, box.y + 42, { steps: 6 });
  await page.mouse.up();
  await expect(canvas(page)).toHaveAttribute('data-view', 'adjusted');
  await page.waitForTimeout(300);
  expect(await builtCode(page)).toBe(stat);
});

test('a drag that starts on the poster pans instead of pressing it', async ({ page }) => {
  await loadSave(page, saveText(progressedRun(1)));
  await expect(canvas(page)).not.toHaveAttribute('data-hit-poster', '');
  const value = (await canvas(page).getAttribute('data-hit-poster')) ?? '0,0';
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('no canvas');
  const [x = 0, y = 0] = value.split(',').map(Number);
  const stat = await builtCode(page);
  await page.mouse.move(box.x + x, box.y + y);
  await page.mouse.down();
  await page.mouse.move(box.x + x + 50, box.y + y + 20, { steps: 6 });
  await page.mouse.up();
  await expect(canvas(page)).toHaveAttribute('data-view', 'adjusted');
  await page.waitForTimeout(300);
  expect(await builtCode(page)).toBe(stat);
});
