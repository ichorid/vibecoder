import { expect, test, type Page } from '@playwright/test';
import { freshGame, builtCode } from './helpers';

/** Tap a world object at the screen position the renderer publishes for it. */
async function tapWorld(
  page: Page,
  target: 'Poster' | 'Bowl' | 'Cat' | 'Monitor' | 'Shelf' | 'Window' | 'Plant',
) {
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).not.toHaveAttribute(`data-hit-${target.toLowerCase()}`, '');
  const value = await canvas.getAttribute(`data-hit-${target.toLowerCase()}`);
  const box = await canvas.boundingBox();
  if (!value || !box) throw new Error(`no ${target} target`);
  const [x = 0, y = 0] = value.split(',').map(Number);
  await page.mouse.click(box.x + x, box.y + y);
}

test('the room is tappable: monitor works, poster/shelf/window joke, bowl feeds, plant drinks, cat purrs', async ({
  page,
}) => {
  await freshGame(page);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-ticker', 'running');

  await tapWorld(page, 'Monitor');
  await expect.poll(() => builtCode(page)).toBe('1');
  await expect(page.getByTestId('floating-gain').filter({ hasText: '+1' }).first()).toBeVisible();

  await tapWorld(page, 'Poster');
  await expect(page.getByTestId('floating-gain').filter({ hasText: 'motivation' })).toHaveCount(1);
  await tapWorld(page, 'Shelf');
  await expect(
    page.getByTestId('floating-gain').filter({ hasText: 'no time for that' }),
  ).toHaveCount(1);
  await tapWorld(page, 'Window');
  await expect(
    page.getByTestId('floating-gain').filter({ hasText: 'maybe other time' }),
  ).toHaveCount(1);
  expect(await builtCode(page)).toBe('1');

  await tapWorld(page, 'Plant');
  await expect(page.getByTestId('floating-gain').filter({ hasText: 'glug' })).toHaveCount(1);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-plant', 'soggy');

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

test('an empty spot of the world presses the primary action, however fast', async ({ page }) => {
  await freshGame(page);
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-ticker', 'running');
  const box = await page.getByTestId('world-canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  // The top-left corner holds nothing tappable in the opening room.
  await page.mouse.click(box.x + 12, box.y + 12);
  await expect.poll(() => builtCode(page)).toBe('1');
  await expect(page.getByTestId('floating-gain').filter({ hasText: '+1' }).first()).toBeVisible();
  // Two quick taps are two presses (no double-tap gesture swallows them).
  await page.mouse.dblclick(box.x + 12, box.y + 12);
  await expect.poll(() => builtCode(page)).toBe('3');
});

test('the cat button shows the in-game cat sprite', async ({ page }) => {
  await freshGame(page);
  await expect(page.getByTestId('cat-icon').locator('[data-sprite="cat-idle"]')).toBeVisible();
});
