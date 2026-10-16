import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { freshGame, pressPrimary } from './helpers';

/** Count notes handed to Web Audio (oscillators/noise sources started), without touching the app. */
async function countAudioStarts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __audioStarts: number };
    w.__audioStarts = 0;
    const proto = AudioScheduledSourceNode.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, 'start')?.value as (
      this: AudioScheduledSourceNode,
      when?: number,
    ) => void;
    proto.start = function (this: AudioScheduledSourceNode, when?: number) {
      w.__audioStarts += 1;
      original.call(this, when);
    };
  });
}
const starts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __audioStarts: number }).__audioStarts);

/** Serve a validated approved pack of the four demos instead of the (empty) published one. */
async function useTestPack(page: Page) {
  const fixture = readFileSync('tests/browser/fixtures/approved-test-pack.json', 'utf8');
  await page.route('**/assets/pack.approved-*.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: `export default ${fixture};` }),
  );
}

interface SavedRun {
  run: { id: string; activeMs: number };
}
async function savedRun(page: Page): Promise<SavedRun> {
  const text = await page.evaluate(() => localStorage.getItem('vibe-coder.save'));
  if (!text) throw new Error('no save');
  return JSON.parse(text) as SavedRun;
}

async function openSettings(page: Page) {
  await page.getByTestId('settings-button').click();
  return page.getByRole('dialog', { name: 'Settings' });
}

async function hide(page: Page, hidden: boolean) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('the Sound switch loads audio only on the gesture and reports the empty soundtrack honestly', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await freshGame(page);
  const dialog = await openSettings(page);
  const sound = dialog.getByRole('switch', { name: 'Sound' });
  await expect(sound).toBeEnabled();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  expect(requests.some((p) => /loader-|gameAudio-/.test(p))).toBe(false);

  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByTestId('sound-status')).toContainText('No approved soundtrack');
  expect(requests.some((p) => /loader-/.test(p))).toBe(true);
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('vibecoder.audio.v1'))) ?? '{}'),
  ).toMatchObject({ soundOn: true });

  // The choice survives a reload; the browser needs a new gesture before audio may start.
  await page.reload();
  const again = await openSettings(page);
  await expect(again.getByRole('switch', { name: 'Sound' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(again.getByTestId('sound-status')).toContainText(/No approved soundtrack|next tap/);
});

test('with an approved pack the game really plays, keeps playing across views, and silences when hidden', async ({
  page,
}) => {
  await countAudioStarts(page);
  await useTestPack(page);
  await freshGame(page);
  const dialog = await openSettings(page);
  await dialog.getByRole('switch', { name: 'Sound' }).click();
  await expect(dialog.getByTestId('sound-status')).toContainText('Playing');
  await expect.poll(() => starts(page), { timeout: 5_000 }).toBeGreaterThan(3);
  await page.keyboard.press('Escape');

  // History and Cat views do not pause the music.
  await page.getByTestId('cat-button').click();
  const inCat = await starts(page);
  await expect.poll(() => starts(page), { timeout: 5_000 }).toBeGreaterThan(inCat);
  await page.getByRole('button', { name: '← GAME' }).click();

  // Hidden: no new notes; visible again: music continues.
  await hide(page, true);
  await page.waitForTimeout(300);
  const hiddenAt = await starts(page);
  await page.waitForTimeout(1500);
  expect(await starts(page)).toBe(hiddenAt);
  await hide(page, false);
  await expect.poll(() => starts(page), { timeout: 5_000 }).toBeGreaterThan(hiddenAt);
  // The game clock kept its own time: it still responds normally.
  await pressPrimary(page, 3);
});

test('Settings → Music Lab → back keeps the same run and shares the audio preference', async ({
  page,
}) => {
  await freshGame(page);
  await pressPrimary(page, 5);
  const before = await savedRun(page);
  const dialog = await openSettings(page);
  await dialog.getByRole('button', { name: /Music/ }).click();
  const music = page.getByRole('dialog', { name: 'Music' });
  await music.getByRole('slider', { name: 'Music volume' }).fill('0.6');
  await music.getByRole('link', { name: 'Music Lab' }).click();

  await expect(page.getByRole('heading', { name: 'Music Lab' })).toBeVisible();
  await expect(page.locator('[data-key]')).toHaveCount(4);
  await expect(page.getByRole('slider')).toHaveValue('0.6');
  const saved = await savedRun(page);
  expect(saved.run.id).toBe(before.run.id);
  await page.waitForTimeout(1200);
  // The game does not tick while the Lab is open.
  expect(await savedRun(page)).toEqual(saved);

  await page.getByRole('link', { name: '← Back to the game' }).click();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  const after = await savedRun(page);
  expect(after.run.id).toBe(saved.run.id);
  expect(after.run.activeMs).toBeLessThan(saved.run.activeMs + 1000);
});

test('an audio failure is reported, the menu still closes and the game goes on', async ({
  page,
}) => {
  await page.route('**/assets/loader-*.js', (route) => route.abort());
  await freshGame(page);
  const dialog = await openSettings(page);
  await dialog.getByRole('switch', { name: 'Sound' }).click();
  await expect(dialog.getByTestId('sound-status')).toContainText('continues without sound');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('settings-button')).toBeFocused();
  await pressPrimary(page, 3);
});
