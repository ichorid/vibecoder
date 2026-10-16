import { expect, test, type Page } from '@playwright/test';

/** Production preview: the Music Lab is a second ordinary page of the public build. */

async function openLab(page: Page) {
  await page.goto('/music-lab/');
  await expect(page.getByRole('heading', { name: 'Music Lab' })).toBeVisible();
}

const nowKey = (page: Page) => page.getByTestId('now-key');

test('the game page never loads the Lab, Tone or an AudioContext before a gesture', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await page.goto('/');
  await expect(page.getByTestId('primary-action')).toBeVisible();
  // The lazily loaded world renderer is the last thing the first screen fetches.
  await expect(page.getByTestId('world-canvas')).toHaveAttribute('data-ticker', 'running');
  expect(requests.filter((p) => /music-lab|\/lab-|loader-|\.v1-/.test(p))).toEqual([]);
});

test('opening the Lab creates no game run and no audio until PLAY', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(new URL(r.url()).pathname));
  await openLab(page);
  await page.waitForLoadState('networkidle');
  expect(requests.some((p) => /loader-/.test(p))).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('vibe-coder.save'))).toBeNull();
  await expect(page.getByTestId('lab-status')).toHaveText('idle');
  await expect(page.getByTestId('now-playing')).toContainText('Nothing is sounding');
});

test('Single: a demo version is audible, labelled, and switches on the boundary', async ({
  page,
}) => {
  await openLab(page);
  await page.locator('[data-key="discovery-demo-a@1"]').click();
  await expect(page.getByTestId('demo-label')).toBeVisible();
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('lab-status')).toHaveText('playing');
  await expect(nowKey(page)).toHaveText('discovery-demo-a@1', { timeout: 5_000 });
  await page.locator('[data-key="singularity-demo-a@1"]').click();
  await expect(nowKey(page)).toHaveText('discovery-demo-a@1');
  await expect(nowKey(page)).toHaveText('singularity-demo-a@1', { timeout: 20_000 });
  await page.getByRole('button', { name: 'STOP' }).click();
  await expect(page.getByTestId('lab-status')).toHaveText('idle');
});

test('Random: approved-only is honestly empty; the demo toggle plays the demo bank', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('tab', { name: 'Random' }).click();
  await expect(page.getByTestId('random-candidates')).toContainText('0 approved patterns');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('lab-message')).toContainText('No approved patterns');
  await expect(page.getByTestId('lab-status')).toHaveText('idle');
  await page.getByLabel('Include temporary demo material').check();
  await expect(page.getByTestId('random-candidates')).toContainText('2 demo patterns');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(nowKey(page)).toHaveText(/^discovery-demo-[ab]@1$/, { timeout: 5_000 });
  await expect(page.getByTestId('demo-label')).toBeVisible();
});

test('Transition and Evolution play through the same engine; a mode switch clears playback', async ({
  page,
}) => {
  await openLab(page);
  await page.getByRole('tab', { name: 'Transition' }).click();
  await page.getByLabel('Pattern A').selectOption('discovery-demo-b@1');
  await page.getByLabel('Pattern B').selectOption('singularity-demo-b@1');
  await expect(page.getByTestId('transition-warning')).toHaveCount(0);
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(nowKey(page)).toHaveText('discovery-demo-b@1', { timeout: 5_000 });

  await page.getByRole('tab', { name: 'Evolution' }).click();
  await expect(page.getByTestId('lab-status')).toHaveText('idle');
  await expect(page.getByTestId('now-playing')).toContainText('Nothing is sounding');
  await expect(page.getByLabel('Evolution preview')).toContainText('96 s');
  await expect(page.getByLabel('Evolution preview')).toContainText('demo fallback: Discovery bank');
  await page.getByRole('button', { name: 'PLAY' }).click();
  await expect(page.getByTestId('now-playing')).toContainText('era: Discovery', { timeout: 5_000 });
});

test('the Lab is usable by keyboard and at 390 px without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await openLab(page);
  for (const mode of ['Single', 'Random', 'Transition', 'Evolution']) {
    await page.getByRole('tab', { name: mode }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, mode).toBeLessThanOrEqual(0);
  }
  await page.getByRole('tab', { name: 'Single' }).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lab-status')).toHaveText(/loading|playing/);
  await page.getByRole('button', { name: 'STOP' }).click();
  await page.getByRole('slider').fill('0.5');
  await page.getByRole('tab', { name: 'Random' }).click();
  await expect(page.getByRole('slider')).toHaveValue('0.5');
});
