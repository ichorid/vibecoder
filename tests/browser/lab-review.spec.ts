import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const demo = JSON.parse(
  readFileSync('music/patterns/discovery/discovery-demo-a.v1.json', 'utf8'),
) as Record<string, unknown>;
const candidate = { ...demo, revision: 2, energy: 0.6 };

test('production Lab: import a candidate, play it, review it, reload, export', async ({ page }) => {
  await page.goto('/music-lab/');
  await expect(page.getByRole('heading', { name: 'Music Lab' })).toBeVisible();

  await page.getByLabel('Import pattern JSON').setInputFiles({
    name: 'discovery-demo-a.v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(candidate)),
  });
  await expect(page.getByTestId('lab-message')).toContainText('added discovery-demo-a@2');
  const row = page.locator('[data-key="discovery-demo-a@2"]');
  await expect(row).toContainText('local');
  await expect(row).toContainText('unreviewed');

  await row.click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('now-key')).toHaveText('discovery-demo-a@2', { timeout: 5_000 });

  const review = page.getByTestId('review-panel');
  await review.getByRole('button', { name: '4★' }).click();
  await review.getByLabel('Feedback (plain text)').fill('<b>keep</b> the bass');
  await review.getByRole('button', { name: 'APPROVE' }).click();
  await expect(review.getByTestId('review-status')).toContainText('approved');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Music Lab' })).toBeVisible();
  const again = page.locator('[data-key="discovery-demo-a@2"]');
  await expect(again).toContainText('approved');
  await again.click();
  await expect(page.getByTestId('review-panel').getByLabel('Feedback (plain text)')).toHaveValue(
    '<b>keep</b> the bass',
  );
  // Feedback is text, never markup.
  expect(await page.locator('[data-testid="review-panel"] b').count()).toBe(0);

  // The approved local candidate is now the only approved Discovery material.
  await page.getByRole('tab', { name: 'Random' }).click();
  await expect(page.getByTestId('random-candidates')).toContainText('1 approved pattern');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export reviews' }).click();
  const file = await (await download).path();
  const exported = JSON.parse(readFileSync(file, 'utf8')) as {
    records: { patternId: string; revision: number; status: string; rating?: number }[];
  };
  expect(exported.records).toEqual([
    expect.objectContaining({
      patternId: 'discovery-demo-a',
      revision: 2,
      status: 'approved',
      rating: 4,
    }),
  ]);

  // The game save is untouched by the Lab.
  expect(await page.evaluate(() => localStorage.getItem('vibe-coder.save'))).toBeNull();
});

test('an invalid or conflicting candidate never replaces installed music', async ({ page }) => {
  await page.goto('/music-lab/');
  await page.getByLabel('Import pattern JSON').setInputFiles({
    name: 'clash.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...demo, energy: 0.1 })),
  });
  await expect(page.getByTestId('lab-message')).toContainText('conflict discovery-demo-a@1');
  await page.getByLabel('Import pattern JSON').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"id":'),
  });
  await expect(page.getByTestId('lab-message')).toContainText('rejected broken.json');
  await expect(page.locator('[data-key]')).toHaveCount(4);
});
