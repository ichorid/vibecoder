import { expect, test, type Page } from '@playwright/test';
import { freshGame, loadSave, openUpgrades, pressPrimary } from './helpers';
import { neglectedRun, progressedRun, saveText } from './fixtures';

const canvas = (page: Page) => page.getByTestId('world-canvas');

async function built(page: Page): Promise<string[]> {
  return ((await canvas(page).getAttribute('data-built')) ?? '').split(',').filter(Boolean);
}

test('a discovery reveals its subsystem and zooms out while Game shows the announcement', async ({
  page,
}) => {
  await freshGame(page);
  await expect.poll(() => built(page)).toEqual(['room']);
  const zoomBefore = Number(await canvas(page).getAttribute('data-zoom'));
  await pressPrimary(page, 10);
  await openUpgrades(page);
  await page.getByRole('button', { name: /Autocomplete/ }).click();
  await expect(page.getByTestId('announcement')).toBeVisible();
  await expect.poll(() => built(page)).toContain('world-autocomplete');
  await expect(canvas(page)).toHaveAttribute('data-transition', 'idle', { timeout: 5000 });
  expect(Number(await canvas(page).getAttribute('data-zoom'))).toBeLessThan(zoomBefore);
  const image = page.getByTestId('announcement').locator('img');
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(128);
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  expect(await built(page)).toContain('world-autocomplete');
});

test('a reveal saved as pending before reload plays when Game shows, then stays built', async ({
  page,
}) => {
  await loadSave(page, saveText(progressedRun(2, true)));
  // Reload with a pending reveal: Game is visible, so it plays now.
  await expect.poll(() => built(page)).toContain('world-generated-snippets');
  await page.getByTestId('cat-button').click();
  await page.reload();
  await expect
    .poll(() => built(page))
    .toEqual(['room', 'world-autocomplete', 'world-generated-snippets']);
});

test('theme switch rebuilds the same scene with the room and cat present', async ({ page }) => {
  await loadSave(page, saveText(progressedRun(3)));
  await expect.poll(() => built(page)).toHaveLength(4);
  await expect(canvas(page)).not.toHaveAttribute('data-cat-lod', 'hidden');
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: 'Theme' }).click();
  await expect(canvas(page)).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => built(page)).toHaveLength(4);
  await expect(canvas(page)).not.toHaveAttribute('data-cat-lod', 'hidden');
});

test('a dead cat is absent from the world; memorial photos are the exported PNGs', async ({
  page,
}) => {
  await loadSave(page, saveText(neglectedRun()));
  await expect(canvas(page)).toHaveAttribute('data-cat-lod', 'hidden');
  await page.getByTestId('cat-button').click();
  const photos = page.getByTestId('memorial').locator('img');
  await expect(photos).toHaveCount(2);
  for (const photo of await photos.all()) {
    await expect.poll(() => photo.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(64);
  }
});

test('Cat view and the world share the atlas cat animation', async ({ page }) => {
  await freshGame(page);
  await page.getByTestId('cat-button').click();
  await expect(page.getByTestId('cat-portrait').locator('[data-sprite]')).toHaveAttribute(
    'data-sprite',
    'cat-idle',
  );
});
