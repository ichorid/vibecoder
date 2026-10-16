import { expect, test, type Page } from '@playwright/test';
import { freshGame, loadSave } from './helpers';
import { neglectedRun, saveText } from './fixtures';

async function barWidth(page: Page, id: 'health-bar' | 'mood-bar'): Promise<number> {
  return page
    .getByTestId(id)
    .locator('.fill')
    .evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);
}

test('FEED and PET act on the real cat; PET cooldown is cosmetic only', async ({ page }) => {
  await freshGame(page);
  const moodBefore = await barWidth(page, 'mood-bar');
  await page.getByTestId('cat-button').click();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
  const fullness = page.locator('.meter', { hasText: 'Fullness' }).locator('.value');
  const mood = page.locator('.meter', { hasText: 'Mood' }).locator('.value');
  await expect(fullness).toHaveText('75');

  await page.getByRole('button', { name: 'FEED' }).click();
  await expect(fullness).not.toHaveText('75');
  const afterFeed = Number(await fullness.textContent());
  expect(afterFeed).toBeGreaterThanOrEqual(93);
  await expect(page.getByText('Not hungry, but okay...')).toBeVisible();

  await page.getByRole('button', { name: 'PET' }).click();
  await expect(mood).toHaveText('88');
  await page.getByRole('button', { name: 'PET' }).click();
  await page.getByRole('button', { name: 'PET' }).click();
  await expect(mood).toHaveText('88');
  await expect(page.getByRole('button', { name: 'PLAY' })).toBeEnabled();

  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect.poll(() => barWidth(page, 'mood-bar')).toBeGreaterThan(moodBefore);
  await expect(page.locator('header')).not.toContainText(/fullness/i);
});

test('a dead cat stays dead: gray bars, memorial with two photos, no care', async ({ page }) => {
  const dead = neglectedRun();
  expect(dead.cat.alive).toBe(false);
  await loadSave(page, saveText(dead));
  await expect(page.getByTestId('cat-button')).toHaveAttribute('aria-label', 'Cat. Gone.');
  expect(await barWidth(page, 'health-bar')).toBe(0);
  expect(await barWidth(page, 'mood-bar')).toBe(0);
  await expect(page.getByRole('list', { name: 'Recent events' })).toContainText('The cat is gone.');

  await page.getByTestId('cat-button').click();
  const memorial = page.getByTestId('memorial');
  await expect(memorial).toBeVisible();
  await expect(memorial.locator('figure')).toHaveCount(2);
  for (const name of ['FEED', 'PLAY', 'PET']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.locator('.meter')).toHaveCount(0);

  await page.reload();
  await page.getByTestId('cat-button').click();
  await expect(page.getByTestId('memorial')).toBeVisible();
  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await page.getByRole('button', { name: 'HISTORY' }).click();
  await expect(page.locator('section.history').getByText('The cat is gone.')).toBeVisible();
});

test('tapping the cat in the Cat view meows and counts as PET', async ({ page }) => {
  await freshGame(page);
  await page.getByTestId('cat-button').click();
  const mood = page.locator('.meter', { hasText: 'Mood' }).locator('.value');
  const before = Number(await mood.textContent());
  await page.getByRole('button', { name: 'Tap the cat' }).click();
  await expect(page.getByTestId('floating-gain').filter({ hasText: 'meow' })).toHaveCount(1);
  await expect.poll(async () => Number(await mood.textContent())).toBeGreaterThan(before);
});
