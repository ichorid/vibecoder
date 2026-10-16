import { expect, test } from '@playwright/test';
import { closeUpgrades, freshGame, loadSave, openUpgrades } from './helpers';
import { progressedRun, saveText } from './fixtures';

test('from the empty room to a working terminal agent with real presses', async ({ page }) => {
  test.setTimeout(240_000);
  await freshGame(page);
  const primary = page.getByTestId('primary-action');
  for (const name of [/Autocomplete/, /Generated snippets/, /AI-native IDE/, /Terminal agent/]) {
    const card = page.getByRole('button', { name });
    // The cards popup says when something can be bought; then open it and buy.
    const toggle = page.getByTestId('offers-toggle');
    const affordable = async () =>
      (await toggle.count()) > 0 && Number(await toggle.getAttribute('data-affordable')) > 0;
    while (!(await affordable())) {
      await expect(primary).toHaveAttribute('data-ready', 'true');
      await primary.click();
    }
    await openUpgrades(page);
    await card.click();
    await page.getByRole('button', { name: 'CONTINUE' }).click();
    await closeUpgrades(page);
  }
  await expect(primary).toHaveText('PROMPT');
  await expect(page.getByTestId('stats')).toContainText('Tokens');
  await expect
    .poll(async () => (await page.getByTestId('world-canvas').getAttribute('data-built')) ?? '')
    .toContain('world-terminal-agent');
  // PROMPT queues tasks; the agent spends tokens.
  const tokens = async () =>
    Number((await page.getByTestId('stats').locator('dd').nth(1).textContent()) ?? '0');
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
  await expect(page.getByTestId('stats')).toContainText('Debt');
  await openUpgrades(page);
  const reviewer = page.getByRole('button', { name: /Reviewer agent/ });
  await expect(reviewer).toBeEnabled();
  await reviewer.click();
  await expect(page.getByTestId('announcement')).toContainText('Reviewer Agent');
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  // The reviewer opens a new decision (keep writing by hand) on the same card surface.
  await openUpgrades(page);
  await expect(page.locator('[data-choice="keep-manual"]')).toBeVisible();
  await expect(page.locator('.offers li')).toHaveCount(3);
});
