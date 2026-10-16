import { expect, test } from '@playwright/test';

interface Diagnostics {
  scheduledEvents: number;
  liveVoices: number;
  instruments: number;
  phrases: number;
}

test('two minutes of real Tone playback keep handles, phrases and voices bounded', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  const result = (await page.evaluate(() =>
    (
      window as unknown as { musicFixture: { longRender(): Promise<unknown> } }
    ).musicFixture.longRender(),
  )) as { samples: { at: number; diagnostics: Diagnostics }[]; peak: number };
  expect(result.samples).toHaveLength(4);
  const first = result.samples[0]?.diagnostics;
  for (const { diagnostics } of result.samples) {
    expect(diagnostics.phrases).toBeLessThanOrEqual(3);
    expect(diagnostics.liveVoices).toBeLessThanOrEqual(8);
    expect(diagnostics.instruments).toBeLessThanOrEqual(8);
    // No growth: late samples hold about as many scheduled events as the first one.
    expect(diagnostics.scheduledEvents).toBeLessThanOrEqual((first?.scheduledEvents ?? 0) * 2 + 50);
  }
  expect(result.peak).toBeLessThan(1);
});

test('in a realtime context, a preset unused for a whole phrase releases its voice bank', async ({
  page,
}) => {
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
  await page.mouse.click(5, 5);
  const preset = (id: string) => ({
    schemaVersion: 1,
    id,
    revision: 1,
    family: 'pulse',
    level: 0.5,
    envelope: { attack: 0.005, decay: 0.05, sustain: 0.3, release: 0.05 },
    polyphony: 1,
  });
  const result = (await page.evaluate(
    (presets) =>
      (
        window as unknown as { musicFixture: { liveRelease(p: unknown[]): Promise<unknown> } }
      ).musicFixture.liveRelease(presets),
    [preset('a'), preset('b')],
  )) as { early: Diagnostics; late: Diagnostics };
  expect(result.early.instruments).toBe(2);
  expect(result.late.instruments).toBe(1);
});
