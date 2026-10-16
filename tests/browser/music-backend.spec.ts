import { expect, test, type Page } from '@playwright/test';
import type { PlannedEvent } from '../../src/music/core/phrasePlanner';
import type { PresetDocument } from '../../src/music/data/patterns.generated';
import type { RenderSpec } from '../music/browser/fixture';

const PRESETS: PresetDocument[] = [
  {
    schemaVersion: 1,
    id: 'lead',
    revision: 1,
    family: 'pulse',
    level: 0.6,
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.05 },
    polyphony: 1,
    pulseWidth: 0.25,
  },
  {
    schemaVersion: 1,
    id: 'bass',
    revision: 1,
    family: 'triangle',
    level: 0.8,
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.05 },
    polyphony: 1,
  },
  {
    schemaVersion: 1,
    id: 'arp',
    revision: 1,
    family: 'arp',
    level: 0.4,
    envelope: { attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.05 },
    polyphony: 4,
    pulseWidth: 0.125,
  },
  {
    schemaVersion: 1,
    id: 'kit',
    revision: 1,
    family: 'noise',
    level: 0.7,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    polyphony: 3,
  },
];

const note = (
  presetId: string,
  startTick: number,
  endTick: number,
  midi: number,
  velocity = 0.8,
): PlannedEvent => ({
  role: presetId,
  presetId,
  type: 'note',
  startTick,
  endTick,
  midi,
  sound: null,
  velocity,
});
const drum = (startTick: number, sound: 'kick' | 'snare' | 'hat'): PlannedEvent => ({
  role: 'percussion',
  presetId: 'kit',
  type: 'drum',
  startTick,
  endTick: startTick + 48,
  midi: null,
  sound,
  velocity: 0.9,
});

async function render(page: Page, spec: Partial<RenderSpec> & { phrases: RenderSpec['phrases'] }) {
  return page.evaluate(
    (s) =>
      (
        window as unknown as {
          musicFixture: {
            render(x: unknown): Promise<{ windows: number[]; peak: number; diagnostics: unknown }>;
          };
        }
      ).musicFixture.render(s),
    { seconds: 2, presets: PRESETS, ...spec },
  );
}

const windowAt = (windows: number[], seconds: number) => windows[Math.floor(seconds / 0.05)] ?? 0;

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/music/browser/fixture.html');
  await page.waitForFunction(() => 'musicFixture' in window);
});

test('a short plan renders a real nonzero signal under the limiter', async ({ page }) => {
  const result = await render(page, {
    phrases: [
      {
        startTick: 0,
        endTick: 768,
        events: [note('lead', 0, 192, 76), note('lead', 192, 384, 79)],
      },
    ],
  });
  expect(windowAt(result.windows, 0.1)).toBeGreaterThan(0.01);
  expect(result.peak).toBeGreaterThan(0.05);
  expect(result.peak).toBeLessThanOrEqual(1);
});

for (const [family, events] of [
  ['pulse lead', [note('lead', 0, 384, 76)]],
  ['triangle bass', [note('bass', 0, 384, 40)]],
  ['arpeggio', [note('arp', 0, 96, 72), note('arp', 0, 96, 76), note('arp', 96, 192, 79)]],
  ['noise drums', [drum(0, 'kick'), drum(96, 'snare'), drum(144, 'hat')]],
] as const) {
  test(`${family} sounds`, async ({ page }) => {
    const result = await render(page, {
      seconds: 1,
      phrases: [{ startTick: 0, endTick: 768, events: [...events] }],
    });
    expect(Math.max(...result.windows.slice(0, 6))).toBeGreaterThan(0.005);
  });
}

