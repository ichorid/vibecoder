import { expect, type Page } from '@playwright/test';

/** Open the game with an empty save slot. */
export async function freshGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
}

/** Press the primary action `count` times through real pointer clicks. */
export async function pressPrimary(page: Page, count: number): Promise<void> {
  const button = page.getByTestId('primary-action');
  for (let i = 0; i < count; i += 1) await button.click();
}

export async function headerStat(page: Page): Promise<string> {
  return (await page.getByTestId('stats').locator('dd').first().textContent()) ?? '';
}

/** Install a save envelope before any app script runs (only on the first navigation). */
export async function loadSave(page: Page, text: string): Promise<void> {
  await page.addInitScript((save) => {
    if (sessionStorage.getItem('vibe-fixture-loaded')) return;
    sessionStorage.setItem('vibe-fixture-loaded', '1');
    localStorage.setItem('vibe-coder.save', save);
  }, text);
  await page.goto('/');
  await expect(page.getByTestId('primary-action')).toBeVisible();
}

/** Phones show the cards in a popup: open it (a no-op where the cards are inline). */
export async function openUpgrades(page: Page): Promise<void> {
  const toggle = page.getByTestId('offers-toggle');
  await expect(toggle.or(page.locator('ul.offers')).first()).toBeVisible();
  if ((await toggle.isVisible()) && !(await page.getByTestId('offers-sheet').isVisible())) {
    await toggle.click();
  }
  await expect(page.locator('ul.offers')).toBeVisible();
}

/** Close the cards popup again (a no-op where the cards are inline). */
export async function closeUpgrades(page: Page): Promise<void> {
  const sheet = page.getByTestId('offers-sheet');
  if (await sheet.isVisible()) await sheet.getByRole('button', { name: '← BACK TO CODE' }).click();
}
