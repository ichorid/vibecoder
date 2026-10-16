import { expect, test } from '@playwright/test';
import { freshGame } from './helpers';

test('theme defaults to AUTO and follows the system; LIGHT and DARK override it', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await freshGame(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  // The system switches to dark while the game runs: AUTO follows at once.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-theme', 'dark');

  await page.getByTestId('settings-button').click();
  await expect(page.getByRole('radio', { name: 'AUTO' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'LIGHT' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  // The choice is remembered across a reload, and AUTO goes back to the system.
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByTestId('settings-button').click();
  await page.getByRole('radio', { name: 'AUTO' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});
