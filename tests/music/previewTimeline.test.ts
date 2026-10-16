import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { createDirector } from '../../src/music/director';
import { createLibrary } from '../../src/music/library';
import {
  EVOLUTION_TIMELINE,
  createTimelineDriver,
  planTimeline,
} from '../../src/music/previewTimeline';
import { readRepository } from '../../tools/music/sources';
import { createFakeBackend } from './helpers/fakeBackend';

const PHRASE = 3072;
const repository = () => readRepository('music');
const demoLibrary = (sources = repository()) =>
  createLibrary(buildCatalog(sources).catalog, { candidates: 'demo', demoFallback: true });

describe('evolution preview timeline', () => {
  it('passes all six eras, two phrases each, 96 s by default', () => {
    const plan = planTimeline(EVOLUTION_TIMELINE, demoLibrary(), 192);
    expect(plan.entries.map((e) => e.era)).toEqual([
      'discovery',
      'discovery',
      'acceleration',
      'acceleration',
      'orchestration',
      'orchestration',
      'recursion',
      'recursion',
      'self-improvement',
      'self-improvement',
      'singularity',
      'singularity',
    ]);
    expect(plan.durationSeconds).toBeCloseTo(96, 6);
    expect(plan.entries.at(-1)?.endTick).toBe(12 * PHRASE);
  });

  it('labels a missing bank as a demo fallback with the true source era', () => {
    const plan = planTimeline(EVOLUTION_TIMELINE, demoLibrary(), 192);
    const sources = Object.fromEntries(
      plan.entries.map((e) => [e.era, [e.sourceEra, e.demoFallback]]),
    );
    expect(sources).toEqual({
      discovery: ['discovery', false],
      acceleration: ['discovery', true],
      orchestration: ['discovery', true],
      recursion: ['singularity', true],
      'self-improvement': ['singularity', true],
      singularity: ['singularity', false],
    });
  });

  it('recomputes the duration from ticks when a BPM changes', () => {
    const sources = repository();
    const eras = sources.eras.map((e) => {
      const era = e as { id: string; defaults: Record<string, unknown> };
      return era.id === 'singularity' ? { ...era, defaults: { ...era.defaults, bpm: 96 } } : era;
    });
    const plan = planTimeline(EVOLUTION_TIMELINE, demoLibrary({ ...sources, eras }), 192);
    // Six phrases (recursion, self-improvement, singularity) now come from the 96 BPM bank:
    // 16 beats × 60/96 s = 10 s each instead of 8 s.
    expect(plan.durationSeconds).toBeCloseTo(6 * 8 + 6 * 10, 6);
    expect(plan.entries.at(-1)?.endTick).toBe(12 * PHRASE);
  });

  it('drives the shared director at phrase boundaries, then ends in silence', () => {
    const fake = createFakeBackend();
    const heard: string[] = [];
    const library = demoLibrary();
    const driver = createTimelineDriver(EVOLUTION_TIMELINE);
    const director = createDirector({
      backend: fake.port,
      library,
      seed: 2,
      onCommit: driver.onCommit,
      onPhrase: (info) => heard.push(`${info.eraId}<${info.sourceEraId}:${info.status}`),
    });
    driver.attach(director);
    director.start();
    for (let i = 0; i <= 12; i += 1) fake.advanceTo(i * PHRASE);
    expect(heard.slice(0, 12)).toEqual(
      planTimeline(EVOLUTION_TIMELINE, library, 192).entries.map(
        (e) => `${e.era}<${e.sourceEra}:${e.demoFallback ? 'demo-fallback' : 'playing'}`,
      ),
    );
    expect(heard[12]).toMatch(/:silent$/);
    expect(driver.finished()).toBe(true);
  });

  it('the game approved mode never inherits the Lab-only fallback', () => {
    const library = createLibrary(buildCatalog(repository()).catalog, {
      candidates: 'approved',
      approved: new Set(),
    });
    const fake = createFakeBackend();
    const statuses: string[] = [];
    const director = createDirector({
      backend: fake.port,
      library,
      seed: 2,
      onPhrase: (i) => statuses.push(i.status),
    });
    director.request({ era: 'acceleration', arrangement: 'acceleration-base' });
    director.start();
    fake.advanceTo(0);
    expect(statuses).toEqual(['silent']);
    expect(
      planTimeline(EVOLUTION_TIMELINE, library, 192).entries.every(
        (e) => !e.demoFallback && e.sourceEra === null,
      ),
    ).toBe(true);
  });
});
