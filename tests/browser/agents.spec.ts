import { expect, test } from '@playwright/test';
import { freshGame, loadSave } from './helpers';
import { progressedRun, saveText } from './fixtures';

test('from the empty room to a working terminal agent with real presses', async ({ page }) => {
  test.setTimeout(120_000);
  await freshGame(page);
  const primary = page.getByTestId('primary-action');
  for (const name of [/Autocomplete/, /Generated snippets/, /AI-native IDE/, /Terminal agent/]) {
    const card = page.getByRole('button', { name });
    const ready = async () => (await card.count()) > 0 && (await card.isEnabled());
    while (!(await ready())) await primary.click();
    await card.click();
    await page.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await expect(primary).toHaveText('PROMPT');
  await expect(page.locator('header')).toContainText('Tokens');
  await expect
    .poll(async () => (await page.getByTestId('world-canvas').getAttribute('data-built')) ?? '')
    .toContain('world-terminal-agent');
  // PROMPT queues tasks; the agent spends tokens.
  const tokens = async () => Number((await page.locator('header dd').nth(1).textContent()) ?? '0');
  const before = await tokens();
  await primary.click();
  await primary.click();
  await page.waitForTimeout(2500);
  expect(await tokens()).not.toBe(before);
});

test('the reviewer appears with debt in the header and can be bought', async ({ page }) => {
  const run = progressedRun(8);
  const rich = { ...run, economy: { ...run.economy, output: 50_000 } };
  await loadSave(page, saveText(rich));
  await expect(page.locator('header')).toContainText('Debt');
  const reviewer = page.getByRole('button', { name: /Reviewer agent/ });
  await expect(reviewer).toBeEnabled();
  await reviewer.click();
  await expect(page.getByTestId('announcement')).toContainText('Reviewer Agent');
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  // The reviewer opens a new decision (keep writing by hand) on the same card surface.
  await expect(page.locator('[data-choice="keep-manual"]')).toBeVisible();
  await expect(page.locator('.offers li')).toHaveCount(3);
});
