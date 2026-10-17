import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
];

async function freshGame(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('primary-action')).toBeVisible();
}

for (const viewport of viewports) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test('primary action is reachable without horizontal scrolling', async ({ page }) => {
      await freshGame(page);
      const primary = page.getByTestId('primary-action');
      const box = await primary.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('counters sit right below the header, above the world; the cat stays in the header', async ({
      page,
    }) => {
      await freshGame(page);
      await page.getByTestId('primary-action').click();
      const stats = await page.getByTestId('stats').boundingBox();
      const world = await page.getByTestId('world').boundingBox();
      const header = await page.locator('header').boundingBox();
      if (!stats || !world || !header) throw new Error('missing layout');
      expect(stats.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
      expect(stats.y - (header.y + header.height)).toBeLessThan(16);
      expect(stats.y + stats.height).toBeLessThanOrEqual(world.y + 1);
      await expect(page.locator('header').getByTestId('cat-button')).toBeVisible();
    });

    test('cat button and its two tiny bars have the specified geometry', async ({ page }) => {
      await freshGame(page);
      const button = await page.getByTestId('cat-button').boundingBox();
      const icon = await page.getByTestId('cat-icon').boundingBox();
      const health = await page.getByTestId('health-bar').boundingBox();
      const mood = await page.getByTestId('mood-bar').boundingBox();
      if (!button || !icon || !health || !mood) throw new Error('missing header geometry');
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      for (const bar of [health, mood]) {
        expect(bar.width).toBeLessThanOrEqual(icon.width + 0.5);
        expect(bar.height).toBeGreaterThanOrEqual(3);
        expect(bar.height).toBeLessThanOrEqual(4);
        expect(bar.x).toBeGreaterThanOrEqual(icon.x - 0.5);
      }
      const firstGap = health.y - (icon.y + icon.height);
      const secondGap = mood.y - (health.y + health.height);
      expect(health.y).toBeGreaterThan(icon.y + icon.height - 0.5);
      expect(firstGap).toBeGreaterThanOrEqual(2 - 0.5);
      expect(firstGap).toBeLessThanOrEqual(3 + 0.5);
      expect(secondGap).toBeGreaterThanOrEqual(2 - 0.5);
      expect(secondGap).toBeLessThanOrEqual(3 + 0.5);
    });
  });
}

test('header shows health and mood without percentages, fullness, or a large panel', async ({
  page,
}) => {
  await freshGame(page);
  const header = page.locator('header');
  await expect(header).not.toContainText('%');
  await expect(header).not.toContainText(/fullness|health|mood/i);
  const label = await page.getByTestId('cat-button').getAttribute('aria-label');
  expect(label).toMatch(/health/i);
  expect(label).toMatch(/mood/i);
  expect(label).not.toMatch(/\d/);
});

test('keyboard reaches navigation and actions; theme does not change progress', async ({
  page,
}) => {
  await freshGame(page);
  const reached = new Set<string>();
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    reached.add(
      await page.evaluate(
        () =>
          document.activeElement?.getAttribute('aria-label') ??
          document.activeElement?.textContent?.trim() ??
          '',
      ),
    );
  }
  expect([...reached].some((t) => t.startsWith('Cat.'))).toBe(true);
  expect(reached.has('HISTORY')).toBe(true);
  expect(reached.has('Settings')).toBe(true);
  expect(reached.has('WRITE CODE')).toBe(true);

  await page.getByTestId('primary-action').press('Enter');
  await page.getByTestId('settings-button').click();
  await page.getByRole('radio', { name: 'DARK' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'WRITE CODE' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Upgrades' })).toHaveCount(0);
});
