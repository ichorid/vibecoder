import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function reviseDemo(page: Page) {
  await page.goto('/music-lab/');
  await page.locator('[data-key="discovery-demo-b@1"]').click();
  const review = page.getByTestId('review-panel');
  await review.getByLabel('Feedback (plain text)').fill('Busier drums, keep the motif.');
  await review.getByRole('button', { name: 'REVISE' }).click();
  await expect(review.getByTestId('review-status')).toContainText('revise');
}

test('COPY FEEDBACK PROMPT and the .md download give the same self-contained text', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await reviseDemo(page);
  const panel = page.getByLabel('Feedback prompt');
  const download = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download .md' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('feedback-discovery.md');
  const saved = readFileSync(await file.path(), 'utf8');

  await panel.getByRole('button', { name: 'COPY FEEDBACK PROMPT' }).click();
  await expect(page.getByTestId('prompt-note')).toContainText('copied');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(saved);
  expect(saved).toMatch(/# Composer task: Discovery/);
  expect(saved).toMatch(/discovery-demo-b@1.*revise/);
  expect(saved).toContain('> Busier drums, keep the motif.');
  expect(saved).toContain('npm run music:validate -- --era discovery');
});

test('a refused clipboard falls back to the Markdown download', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
    });
  });
  await reviseDemo(page);
  const download = page.waitForEvent('download');
  await page
    .getByLabel('Feedback prompt')
    .getByRole('button', { name: 'COPY FEEDBACK PROMPT' })
    .click();
  expect((await download).suggestedFilename()).toBe('feedback-discovery.md');
  await expect(page.getByTestId('prompt-note')).toContainText('downloaded as Markdown');
});
