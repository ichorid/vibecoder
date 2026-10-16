import { expect, test } from '@playwright/test';

test('the dev server serves the same Music Lab page with the full source catalog', async ({
  page,
}) => {
  await page.goto('/music-lab/');
  await expect(page.getByRole('heading', { name: 'Music Lab' })).toBeVisible();
  for (const key of [
    'discovery-demo-a@1',
    'discovery-demo-b@1',
    'singularity-demo-a@1',
    'singularity-demo-b@1',
  ]) {
    await expect(page.locator(`[data-key="${key}"]`)).toBeVisible();
  }
});
