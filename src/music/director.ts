/**
 * The Music Director: two independent dimensions (era → which patterns; arrangement → which
 * roles/presets) applied only at phrase boundaries. It keeps exactly one phrase ahead. A request
 * replaces the scheduled next phrase while it is not committed; after the commit it applies to
 * the phrase after. Rapid requests collapse to the latest. The clock is never reset by an era
 * change; `stop` is the only reset. Shared by the game and every Music Lab mode.
 */
import type { MusicBackendPort, PhraseHandle, SfxId } from './backend/port';
import { compilePhrase, type PhrasePlan } from './core/phrasePlanner';
import { createBag, nextFromBag, type BagState } from './core/shuffleBag';
import { clockFor } from './core/timing';
import type { NormalizedPattern } from './core/validation';
import { patternKey, type MusicLibrary } from './library';
import type { MusicEngine } from './public';

export interface MusicRequest {
  readonly era: string;
  readonly arrangement: string;
  /** Lab audition: always play this exact version (loops on each boundary). */
  readonly pin?: string;
  /** Lab audition only: plays the phrase at this BPM; never changes the source file. */
  readonly tempoOverride?: number;
}

/**
 * Declarative cross-era transition. The current phrase always finishes; an optional stinger (a
 * validated pattern key on the shared clock) then occupies its own ticks before the new era. A
 * missing stinger is skipped, never invented.
 */
export interface EraTransition {
  readonly from: string;
  readonly to: string;
  readonly stinger?: string;
}

export type DirectorStatus =
  'transition' | 'idle' | 'playing' | 'fallback' | 'demo-fallback' | 'silent' | 'paused' | 'ended';

export interface PhraseInfo {
  readonly key: string;
  readonly eraId: string;
  /** The bank the notes actually came from (differs from eraId on a fallback). */
  readonly sourceEraId: string;
  readonly arrangementId: string;
  readonly startTick: number;
  readonly status: DirectorStatus;
}

export interface DirectorSnapshot {
  readonly requested: MusicRequest;
  readonly playing: PhraseInfo | null;
  readonly status: DirectorStatus;
}

export interface DirectorOptions {
  readonly backend: MusicBackendPort;
  readonly library: MusicLibrary;
  readonly seed: number;
  /** Audio-synchronised: called when a phrase actually starts sounding. */
  readonly onPhrase?: (info: PhraseInfo) => void;
  readonly transitions?: readonly EraTransition[];
  /**
   * Audio clock: a phrase was committed and the next one is about to be planned. A `request`
   * made here applies to that next phrase (used by data timelines such as the Lab preview).
   */
  readonly onCommit?: (info: PhraseInfo) => void;
}

export interface MusicDirector extends MusicEngine {
  request(request: MusicRequest): void;
  /** Replace the playable library (Lab mode switch); applies on the next replaceable boundary. */
  setLibrary(library: MusicLibrary): void;

  /** The only reset: clears the clock, the bags and the scheduled phrase. */
  stop(): void;
  /** The run ended: finish what is committed, then schedule nothing more (until `stop`). */
  end(): void;
  /** An allowlisted care sound on the separate SFX bus; never touches the music plan. */
  playSfx(id: SfxId): void;
  snapshot(): DirectorSnapshot;
}

interface Scheduled {
  readonly handle: PhraseHandle;
  readonly plan: PhrasePlan;
  readonly info: PhraseInfo;
  /** Bag states before this phrase's pick, restored if the phrase is replaced. */
  readonly bagsBefore: ReadonlyMap<string, BagState>;
}

const SILENT_KEY = 'silence@0';

