import { expect, test, type Page } from '@playwright/test';
import { freshGame } from './helpers';

/** Resolve once the mouse centre is well inside the target zone during the moving phase. */
async function waitUntilInside(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const play = document.querySelector('[data-testid="cat-play"]');
      const mouse = document.querySelector('[data-testid="play-mouse"]');
      const target = document.querySelector('[data-testid="play-target"]');
      if (!play || !mouse || !target || play.getAttribute('data-phase') !== 'moving') return false;
      const m = mouse.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const centre = m.left + m.width / 2;
      const margin = t.width * 0.3;
      return centre > t.left + margin && centre < t.right - margin;
    },
    undefined,
    { polling: 'raf', timeout: 10_000 },
  );
}

async function moodValue(page: Page): Promise<number> {
  return Number(await page.locator('.meter', { hasText: 'Mood' }).locator('.value').textContent());
}

test('PLAY stays inside Cat; pointer catch scores once even with the following click', async ({
  page,
}) => {
  await freshGame(page);
  await page.getByTestId('cat-button').click();
  const before = await moodValue(page);
  await page.getByRole('button', { name: 'PLAY' }).click();
  const play = page.getByTestId('cat-play');
  await expect(play).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CAT' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');

  await waitUntilInside(page);
  await page.getByTestId('catch-button').click();
  await expect(play).toHaveAttribute('data-phase', 'result');
  await expect(play).toContainText('Pounce!');
  await page.getByTestId('catch-button').click();
  await page.getByTestId('catch-button').dispatchEvent('click');

  await page.getByRole('button', { name: '← BACK TO CODE' }).click();
  await page.getByTestId('cat-button').click();
  await expect(page.getByTestId('cat-play')).toHaveCount(0);
  const after = await moodValue(page);
  expect(after - before).toBeGreaterThanOrEqual(7);
  expect(after - before).toBeLessThanOrEqual(12);
});

test('Space catches; auto-repeat is ignored; three attempts end the session', async ({ page }) => {
  await freshGame(page);
  await page.getByTestId('cat-button').click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  const play = page.getByTestId('cat-play');
  await page.getByTestId('catch-button').focus();

  await waitUntilInside(page);
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await expect(play).toHaveAttribute('data-phase', 'result');
  await expect(play).toContainText('Pounce!');

  await expect(play).toHaveAttribute('data-attempt', '2', { timeout: 6000 });
  await waitUntilInside(page);
  await page.keyboard.press('Enter');
  await expect(play).toContainText('Pounce!');
  await expect(play).toHaveAttribute('data-attempt', '3', { timeout: 6000 });
  await expect(page.getByTestId('cat-play')).toHaveCount(0, { timeout: 7000 });
  await expect(page.locator('.care-message')).toContainText('pleased');
});

for (const width of [320, 390]) {
  test(`track fits a ${width} px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await freshGame(page);
    await page.getByTestId('cat-button').click();
    await page.getByRole('button', { name: 'PLAY' }).click();
    const lane = await page.getByTestId('play-lane').boundingBox();
    const button = await page.getByTestId('catch-button').boundingBox();
    if (!lane || !button) throw new Error('missing play geometry');
    expect(lane.x).toBeGreaterThanOrEqual(0);
    expect(lane.x + lane.width).toBeLessThanOrEqual(width);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.y + button.height).toBeLessThanOrEqual(700);
  });
}

test('after a catch, CATCH again skips the pause and starts the next mouse at once', async ({
  page,
}) => {
  await freshGame(page);
  await page.getByTestId('cat-button').click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  const play = page.getByTestId('cat-play');
  await waitUntilInside(page);
  const catchButton = page.getByTestId('catch-button');
  await catchButton.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
  await expect(play).toHaveAttribute('data-phase', 'result');
  await expect(play).toContainText('again for the next mouse');
  await page.waitForTimeout(250);
  await catchButton.dispatchEvent('pointerdown', { pointerType: 'touch', button: 0 });
  await expect(play).toHaveAttribute('data-attempt', '2', { timeout: 300 });
});
