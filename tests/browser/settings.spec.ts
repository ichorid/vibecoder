import { expect, test } from '@playwright/test';
import { freshGame, headerStat, pressPrimary } from './helpers';

test('settings panel: theme, sound switch, music submenu, Music Lab link, focus return', async ({
  page,
}) => {
  await freshGame(page);
  await pressPrimary(page, 3);
  await expect.poll(() => headerStat(page)).toBe('3');
  const opener = page.getByTestId('settings-button');
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Theme' })).toBeVisible();
  await expect(dialog.getByRole('switch', { name: 'Sound' })).toBeVisible();
  // The switch drives the real audio controller (covered by sound.spec.ts).
  await expect(dialog.getByRole('switch', { name: 'Sound' })).toBeEnabled();

  await dialog.getByRole('button', { name: /Music/ }).click();
  const music = page.getByRole('dialog', { name: 'Music' });
  await expect(music.getByRole('slider', { name: 'Music volume' })).toBeVisible();
  await expect(music.getByRole('link', { name: 'Music Lab' })).toHaveAttribute(
    'href',
    '/music-lab/',
  );
  await music.getByRole('button', { name: '‹ Back' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();

  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.getByTestId('primary-action')).toBeVisible();
  expect(await headerStat(page)).toBe('3');
});
