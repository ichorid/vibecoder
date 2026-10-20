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

/** An item of the build deck: its build row while it builds, else its lane chip. */
export function deckItem(page: Page, key: string) {
  return page
    .locator(`[data-testid="build-row"][data-key="${key}"], [data-lane-key="${key}"]`)
    .first();
}

/**
 * Code built into the original project so far, as the deck shows it ("The project · 7/2K"):
 * what the presses add while nothing else is being built.
 */
export async function builtCode(page: Page): Promise<string> {
  const text = (await deckItem(page, 'release').textContent()) ?? '';
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

/** The deck is always on screen; this closes its expanded cards if they are open. */
export async function closeDeck(page: Page): Promise<void> {
  const open = page.getByTestId('deck-expanded');
  if (await open.isVisible()) await page.getByTestId('deck-close').click();
}

/** A lane chip whose text matches `name`. */
export function laneItem(page: Page, name: RegExp) {
  return page.getByTestId('lane-item').filter({ hasText: name }).first();
}

/**
 * Build a card: pick it in the lane, then write by hand until its discovery is announced (or
 * `presses` run out). Code is never banked: the build fills as you press.
 */
export async function buildCard(page: Page, name: RegExp, presses = 400): Promise<void> {
  await closeDeck(page);
  await laneItem(page, name).click();
  await expect(page.getByTestId('build-row').filter({ hasText: name }).first()).toBeVisible();
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

/** Press until a card with this name is in the lane (cards appear before they are built). */
export async function pressUntilOffered(page: Page, name: RegExp, limit = 400): Promise<void> {
  const button = page.getByTestId('primary-action');
  const card = page.getByTestId('lane-item').filter({ hasText: name });
  for (let i = 0; i < limit; i += 1) {
    if ((await card.count()) > 0) return;
    await closeDeck(page);
    await button.click();
  }
  throw new Error(`${name} never offered`);
}

/** A ready release or demo: tap it in the deck, then SHIP IT / RUN in its popup. */
export async function goReady(page: Page, key: 'release' | 'demo'): Promise<void> {
  const popup = page.getByTestId('ready-popup');
  if (!(await popup.isVisible())) await deckItem(page, key).click();
  await expect(popup).toBeVisible();
  await popup.getByTestId('ready-go').click();
}

/** Take a decision from the lane: open it, DECIDE, and confirm when it asks. */
export async function decide(page: Page, id: string): Promise<void> {
  await closeDeck(page);
  await page.locator(`[data-lane-key="choice:${id}"]`).click();
  const popup = page.getByTestId('choice-popup');
  await popup.getByTestId('choice-decide').click();
  const yes = popup.getByRole('button', { name: 'YES' });
  if ((await yes.count()) > 0) await yes.click();
}

/** Tap an empty spot of the world (its top-left corner holds nothing tappable): a press. */
export async function tapWorld(page: Page): Promise<void> {
  const box = await page.getByTestId('world-canvas').boundingBox();
  if (!box) throw new Error('no world canvas');
  await page.mouse.click(box.x + 12, box.y + 12);
}
