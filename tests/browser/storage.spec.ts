import { expect, test } from '@playwright/test';
import { freshGame, headerStat, pressPrimary } from './helpers';
import { saveWithProfile, untilChoice } from './fixtures';

test('unavailable storage: the game runs for this visit and says so', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await page.goto('/');
  await expect(page.getByTestId('primary-action')).toBeVisible();
  await expect(page.getByTestId('save-warning')).toContainText('only for this visit');
  await pressPrimary(page, 3);
  await expect.poll(() => headerStat(page)).toBe('3');
});

test('a full quota keeps the run in memory and RETRY saves it once space is back', async ({
  page,
}) => {
  await freshGame(page);
  await pressPrimary(page, 4);
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')
      ?.value as Storage['setItem'];
    const w = window as unknown as { __restoreStorage: () => void };
    Storage.prototype.setItem = function () {
      throw new DOMException('full', 'QuotaExceededError');
    };
    w.__restoreStorage = () => {
      Storage.prototype.setItem = original;
    };
  });
  // Buying a technology forces an immediate save, which now fails.
  await pressPrimary(page, 8);
  await page.getByRole('button', { name: /Autocomplete/ }).click();
  await expect(page.getByTestId('save-warning')).toContainText('could not be saved');
  const stat = await headerStat(page);
  // RETRY while storage is still full keeps the warning (and the run in memory).
  await page.getByTestId('save-warning').getByRole('button', { name: 'RETRY' }).click();
  await expect(page.getByTestId('save-warning')).toContainText('could not be saved');
  await page.evaluate(() =>
    (window as unknown as { __restoreStorage: () => void }).__restoreStorage(),
  );
  // A periodic save may win the race; otherwise RETRY writes it.
  await page
    .getByTestId('save-warning')
    .getByRole('button', { name: 'RETRY' })
    .click({ timeout: 2000 })
    .catch(() => {});
  await expect(page.getByTestId('save-warning')).toHaveCount(0);
  const saved = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('vibe-coder.save'))) ?? '{}',
  ) as {
    run: { unlockedTechnologyIds: string[] };
  };
  expect(saved.run.unlockedTechnologyIds).toContain('autocomplete');
  expect(Number(await headerStat(page))).toBeGreaterThanOrEqual(Number(stat));
});

test('a corrupt save is left untouched; a new run keeps independently valid endings', async ({
  page,
}) => {
  const good = JSON.parse(
    saveWithProfile(untilChoice('keep-manual'), [
      { id: 'three-users', runId: 'old', activeMs: 1000, order: 1 },
    ]),
  ) as Record<string, unknown>;
  const broken = JSON.stringify({ ...good, run: { broken: true } });
  await page.addInitScript((text) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('vibe-coder.save', text);
  }, broken);
  await page.goto('/');
  await expect(page.getByText('could not be read')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('vibe-coder.save'))).toBe(broken);
  await expect(page.getByTestId('recovery-endings')).toContainText('keeps the endings');
  await page.getByRole('button', { name: 'START A NEW RUN…' }).click();
  await page.getByRole('button', { name: 'REPLACE IT WITH A NEW RUN' }).click();
  await expect(page.getByTestId('primary-action')).toBeVisible();
  const saved = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('vibe-coder.save'))) ?? '{}',
  ) as {
    profile: { endings: { id: string }[] };
  };
  expect(saved.profile.endings.map((e) => e.id)).toEqual(['three-users']);
});
