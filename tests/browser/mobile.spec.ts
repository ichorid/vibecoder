import { expect, test, type Page } from '@playwright/test';
import { loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

const run = (page: Page) =>
  page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('vibe-coder.save') ?? '{}') as {
      run: { id: string; unlockedTechnologyIds: string[] };
    };
    return save.run;
  });

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`${viewport.width}×${viewport.height}: a busy mid-game keeps the primary action, the world and the cards in reach`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await loadSave(page, saveText(progressedRun(9)));
    const primary = await page.getByTestId('primary-action').boundingBox();
    if (!primary) throw new Error('no primary action');
    expect(primary.y + primary.height).toBeLessThanOrEqual(viewport.height);
    expect(primary.height).toBeGreaterThanOrEqual(44);
    // On a phone the cards wait in a popup, so the world keeps a real share of the screen.
    const toggle = await page.getByTestId('offers-toggle').boundingBox();
    if (!toggle) throw new Error('no upgrades button');
    expect(toggle.y + toggle.height).toBeLessThanOrEqual(viewport.height);
    expect(toggle.height).toBeGreaterThanOrEqual(44);
    const world = await page.getByTestId('world').boundingBox();
    expect(world?.height ?? 0).toBeGreaterThanOrEqual(viewport.height * 0.3);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByTestId('offers-toggle').click();
    const card = await page.getByTestId('offers-sheet').locator('.offer').first().boundingBox();
    if (!card) throw new Error('no card');
    expect(card.y + card.height).toBeLessThanOrEqual(viewport.height);
  });
}

test('rotating and resizing never resets the run or rebuilds a second world', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSave(page, saveText(progressedRun(6)));
  const canvas = page.getByTestId('world-canvas');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-sprites')))
    .toBeGreaterThan(5);
  const sprites = await canvas.getAttribute('data-sprites');
  const before = await run(page);
  for (const size of [
    { width: 844, height: 390 },
    { width: 390, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId('world-canvas')).toHaveCount(1);
  expect(await canvas.getAttribute('data-sprites')).toBe(sprites);
  const after = await run(page);
  expect(after.id).toBe(before.id);
  expect(after.unlockedTechnologyIds).toEqual(before.unlockedTechnologyIds);
});

test('History scrolls on a short screen and the header stays usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await loadSave(page, saveText(progressedRun(12)));
  await page
    .getByRole('button', { name: /history/i })
    .first()
    .click();
  const timeline = page.locator('.timeline');
  await expect(timeline.locator('li').first()).toBeVisible();
  const last = timeline.locator('li').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await expect(page.getByTestId('cat-button')).toBeInViewport();
});

test('reduced motion keeps every piece of information (discovery text, cat bars)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadSave(page, saveText(progressedRun(4, true)));
  await expect(page.getByRole('dialog').or(page.locator('.announcement')).first()).toBeVisible();
  await expect(page.locator('.announcement, [role="dialog"]').first()).toContainText(/\w{4,}/);
  await expect(page.getByTestId('health-bar')).toBeVisible();
  await expect(page.getByTestId('mood-bar')).toBeVisible();
});

test('dark theme keeps the health and mood bars distinguishable from their track', async ({
  page,
}) => {
  await loadSave(page, saveText(progressedRun(2)));
  await page.getByTestId('settings-button').click();
  await page.getByRole('button', { name: 'Theme' }).click();
  await page.keyboard.press('Escape');
  const ratios = await page.evaluate(() => {
    const luminance = (rgb: string) => {
      const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
    };
    const style = getComputedStyle(document.documentElement);
    const color = (name: string) => {
      const probe = document.createElement('span');
      probe.style.color = style.getPropertyValue(name);
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };
    const track = luminance(color('--bar-track'));
    return ['--health', '--mood'].map((name) => {
      const fill = luminance(color(name));
      const [hi, lo] = fill > track ? [fill, track] : [track, fill];
      return (hi + 0.05) / (lo + 0.05);
    });
  });
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(3);
});

test('a wide screen keeps the cards inline; a phone opens them in a popup and buys there', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await loadSave(page, saveText(progressedRun(3)));
  await expect(page.locator('ul.offers')).toBeVisible();
  await expect(page.getByTestId('offers-toggle')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('ul.offers')).toHaveCount(0);
  const toggle = page.getByTestId('offers-toggle');
  await expect(toggle).toContainText('UPGRADES');
  await toggle.click();
  const sheet = page.getByTestId('offers-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('stats')).toBeVisible();
  await sheet.getByRole('button', { name: '← BACK TO CODE' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId('primary-action')).toBeVisible();
});
