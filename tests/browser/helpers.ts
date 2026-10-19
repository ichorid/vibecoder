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
  for (let i = 0; i < count; i += 1) {
    await button.click();
  }
}

/**
 * Code built into the original project so far, as its strip shows it ("The project · 7/2K"):
 * what the presses add while nothing else is being built.
 */
export async function builtCode(page: Page): Promise<string> {
  const strip = page.getByTestId('ship-strip');
  if ((await strip.count()) > 0) {
    return /([\d.]+[KMB]?)\//.exec((await strip.textContent()) ?? '')?.[1] ?? '';
  }
  // Phones keep the project in the cards popup; the folded button names the build it fills.
  const label = (await page.getByTestId('offers-toggle').getAttribute('aria-label')) ?? '';
  const building = /building ([\d.]+[KMB]?)\//.exec(label)?.[1];
  if (building !== undefined) return building;
  await openUpgrades(page);
  const text = (await strip.textContent()) ?? '';
  await closeUpgrades(page);
  return /([\d.]+[KMB]?)\//.exec(text)?.[1] ?? '';
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

/**
 * Phones show the cards, the project, the demo and the gigs in a popup: open it (a no-op where
 * they are inline).
 */
export async function openUpgrades(page: Page): Promise<void> {
  const toggle = page.getByTestId('offers-toggle');
  const sheet = page.getByTestId('offers-sheet');
  await expect(toggle.or(page.locator('ul.offers, .strips')).first()).toBeVisible();
  if ((await toggle.isVisible()) && !(await sheet.isVisible())) await toggle.click();
  await expect(sheet.or(page.locator('ul.offers, .strips')).first()).toBeVisible();
}

/** Close the cards popup again (a no-op where the cards are inline). */
export async function closeUpgrades(page: Page): Promise<void> {
  const sheet = page.getByTestId('offers-sheet');
  if (await sheet.isVisible()) await sheet.getByRole('button', { name: '← BACK TO CODE' }).click();
}

/**
 * Build a card: pick it (in the popup on phones), then write by hand until its discovery is
 * announced (or `presses` run out). Code is never banked: the build fills as you press.
 */
export async function buildCard(page: Page, name: RegExp, presses = 400): Promise<void> {
  await openUpgrades(page);
  await page.getByRole('button', { name }).click();
  await closeUpgrades(page);
  const button = page.getByTestId('primary-action');
  const announcement = page.getByTestId('announcement');
  for (let i = 0; i < presses; i += 1) {
    if ((await announcement.count()) > 0) return;
    // The discovery can land between the check and the press: its panel then takes the tap.
    const pressed = await button
      .click({ timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!pressed && (await announcement.count()) > 0) return;
    if (!pressed) throw new Error('the primary action could not be pressed');
  }
}

/** Press until a card with this name is on offer (cards appear before they are built). */
export async function pressUntilOffered(page: Page, name: RegExp, limit = 400): Promise<void> {
  const button = page.getByTestId('primary-action');
  const toggle = page.getByTestId('offers-toggle');
  const card = page.getByRole('button', { name });
  for (let i = 0; i < limit; i += 1) {
    if ((await card.count()) > 0) return;
    if ((await toggle.count()) > 0) {
      await toggle.click();
      const found = (await card.count()) > 0;
      await closeUpgrades(page);
      if (found) return;
    }
    await button.click();
  }
  throw new Error(`${name} never offered`);
}
