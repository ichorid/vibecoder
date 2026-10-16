import { expect, test, type Page } from '@playwright/test';
import { freshGame, headerStat } from './helpers';

/** Tap a world object at the screen position the renderer publishes for it. */
async function tapWorld(page: Page, target: 'Poster' | 'Bowl' | 'Cat') {
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).not.toHaveAttribute(`data-hit-${target.toLowerCase()}`, '');
  const value = await canvas.getAttribute(`data-hit-${target.toLowerCase()}`);
  const box = await canvas.boundingBox();
  if (!value || !box) throw new Error(`no ${target} target`);
  const [x = 0, y = 0] = value.split(',').map(Number);
  await page.mouse.click(box.x + x, box.y + y);
}

test('the poster, the bowl and the cat in the room are tappable', async ({ page }) => {
  await freshGame(page);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-ticker', 'running');

  await tapWorld(page, 'Poster');
  await expect.poll(() => headerStat(page)).toBe('1');
  await expect(page.getByTestId('floating-gain').filter({ hasText: '+1' }).first()).toBeVisible();

  await tapWorld(page, 'Bowl');
  await expect(
    page.getByTestId('floating-gain').filter({ hasText: /fed|too much|spherical/ }),
  ).toHaveCount(1);

  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-cat-lod', 'sprite');
  // The cat walks and jumps between spots, so a busy machine may click where it just was:
  // tap again at its new position, as a player would.
  const reactions = page.getByTestId('floating-gain').filter({ hasText: /purr|meow/ });
  await expect(async () => {
    await tapWorld(page, 'Cat');
    await expect(reactions).not.toHaveCount(0, { timeout: 500 });
  }).toPass({ timeout: 8000 });
});

test('the cat button shows the in-game cat sprite', async ({ page }) => {
  await freshGame(page);
  await expect(page.getByTestId('cat-icon').locator('[data-sprite="cat-idle"]')).toBeVisible();
});
