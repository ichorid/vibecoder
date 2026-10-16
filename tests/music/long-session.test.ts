import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { createDirector } from '../../src/music/director';
import { createLibrary } from '../../src/music/library';
import { readRepository } from '../../tools/music/sources';
import { createFakeBackend } from './helpers/fakeBackend';

const PHRASE = 3072;
const ERAS = [
  ['discovery', 'discovery-base'],
  ['discovery', 'discovery-support'],
  ['singularity', 'singularity-base'],
  ['singularity', 'singularity-final'],
] as const;

describe('30-minute music session', () => {
  it('keeps exact boundaries, a two-phrase horizon and bounded state across changes', () => {
    const { catalog } = buildCatalog(readRepository('music'));
    const fake = createFakeBackend();
    const starts: number[] = [];
    const director = createDirector({
      backend: fake.port,
      library: createLibrary(catalog, { candidates: 'demo' }),
      seed: 77,
      onPhrase: (info) => starts.push(info.startTick),
    });
    director.request({ era: 'discovery', arrangement: 'discovery-base' });
    director.start();
    let maxEntries = 0;
    const phrases = 225; // 30 minutes of 8-second phrases
    for (let i = 0; i < phrases; i += 1) {
      if (i % 9 === 4) {
        const [era, arrangement] = ERAS[((i / 9) % ERAS.length) | 0] ?? ERAS[0];
        director.request({ era, arrangement });
      }
      if (i % 50 === 25) {
        director.pause();
        director.resume();
      }
      fake.advanceTo(i * PHRASE + (i % 7) * 5);
      maxEntries = Math.max(maxEntries, fake.entries().length);
    }
    expect(starts).toHaveLength(phrases);
    starts.forEach((tick, i) => expect(tick).toBe(i * PHRASE));
    expect(maxEntries).toBeLessThanOrEqual(2);
    expect(fake.port.diagnostics().phrases).toBeLessThanOrEqual(2);
    expect(fake.cancelled.length).toBeLessThan(phrases / 4);
  });

  it('100 start/pause/stop cycles and mode switches leave nothing scheduled', () => {
    const { catalog } = buildCatalog(readRepository('music'));
    const fake = createFakeBackend();
    const all = createLibrary(catalog, { candidates: 'all' });
    const demo = createLibrary(catalog, { candidates: 'demo', demoFallback: true });
    const director = createDirector({ backend: fake.port, library: all, seed: 3 });
    for (let i = 0; i < 100; i += 1) {
      director.setLibrary(i % 2 ? all : demo);
      director.request({
        era: i % 3 ? 'discovery' : 'acceleration',
        arrangement: 'discovery-base',
      });
      director.start();
      fake.advanceTo(PHRASE / 2);
      director.pause();
      director.resume();
      director.stop();
      expect(fake.entries()).toHaveLength(0);
    }
    expect(fake.port.diagnostics()).toMatchObject({ phrases: 0, scheduledEvents: 0 });
  });
});
