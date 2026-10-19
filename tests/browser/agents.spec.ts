import { expect, test } from '@playwright/test';
import { buildCard, freshGame, loadSave, openUpgrades, pressUntilOffered } from './helpers';
import { nearlyBuilt, progressedRun, saveText } from './fixtures';

test('from the empty room to a working terminal agent with real presses', async ({ page }) => {
  // Hundreds of real presses; a slow shared CI runner needs minutes.
  test.setTimeout(480_000);
  await freshGame(page);
  const primary = page.getByTestId('primary-action');
  for (const name of [/Autocomplete/, /Generated snippets/, /AI-native IDE/, /Terminal agent/]) {
    // A card appears, the player picks it, and every press fills it until it is built.
    await pressUntilOffered(page, name);
    await buildCard(page, name);
    await page.getByRole('button', { name: 'CONTINUE' }).click();
  }
  await expect(primary).toHaveText('PROMPT');
  await expect(page.getByTestId('stats')).toContainText('Tokens');
  await expect
    .poll(async () => (await page.getByTestId('world-canvas').getAttribute('data-built')) ?? '')
    .toContain('world-terminal-agent');
  // PROMPT queues tasks; the agent spends tokens.
  const tokens = async () =>
    Number(
      (await page
        .getByTestId('stats')
        .locator('.stat', { hasText: 'Tokens' })
        .locator('dd')
        .textContent()) ?? '0',
    );
  const before = await tokens();
  await primary.click();
  await primary.click();
  await page.waitForTimeout(2500);
  expect(await tokens()).not.toBe(before);
});

test('the reviewer, almost built, completes on its own and opens a decision', async ({ page }) => {
  // One line short: the agents' next step finishes it (no press needed).
  const run = nearlyBuilt(progressedRun(8), 'reviewer');
  await loadSave(page, saveText(run));
  await expect(page.getByTestId('stats')).toContainText('Debt');
  await expect(page.getByTestId('announcement')).toContainText('Reviewer Agent');
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  // The reviewer opens a new decision (keep writing by hand) on the same card surface.
  await openUpgrades(page);
  await expect(page.locator('[data-choice="keep-manual"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Parallel agents/ })).toBeVisible();
  // At most three cards; capacity shows only when it would help (journal D29).
  expect(await page.locator('.offers li').count()).toBeLessThanOrEqual(3);
});
