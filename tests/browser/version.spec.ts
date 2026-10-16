import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { freshGame } from './helpers';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('the page title and the header carry the game version', async ({ page }) => {
  await freshGame(page);
  await expect(page).toHaveTitle(`VIBE CODER v${version}`);
  await expect(page.getByTestId('app-version')).toHaveText(`v${version}`);
});
