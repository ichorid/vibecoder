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
  return (await page.locator('header dd').first().textContent()) ?? '';
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