export function createDirector(options: DirectorOptions): MusicDirector {
  const { backend } = options;
  let library = options.library;
  backend.loadPresets([...library.presets.values()]);
  let requested: MusicRequest = { era: 'discovery', arrangement: 'discovery-base' };
  /** Audible now (UI). */
  let playing: PhraseInfo | null = null;
  /** Last committed phrase: the one the scheduled `next` follows. */
  let current: PhraseInfo | null = null;
  let next: Scheduled | null = null;
  let started = false;
  let paused = false;
  let ending = false;
  let bags = new Map<string, BagState>();
  let seedCounter = 0;

  const bagFor = (eraId: string) => {
    let bag = bags.get(eraId);
    if (!bag) {
      seedCounter += 1;
      bag = createBag((options.seed + seedCounter * 7919) >>> 0);
    }
    return bag;
  };

  /** Choose the pattern for a phrase per the request, the bank and the empty-bank policy. */
  function choose(): {
    pattern: NormalizedPattern | null;
    sourceEra: string;
    status: DirectorStatus;
  } {
    if (requested.pin) {
      const pinned = library.pattern(requested.pin);
      if (pinned) return { pattern: pinned, sourceEra: pinned.eraId, status: 'playing' };
    }
    const era = library.eras.get(requested.era);
    let sourceEra = requested.era;
    let status: DirectorStatus = 'playing';
    let bank = library.bank(sourceEra);
    if (bank.length === 0 && library.options.demoFallback && era?.demoFallbackEra) {
      sourceEra = era.demoFallbackEra;
      bank = library.bank(sourceEra);
      status = 'demo-fallback';
    }
    if (bank.length === 0) {
      if (
        era?.emptyBankPolicy === 'keep-current' &&
        current &&
        library.bank(current.sourceEraId).length > 0
      ) {
        sourceEra = current.sourceEraId;
        bank = library.bank(sourceEra);
        status = 'fallback';
      } else {
        return { pattern: null, sourceEra, status: 'silent' };
      }
    }
    const pick = nextFromBag(
      bagFor(sourceEra),
      bank.map((p) => ({ key: patternKey(p), weight: 1 })),
    );
    bags = new Map(bags).set(sourceEra, pick.state);
    const pattern = pick.key ? (library.pattern(pick.key) ?? null) : null;
    return { pattern, sourceEra, status: pattern ? status : 'silent' };
  }

  function silentPlan(startTick: number): PhrasePlan {
    const era = library.eras.get(requested.era);
    const clock = clockFor({
      ppq: backend.ppq,
      timeSignature: era?.defaults.timeSignature ?? { numerator: 4, denominator: 4 },
      stepsPerBar: era?.defaults.stepsPerBar ?? 16,
      bars: era?.defaults.bars ?? 4,
      bpm: era?.defaults.bpm ?? 120,
    });
    const length = clock.ok ? clock.phraseTicks : backend.ppq * 16;
    return {
      key: SILENT_KEY,
      patternId: 'silence',
      revision: 0,
      eraId: requested.era,
      arrangementId: requested.arrangement,
      bpm: era?.defaults.bpm ?? 120,
      startTick,
      endTick: startTick + length,
      events: [],
      dropped: 0,
    };
  }

  /** A stinger applies between a finished musical phrase of `from` and a playable `to` bank. */
  function stingerFor(): NormalizedPattern | null {
    if (!current || current.status === 'transition' || current.eraId === requested.era) return null;
    if (library.bank(requested.era).length === 0) return null;
    const from = current.eraId;
    const transition = options.transitions?.find((t) => t.from === from && t.to === requested.era);
    return transition?.stinger ? (library.pattern(transition.stinger) ?? null) : null;
  }

  function schedule(startTick: number): void {
    const bagsBefore = bags;
    const stinger = stingerFor();
    if (stinger) {
      const era = library.eras.get(requested.era);
      const arrangement =
        library.arrangements.get(requested.arrangement) ??
        (era ? library.arrangements.get(era.defaultArrangement) : undefined);
      if (arrangement) {
        const plan = compilePhrase(stinger, arrangement, library.presets, startTick, backend.ppq);
        const info: PhraseInfo = {
          key: plan.key,
          eraId: requested.era,
          sourceEraId: stinger.eraId,
          arrangementId: arrangement.id,
          startTick,
          status: 'transition',
        };
        const handle = backend.schedulePhrase(
          plan,
          () => onAudible(info),
          (committed) => onCommit(committed, info),
        );
        next = { handle, plan, info, bagsBefore };
        return;
      }
    }

    const { pattern, sourceEra, status } = choose();
    const era = library.eras.get(requested.era);
    const arrangement =
      library.arrangements.get(requested.arrangement) ??
      (era ? library.arrangements.get(era.defaultArrangement) : undefined);
    const compiled =
      pattern && arrangement
        ? compilePhrase(pattern, arrangement, library.presets, startTick, backend.ppq)
        : silentPlan(startTick);
    const plan =
      pattern && requested.tempoOverride ? { ...compiled, bpm: requested.tempoOverride } : compiled;
    const info: PhraseInfo = {
      key: plan.key,
      // Keep-current continues the playing era; a demo fallback stays labelled as requested.
      eraId: status === 'fallback' ? sourceEra : requested.era,
      sourceEraId: sourceEra,
      arrangementId: arrangement?.id ?? requested.arrangement,
      startTick,
      status: pattern && arrangement ? status : 'silent',
    };
    const handle = backend.schedulePhrase(
      plan,
      () => onAudible(info),
      (committed) => onCommit(committed, info),
    );
    next = { handle, plan, info, bagsBefore };
  }

  /** Replace the scheduled next phrase while it is not committed; otherwise wait a phrase. */
  function replan(): void {
    if (!started || !next) return;
    if (backend.isCommitted(next.handle)) return;
    backend.cancelPhrase(next.handle);
    bags = new Map(next.bagsBefore);
    schedule(next.plan.startTick);
  }

  /** Audio clock: the phrase is locked in, so plan the one after it. */
  function onCommit(plan: PhrasePlan, info: PhraseInfo): void {
    if (!next || next.plan !== plan) return;
    current = info;
    next = null;
    if (ending) return;
    options.onCommit?.(info);
    schedule(plan.endTick);
  }

  /** Draw queue: the phrase is sounding now (UI notification only). */
  function onAudible(info: PhraseInfo): void {
    playing = info;
    options.onPhrase?.(info);
  }

  return {
    request(change) {
      requested = change;
      replan();
    },
    setLibrary(next) {
      library = next;
      backend.loadPresets([...next.presets.values()]);
      bags = new Map();
      replan();
    },
    snapshot: () => ({
      requested,
      playing,
      status: paused ? 'paused' : ending ? 'ended' : (playing?.status ?? 'idle'),
    }),
    start() {
      if (started) return;
      started = true;
      paused = false;
      schedule(backend.positionTicks());
      backend.start();
    },
    pause() {
      if (!started || paused) return;
      paused = true;
      backend.pause();
    },
    resume() {
      if (!started || !paused) return;
      paused = false;
      backend.resume();
    },
    end() {
      ending = true;
      if (started && next && !backend.isCommitted(next.handle)) {
        backend.cancelPhrase(next.handle);
        next = null;
      }
    },
    playSfx: (id) => backend.playSfx(id),
    stop() {
      backend.stop();
      ending = false;
      started = false;
      paused = false;
      next = null;
      playing = null;
      current = null;
      bags = new Map();
      seedCounter = 0;
    },
    setVolume: (volume) => backend.setVolume(volume),
    setMuted: (muted) => backend.setMuted(muted),
    dispose() {
      backend.dispose();
      started = false;
      next = null;
    },
  };
}
