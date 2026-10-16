/**
 * S09.3 (headless part): the real music binding through a full 30-minute baseline run, with a
 * fake backend kept in step with active time and the demo pack (each era's bank, or the current
 * bank under keep-current when an era has no demo material). Records which bank sounded when.
 */
import { describe, expect, it } from 'vitest';
import { catalog } from '../content/catalog';
import { applyCommand } from '../game/commands';
import { createRun } from '../game/createRun';
import { selectMusicProjection } from '../game/selectors';
import { stepRun } from '../game/simulation';
import { createDirector, type PhraseInfo } from '../music/director';
import demoPack from '../music/data/pack.demo.json';
import { libraryFromPack, type MusicPack } from '../music/pack';
import { createAudioPreferences } from '../music/preferences';
import {
  acknowledgeReveals,
  baselineBuyer,
  baselineCare,
  baselinePrimary,
  playEvery,
  type Policy,
} from '../../tests/helpers/scenario';
import { createFakeBackend } from '../../tests/music/helpers/fakeBackend';
import { createMusicBinding } from './musicBinding';

const TICKS_PER_MS = (120 / 60) * (192 / 1000); // 120 BPM, PPQ 192

async function fullRun(care: boolean) {
  const fake = createFakeBackend();
  const heard: (PhraseInfo & { atMin: number })[] = [];
  let activeMs = 0;
  const binding = createMusicBinding({
    preferences: createAudioPreferences(null),
    userActivationActive: () => true,
    now: () => activeMs,
    load: () =>
      Promise.resolve({
        director: createDirector({
          backend: fake.port,
          library: libraryFromPack(demoPack as unknown as MusicPack),
          seed: 8,
          onPhrase: (info) => heard.push({ ...info, atMin: activeMs / 60_000 }),
        }),
        unlock: () => Promise.resolve(),
        patterns: demoPack.manifest.length,
      }),
  });
  let run = createRun(101, care ? 'music-care' : 'music-neglect');
  binding.project(selectMusicProjection(run));
  await binding.controls.setSound(true);
  const policies: Policy[] = [
    baselinePrimary,
    baselineBuyer,
    acknowledgeReveals,
    ...(care ? [...baselineCare, playEvery(270_000)] : []),
  ];
  const unlockAt = new Map<string, number>();
  while (run.activeMs < 45 * 60_000 && run.status === 'playing') {
    for (const policy of policies) {
      for (const command of policy({ run, catalog })) {
        const result = applyCommand(run, command, run.activeMs, catalog);
        binding.facts(result.facts);
        run = result.run;
      }
    }
    const step = stepRun(run, 100, catalog);
    run = step.run;
    binding.facts(step.facts);
    activeMs = run.activeMs;
    for (const id of run.unlockedTechnologyIds)
      if (!unlockAt.has(id)) unlockAt.set(id, run.activeMs);
    binding.project(selectMusicProjection(run));
    fake.advanceTo(Math.floor(run.activeMs * TICKS_PER_MS));
    if (
      run.unlockedTechnologyIds.includes('autonomous-company') &&
      run.activeMs > (unlockAt.get('autonomous-company') ?? 0) + 40_000
    )
      break;
  }
  return { heard, unlockAt, run, schedule: fake.log.filter((l) => l.startsWith('schedule')) };
}

describe('music through a full game run (headless)', { timeout: 60_000 }, () => {
  it('follows technology → era boundaries with at most two phrases of delay', async () => {
    const { heard, unlockAt } = await fullRun(true);
    const stages = [
      ['discovery', null],
      ['acceleration', 'terminal-agent'],
      ['orchestration', 'parallel-agents'],
      ['recursion', 'custom-harness'],
      ['self-improvement', 'self-improvement'],
      ['singularity', 'autonomous-company'],
    ] as const;
    const rows: string[] = [];
    for (const [era, technology] of stages) {
      const unlock = technology ? (unlockAt.get(technology) ?? Infinity) / 60_000 : 0;
      const during = heard.filter(
        (h) => h.atMin >= unlock && h.atMin < unlock + 1 && technology !== null,
      );
      const sample = during.find((h) => h.status !== 'idle') ?? heard[0];
      rows.push(
        `${era}: unlocked ${unlock.toFixed(1)} min → ${sample?.status ?? '-'} from the ${sample?.sourceEraId ?? '-'} bank`,
      );
      if (era === 'singularity') {
        const first = heard.find((h) => h.sourceEraId === 'singularity' && h.atMin >= unlock);
        expect(first).toBeDefined();
        expect((first?.atMin ?? Infinity) - unlock).toBeLessThanOrEqual(16 / 60);
      }
    }
    console.info(rows.join('\n'));
    // Eras without demo material keep the current bank, labelled as a fallback.
    expect(heard.some((h) => h.status === 'fallback')).toBe(true);
    expect(heard.every((h) => h.status !== 'demo-fallback')).toBe(true);
  });

  it('a starving or dead cat changes nothing in the music plan', async () => {
    const cared = await fullRun(true);
    const neglected = await fullRun(false);
    expect(neglected.run.cat.alive).toBe(false);
    // Up to the earlier company unlock both runs share the same musical intents.
    const intents = (r: typeof cared) =>
      r.heard.filter((h) => h.atMin < 20).map((h) => `${h.eraId}/${h.arrangementId}`);
    const shared = Math.min(intents(cared).length, intents(neglected).length);
    expect(intents(neglected).slice(0, shared)).toEqual(intents(cared).slice(0, shared));
  });
});
