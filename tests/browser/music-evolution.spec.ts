import { expect, test } from '@playwright/test';

interface EvolutionResult {
  errors: number;
  commits: string[];
  phraseRms: number[];
  tail: number;
  peak: number;
}

test('the four demo patterns really sound through all six eras, then the preview ends', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  const result = (await page.evaluate(() =>
    (
      window as unknown as { musicFixture: { evolution(): Promise<unknown> } }
    ).musicFixture.evolution(),
  )) as EvolutionResult;
  expect(result.errors).toBe(0);
  expect(result.commits.slice(0, 12)).toEqual([
    'discovery<discovery:playing',
    'discovery<discovery:playing',
    'acceleration<discovery:demo-fallback',
    'acceleration<discovery:demo-fallback',
    'orchestration<discovery:demo-fallback',
    'orchestration<discovery:demo-fallback',
    'recursion<singularity:demo-fallback',
    'recursion<singularity:demo-fallback',
    'self-improvement<singularity:demo-fallback',
    'self-improvement<singularity:demo-fallback',
    'singularity<singularity:playing',
    'singularity<singularity:playing',
  ]);
  for (const [i, rms] of result.phraseRms.entries()) {
    expect(rms, `phrase ${i} is audible`).toBeGreaterThan(0.003);
  }
  expect(result.peak).toBeLessThan(1);
  expect(result.tail).toBeLessThan(0.001);
});
