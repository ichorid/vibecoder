import { expect, test, type Page } from '@playwright/test';
import { freshGame, pressPrimary } from './helpers';

const savedActiveMs = async (page: Page) =>
  (
    JSON.parse((await page.evaluate(() => localStorage.getItem('vibe-coder.save'))) ?? '{}') as {
      run: { activeMs: number };
    }
  ).run.activeMs;

/**
 * Synthetic lifecycle events in a real browser: Chromium's CDP `setWebLifecycleState: frozen`
 * does not freeze a visible page (no `freeze` event is delivered), so the hidden/frozen states
 * are dispatched here; real app switches and screen locks are checked on devices (S09/P11).
 */
async function hideAndFreeze(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event(h ? 'freeze' : 'resume'));
    window.dispatchEvent(new Event(h ? 'pagehide' : 'pageshow'));
  }, hidden);
}

test('hidden + frozen + pagehide: the time away is not counted and nothing catches up', async ({
  page,
}) => {
  await freshGame(page);
  await pressPrimary(page, 2);
  await hideAndFreeze(page, true);
  const atHide = await savedActiveMs(page);
  await page.waitForTimeout(3000);
  await hideAndFreeze(page, false);
  await page.waitForTimeout(300);
  // Force a save now (a blur suspends and writes), then measure.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect((await savedActiveMs(page)) - atHide).toBeLessThan(1000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await pressPrimary(page, 1);
});
