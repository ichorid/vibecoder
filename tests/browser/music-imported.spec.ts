import { expect, test } from '@playwright/test';

interface ImportedResult {
  errors: number;
  results: { key: string; rms: number; peak: number; dropped: number }[];
}

test('every imported CC0 pattern really sounds through Tone, every event plays, nothing clips', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  const result = (await page.evaluate(() =>
    (
      window as unknown as { musicFixture: { importedPatterns(): Promise<unknown> } }
    ).musicFixture.importedPatterns(),
  )) as ImportedResult;
  expect(result.errors).toBe(0);
  expect(result.results.length).toBeGreaterThan(40);
  for (const r of result.results) {
    expect(r.dropped, `${r.key} drops no event`).toBe(0);
    expect(r.rms, `${r.key} is audible`).toBeGreaterThan(0.003);
    expect(r.peak, `${r.key} does not clip`).toBeLessThan(1);
  }
  console.info(
    result.results
      .map((r) => `${r.key} rms ${r.rms.toFixed(3)} peak ${r.peak.toFixed(2)}`)
      .join('\n'),
  );
});
