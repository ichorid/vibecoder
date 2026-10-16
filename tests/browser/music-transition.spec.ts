import { expect, test } from '@playwright/test';

interface Probe {
  at: number;
  bpm: number;
  ticks: number;
}

test('a real Tone era transition changes tempo on the boundary without a clock reset', async ({
  page,
}) => {
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  const result = (await page.evaluate(() =>
    (
      window as unknown as { musicFixture: { transition(): Promise<unknown> } }
    ).musicFixture.transition(),
  )) as {
    probes: Probe[];
    phrases: string[];
    windows: number[];
    peak: number;
  };
  expect(result.probes).toHaveLength(4);
  const [early, beforeBoundary, after, late] = result.probes as [Probe, Probe, Probe, Probe];
  expect(early.bpm).toBeCloseTo(120, 3);
  expect(beforeBoundary.bpm).toBeCloseTo(120, 3);
  expect(after.bpm).toBeCloseTo(100, 3);
  // 8 s at 120 BPM = 3072 ticks; then 0.5 s at 100 BPM = 160 ticks. Monotonic, never reset.
  expect(after.ticks).toBeGreaterThan(3072);
  expect(after.ticks - 3072).toBeGreaterThan(140);
  expect(after.ticks - 3072).toBeLessThan(180);
  expect(late.ticks).toBeGreaterThan(after.ticks);
  // The new era's material sounds after the boundary (windows are 50 ms).
  const afterBoundary = result.windows.slice(Math.round(8 / 0.05), Math.round(9 / 0.05));
  expect(Math.max(...afterBoundary)).toBeGreaterThan(0.005);
  expect(result.peak).toBeLessThan(1);
});
