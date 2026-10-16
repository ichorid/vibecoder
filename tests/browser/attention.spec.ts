import { expect, test } from '@playwright/test';
import { loadSave } from './helpers';
import { lonelyRun, saveText } from './fixtures';

test('a very lonely cat blocks the primary action; tapping it opens Cat; header stays usable', async ({
  page,
}) => {
  const run = lonelyRun('large');
  await loadSave(page, saveText(run));
  const overlay = page.getByTestId('cat-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('data-level', 'large');

  const primary = await page.getByTestId('primary-action').boundingBox();
  if (!primary) throw new Error('no primary');
  const hit = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid'),
    { x: primary.x + primary.width / 2, y: primary.y + primary.height / 2 },
  );
  expect(hit).toBe('cat-overlay');

  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.getByRole('heading', { name: 'HISTORY' })).toBeVisible();
  await expect(page.getByTestId('cat-overlay')).toBeHidden();
  await page.getByRole('button', { name: '← GAME' }).click();

  await page.getByTestId('cat-overlay').click();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
  await expect(page.getByTestId('cat-overlay')).toBeHidden();
});

test('a lonely cat (mood 20–39) only partly obstructs and never blocks the header', async ({
  page,
}) => {
  const run = lonelyRun('small', 32);
  await loadSave(page, saveText(run));
  const overlay = page.getByTestId('cat-overlay');
  await expect(overlay).toHaveAttribute('data-level', 'small');
  const box = await overlay.boundingBox();
  const primary = await page.getByTestId('primary-action').boundingBox();
  if (!box || !primary) throw new Error('missing geometry');
  expect(box.width * box.height).toBeLessThan(primary.width * primary.height);
  await expect(page.getByTestId('cat-button')).toBeEnabled();
  await page.getByTestId('cat-button').click();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
});
