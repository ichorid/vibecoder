import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { freshGame, pressPrimary } from './helpers';

/**
 * S09.1 production walkthrough as one continuous flow (headless Chromium). "Heard" here means
 * notes handed to Web Audio plus the Lab's backend-synchronised now-playing key — not listening.
 */
const demo = JSON.parse(
  readFileSync('music/patterns/singularity/singularity-demo-a.v1.json', 'utf8'),
) as Record<string, unknown>;

async function countNotes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: number };
    w.__notes = 0;
    const proto = AudioScheduledSourceNode.prototype;
    const start = Object.getOwnPropertyDescriptor(proto, 'start')?.value as (
      this: AudioScheduledSourceNode,
      when?: number,
    ) => void;
    proto.start = function (this: AudioScheduledSourceNode, when?: number) {
      w.__notes += 1;
      start.call(this, when);
    };
  });
}
const notes = (page: Page) =>
  page.evaluate(() => (window as unknown as { __notes: number }).__notes);
const nowKey = (page: Page) => page.getByTestId('now-key');
const savedRun = async (page: Page) =>
  (
    JSON.parse((await page.evaluate(() => localStorage.getItem('vibe-coder.save'))) ?? '{}') as {
      run: { id: string; activeMs: number };
    }
  ).run;

test('the full music workflow on the production build', async ({ page, context }) => {
  test.setTimeout(180_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await countNotes(page);

  // 1. Game → Settings → Sound on/off → Music → Music Lab.
  await freshGame(page);
  await pressPrimary(page, 3);
  // Force a save now (a blur suspends and writes), then continue.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const before = await savedRun(page);
  await page.getByTestId('settings-button').click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const sound = settings.getByRole('switch', { name: 'Sound' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await settings.getByRole('button', { name: /Music/ }).click();
  await page
    .getByRole('dialog', { name: 'Music' })
    .getByRole('link', { name: 'Music Lab' })
    .click();
  await expect(page.getByRole('heading', { name: 'Music Lab' })).toBeVisible();
  const inLab = await savedRun(page);
  expect(inLab.id).toBe(before.id);

  // 2. Gesture unlock; all four demos sound.
  for (const key of [
    'discovery-demo-a@1',
    'discovery-demo-b@1',
    'singularity-demo-a@1',
    'singularity-demo-b@1',
  ]) {
    await page.locator(`[data-key="${key}"]`).click();
    if (key === 'discovery-demo-a@1') await page.getByRole('button', { name: 'PLAY' }).click();
    await expect(nowKey(page)).toHaveText(key, { timeout: 20_000 });
  }
  expect(await notes(page)).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'STOP' }).click();

  // 3. Random demo sequence, A→B transition, six-stage Evolution with fallback labels.
  await page.getByRole('tab', { name: 'Random' }).click();
  await page.getByLabel('Include temporary demo material').check();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(nowKey(page)).toHaveText(/^discovery-demo-[ab]@1$/, { timeout: 5_000 });
  await page.getByRole('tab', { name: 'Transition' }).click();
  await page.getByLabel('Pattern A').selectOption('discovery-demo-a@1');
  await page.getByLabel('Pattern B').selectOption('singularity-demo-b@1');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(nowKey(page)).toHaveText('discovery-demo-a@1', { timeout: 5_000 });
  await expect(nowKey(page)).toHaveText('singularity-demo-b@1', { timeout: 20_000 });
  await page.getByRole('tab', { name: 'Evolution' }).click();
  const evolution = page.getByLabel('Evolution preview');
  await expect(evolution).toContainText('96 s');
  await expect(evolution.getByText('demo fallback: Discovery bank')).toHaveCount(2);
  await expect(evolution.getByText('demo fallback: Singularity bank')).toHaveCount(2);
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('now-playing')).toContainText('era: Discovery', { timeout: 5_000 });
  await page.getByRole('button', { name: 'STOP' }).click();
  await page.getByRole('tab', { name: 'Single' }).click();

  // 4. Import a new valid candidate, audition, rate, revise/reject/approve the exact version.
  const candidate = { ...demo, id: 'walkthrough-idea', demo: false, energy: 0.35 };
  await page.getByLabel('Import pattern JSON').setInputFiles({
    name: 'walkthrough-idea.v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(candidate)),
  });
  await expect(page.getByTestId('lab-message')).toContainText('added walkthrough-idea@1');
  await page.locator('[data-key="walkthrough-idea@1"]').click();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(nowKey(page)).toHaveText('walkthrough-idea@1', { timeout: 20_000 });
  await page.getByRole('button', { name: 'STOP' }).click();
  const review = page.getByTestId('review-panel');
  await review.getByRole('button', { name: '3★' }).click();
  await review.getByLabel('Feedback (plain text)').fill('Nice; lower the drums.');
  await review.getByRole('button', { name: 'REVISE' }).click();
  await expect(review.getByTestId('review-status')).toContainText('revise');
  await review.getByRole('button', { name: 'REJECT' }).click();
  await expect(review.getByTestId('review-status')).toContainText('rejected');
  await review.getByRole('button', { name: 'APPROVE' }).click();
  await expect(review.getByTestId('review-status')).toContainText('approved');
  await page.reload();
  await expect(page.locator('[data-key="walkthrough-idea@1"]')).toContainText('approved');

  // 5. Export/import reviews; a new revision is unreviewed; changed music is stale.
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export reviews' }).click();
  const reviewsText = readFileSync(await (await exported).path(), 'utf8');
  await page.getByLabel('Import pattern JSON').setInputFiles({
    name: 'walkthrough-idea.v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...candidate, revision: 2, energy: 0.5 })),
  });
  await expect(page.locator('[data-key="walkthrough-idea@2"]')).toContainText('unreviewed');
  await page.getByLabel('Import reviews').setInputFiles({
    name: 'reviews.json',
    mimeType: 'application/json',
    buffer: Buffer.from(reviewsText),
  });
  await expect(page.getByTestId('lab-message')).toContainText('1 already present');
  await page.getByRole('tab', { name: 'Transition' }).click();
  await page.getByLabel('Pattern A').selectOption('walkthrough-idea@1');
  await page.getByLabel('Pattern B').selectOption('walkthrough-idea@2');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(nowKey(page)).toHaveText('walkthrough-idea@1', { timeout: 20_000 });
  await page.getByRole('button', { name: 'STOP' }).click();
  await page.getByRole('tab', { name: 'Single' }).click();

  // 6. Copy the self-contained prompt; back to the game: the same run, no catch-up.
  await page
    .getByLabel('Feedback prompt')
    .getByRole('button', { name: 'COPY FEEDBACK PROMPT' })
    .click();
  await expect(page.getByTestId('prompt-note')).toContainText('copied');
  const prompt = await page.evaluate(() => navigator.clipboard.readText());
  expect(prompt).toMatch(/# Composer task: Discovery/);
  await page.getByRole('link', { name: '← Back to the game' }).click();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  const after = await savedRun(page);
  expect(after.id).toBe(before.id);
  expect(after.activeMs).toBeLessThan(inLab.activeMs + 1000);
});