test('velocity 0 and master mute are silent; a dense legal mix does not clip', async ({ page }) => {
  const silent = await render(page, {
    seconds: 1,
    phrases: [{ startTick: 0, endTick: 768, events: [note('lead', 0, 384, 76, 0)] }],
  });
  expect(silent.peak).toBeLessThan(0.001);
  const muted = await render(page, {
    seconds: 1,
    muted: true,
    phrases: [{ startTick: 0, endTick: 768, events: [note('lead', 0, 384, 76)] }],
  });
  expect(muted.peak).toBeLessThan(0.001);
  const dense = await render(page, {
    seconds: 1,
    volume: 1,
    phrases: [
      {
        startTick: 0,
        endTick: 768,
        events: [
          note('lead', 0, 384, 76, 1),
          note('bass', 0, 384, 40, 1),
          note('arp', 0, 384, 72, 1),
          note('arp', 0, 384, 76, 1),
          note('arp', 0, 384, 79, 1),
          drum(0, 'kick'),
          drum(0, 'snare'),
        ],
      },
    ],
  });
  expect(dense.peak).toBeLessThanOrEqual(1);
});

test('two adjacent phrases sustain across the boundary without a gap', async ({ page }) => {
  // Sustained-support fixture: one long note per phrase; silence at the seam would be a bug.
  const result = await render(page, {
    seconds: 3,
    phrases: [
      { startTick: 0, endTick: 768, events: [note('bass', 0, 768, 40)] },
      { startTick: 768, endTick: 1536, events: [note('bass', 768, 1536, 43)] },
    ],
  });
  const seam = result.windows.slice(Math.floor(0.8 / 0.05), Math.floor(1.2 / 0.05));
  const typical = windowAt(result.windows, 0.5);
  expect(Math.min(...seam)).toBeGreaterThan(typical * 0.3);
});

test('pause silences queued notes; resume continues only what was still playing', async ({
  page,
}) => {
  // 0.0–0.25 s finished note, 0.5–2.5 s long note, notes at 1.25 and 1.5 s queued during pause.
  const result = await render(page, {
    seconds: 3.5,
    pauseAt: 1,
    resumeAt: 2,
    phrases: [
      {
        startTick: 0,
        endTick: 3072,
        events: [
          note('lead', 0, 96, 84),
          note('bass', 192, 960, 40),
          note('arp', 480, 520, 72),
          note('arp', 576, 620, 76),
        ],
      },
    ],
  });
  for (const t of [1.2, 1.4, 1.6, 1.8]) expect(windowAt(result.windows, t)).toBeLessThan(0.002);
  expect(windowAt(result.windows, 2.2)).toBeGreaterThan(0.01);
});

test('stop silences everything and repeated lifecycles leave nothing behind', async ({ page }) => {
  const stopped = await render(page, {
    seconds: 2,
    stopAt: 0.5,
    phrases: [{ startTick: 0, endTick: 3072, events: [note('bass', 0, 1536, 40)] }],
  });
  for (const t of [0.7, 1.0, 1.5]) expect(windowAt(stopped.windows, t)).toBeLessThan(0.002);
  const diagnostics = await page.evaluate(() =>
    (
      window as unknown as { musicFixture: { lifecycleCycles(n: number): Promise<unknown> } }
    ).musicFixture.lifecycleCycles(100),
  );
  expect(diagnostics).toEqual({ scheduledEvents: 0, liveVoices: 0, instruments: 0, phrases: 0 });
});

test('no audio context or Tone code before the gesture; sound runs after it', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    let created = 0;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        created += 1;
      }
    };
    (window as unknown as { audioContexts: () => number }).audioContexts = () => created;
  });
  await page.goto('/tests/music/browser/controller.html');
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() =>
      (window as unknown as { audioContexts: () => number }).audioContexts(),
    ),
  ).toBe(0);
  const toneLoaded = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .some((e) => /node_modules\/\.vite\/deps\/tone|\/tone\./.test(e.name)),
  );
  expect(toneLoaded).toBe(false);
  await page.locator('#sound').click();
  await expect(page.locator('#status')).toHaveText(/playing|needsGesture/);
  if ((await page.locator('#status').textContent()) === 'needsGesture')
    await page.locator('#sound').click();
  await expect(page.locator('#status')).toHaveText('playing');
  expect(
    await page.evaluate(() =>
      (window as unknown as { contextState: () => Promise<string> }).contextState(),
    ),
  ).toBe('running');
});
