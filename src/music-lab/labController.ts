/**
 * Music Lab controller: four audition modes over ONE director and one backend per document.
 * Tone is loaded only on the first PLAY (a user gesture). Every mode is data fed to the same
 * director; mode drivers advance on its audio-clock commits, never on browser timers.
 */
import type { MusicBackendPort } from '../music/backend/port';
import { buildCatalog, type MusicCatalog, type MusicSources } from '../music/core/catalog';
import { DEFAULT_BOUNDARY_RULES, pairAllowed } from '../music/core/compatibility';
import { analyzePattern, type NormalizedPattern } from '../music/core/validation';
import {
  createDirector,
  type MusicDirector,
  type MusicRequest,
  type PhraseInfo,
} from '../music/director';
import { createLibrary, patternKey, type MusicLibrary } from '../music/library';
import type { AudioPreferenceStore } from '../music/preferences';
import { EVOLUTION_TIMELINE, createTimelineDriver, planTimeline } from '../music/previewTimeline';

export type LabMode = 'single' | 'random' | 'transition' | 'evolution';
export type LabStatus = 'idle' | 'loading' | 'needsGesture' | 'playing' | 'paused' | 'error';

export interface LabEntry {
  readonly key: string;
  readonly id: string;
  readonly revision: number;
  readonly eraId: string;
  readonly demo: boolean;
  readonly playable: boolean;
  readonly bpm: number | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface LabState {
  readonly mode: LabMode;
  readonly status: LabStatus;
  readonly message: string | null;
  readonly eras: readonly { readonly id: string; readonly title: string }[];
  readonly entries: readonly LabEntry[];
  /** Diagnostics for source documents that are not patterns or failed structurally. */
  readonly catalogErrors: readonly string[];
  /** Audible now (backend-synchronised), distinct from any selection. */
  readonly now: PhraseInfo | null;
  /** True while temporary demo material may sound in the current mode. */
  readonly demoPlayback: boolean;
  readonly single: { readonly selected: string | null; readonly tempoOverride: number | null };
  readonly random: {
    readonly era: string;
    readonly includeDemo: boolean;
    readonly candidates: number;
  };
  readonly transition: {
    readonly a: string | null;
    readonly b: string | null;
    readonly warning: string | null;
  };
  readonly evolution: {
    readonly durationSeconds: number;
    readonly stages: readonly { era: string; sourceEra: string | null; demoFallback: boolean }[];
    /** Index of the committed phrase (−1 before start). */
    readonly position: number;
  };
  readonly volume: number;
  readonly muted: boolean;
}

export interface LoadedBackend {
  readonly backend: MusicBackendPort;
  /** Resume the audio context; called inside the PLAY gesture. */
  unlock(): Promise<void>;
}

export interface LabControllerOptions {
  readonly sources: MusicSources;
  readonly seed: number;
  readonly preferences: AudioPreferenceStore;
  readonly load: () => Promise<LoadedBackend>;
  readonly onState: (state: LabState) => void;
  /** Exact approved keys (S05 reviews); empty until a human approves something. */
  readonly approved?: ReadonlySet<string>;
}

export interface LabController {
  state(): LabState;
  setMode(mode: LabMode): void;
  select(key: string): void;
  setTempoOverride(bpm: number | null): void;
  setRandom(change: { era?: string; includeDemo?: boolean }): void;
  setTransition(a: string | null, b: string | null): void;
  /** From a PLAY gesture. Resolves; never rejects. */
  play(): Promise<void>;
  stop(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Document hidden/visible: silence immediately, resume without catch-up. */
  suspend(): void;
  wake(): void;
  dispose(): void;
}

const PPQ = 192;

function describeEntries(catalog: MusicCatalog): LabEntry[] {
  return catalog.patterns
    .map((document) => {
      const { normalized, diagnostics } = analyzePattern(document, catalog);
      return {
        key: patternKey(document),
        id: document.id,
        revision: document.revision,
        eraId: document.eraId,
        demo: document.demo,
        playable: normalized !== null,
        bpm: normalized?.bpm ?? null,
        errors: diagnostics.filter((d) => d.level === 'error').map((d) => d.message),
        warnings: diagnostics.filter((d) => d.level === 'warning').map((d) => d.message),
      };
    })
    .sort((a, b) => a.eraId.localeCompare(b.eraId) || a.key.localeCompare(b.key));
}

function clockOf(p: NormalizedPattern): string {
  return `${p.bpm} BPM ${p.timeSignature.numerator}/${p.timeSignature.denominator} ${p.bars}×${p.stepsPerBar}`;
}

export function createLabController(options: LabControllerOptions): LabController {
  const { catalog, diagnostics } = buildCatalog(options.sources);
  const entries = describeEntries(catalog);
  const catalogErrors = diagnostics
    .filter((d) => d.level === 'error' && !entries.some((e) => d.source.includes(e.key)))
    .map((d) => d.message);
  const approved = options.approved ?? new Set<string>();
  const libraries = {
    all: createLibrary(catalog, { candidates: 'all' }),
    approved: createLibrary(catalog, { candidates: 'approved', approved }),
    demo: createLibrary(catalog, { candidates: 'demo' }),
    evolution: createLibrary(catalog, { candidates: 'demo', demoFallback: true }),
  };
  // Progression order (the timeline), then any extra eras alphabetically.
  const progression = EVOLUTION_TIMELINE.map((stage) => stage.era);
  const rank = (id: string) => {
    const index = progression.indexOf(id);
    return index < 0 ? progression.length : index;
  };
  const orderedEras = [...catalog.eras.values()].sort(
    (a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id),
  );
  const firstEra = orderedEras[0]?.id ?? 'discovery';
  const prefs = options.preferences.load();

  let mode: LabMode = 'single';
  let status: LabStatus = 'idle';
  let message: string | null = null;
  let now: PhraseInfo | null = null;
  let selected: string | null = entries.find((e) => e.playable)?.key ?? null;
  let tempoOverride: number | null = null;
  let randomEra = firstEra;
  let includeDemo = false;
  let transitionA: string | null = null;
  let transitionB: string | null = null;
  let volume = prefs.volume;
  let muted = false;
  let suspended = false;

  let loaded: LoadedBackend | null = null;
  let loading: Promise<LoadedBackend | null> | null = null;
  let director: MusicDirector | null = null;
  let playing = false;
  let disposed = false;
  /** The active mode's per-commit hook (timeline/transition drivers). */
  let modeCommit: ((info: PhraseInfo) => void) | null = null;
  let timeline = createTimelineDriver(EVOLUTION_TIMELINE);

  const randomLibrary = () => (includeDemo ? libraries.demo : libraries.approved);
  const evolutionPlan = planTimeline(EVOLUTION_TIMELINE, libraries.evolution, PPQ);

  function transitionWarning(): string | null {
    const a = transitionA ? libraries.all.pattern(transitionA) : undefined;
    const b = transitionB ? libraries.all.pattern(transitionB) : undefined;
    if (!a || !b) return null;
    const problems: string[] = [];
    if (!pairAllowed(a, b, DEFAULT_BOUNDARY_RULES))
      problems.push(`boundary ${a.exitGroup} → ${b.entryGroup} is not allowed in a bank`);
    if (!pairAllowed(b, a, DEFAULT_BOUNDARY_RULES))
      problems.push(`boundary ${b.exitGroup} → ${a.entryGroup} (loop back) is not allowed`);
    if (a.eraId === b.eraId && clockOf(a) !== clockOf(b))
      problems.push(`clocks differ (${clockOf(a)} vs ${clockOf(b)})`);
    return problems.length > 0 ? `Lab audition only: ${problems.join('; ')}.` : null;
  }

  const snapshot = (): LabState => ({
    mode,
    status,
    message,
    eras: orderedEras.map((e) => ({ id: e.id, title: e.title })),
    entries,
    catalogErrors,
    now,
    demoPlayback:
      mode === 'evolution' ||
      (mode === 'random' && includeDemo) ||
      (mode === 'single' && (entries.find((e) => e.key === selected)?.demo ?? false)) ||
      (mode === 'transition' &&
        [transitionA, transitionB].some((k) => entries.find((e) => e.key === k)?.demo)),
    single: { selected, tempoOverride },
    random: { era: randomEra, includeDemo, candidates: randomLibrary().bank(randomEra).length },
    transition: { a: transitionA, b: transitionB, warning: transitionWarning() },
    evolution: {
      durationSeconds: evolutionPlan.durationSeconds,
      stages: evolutionPlan.entries
        .filter((_, i) => i % 2 === 0)
        .map((e) => ({ era: e.era, sourceEra: e.sourceEra, demoFallback: e.demoFallback })),
      position: mode === 'evolution' ? timeline.position() : -1,
    },
    volume,
    muted,
  });
  const publish = () => options.onState(snapshot());

  function pinRequest(key: string): MusicRequest {
    const entry = libraries.all.pattern(key);
    const era = entry ? catalog.eras.get(entry.eraId) : undefined;
    return {
      era: entry?.eraId ?? firstEra,
      arrangement: era?.defaultArrangement ?? '',
      pin: key,
      ...(tempoOverride !== null ? { tempoOverride } : {}),
    };
  }

  function randomRequest(): MusicRequest {
    const era = catalog.eras.get(randomEra);
    return { era: randomEra, arrangement: era?.defaultArrangement ?? '' };
  }

  /** Why the current mode cannot play, or null. */
  function blocker(): string | null {
    if (mode === 'single') {
      const entry = entries.find((e) => e.key === selected);
      if (!entry) return 'Select a pattern first.';
      if (!entry.playable) return `${entry.key} cannot play: it has validation errors.`;
    }
    if (mode === 'random' && randomLibrary().bank(randomEra).length === 0) {
      return includeDemo
        ? 'This era has no demo patterns.'
        : 'No approved patterns in this era yet. Turn on demo material to audition the temporary demos.';
    }
    if (mode === 'transition') {
      if (!transitionA || !transitionB) return 'Choose both A and B.';
      if (!libraries.all.pattern(transitionA) || !libraries.all.pattern(transitionB))
        return 'A and B must both be playable (no validation errors).';
    }
    return null;
  }

  /** Configure the director for the current mode from a clean stop. */
  function arm(target: MusicDirector): void {
    target.stop();
    now = null;
    modeCommit = null;
    if (mode === 'single' && selected) {
      target.setLibrary(libraries.all);
      target.request(pinRequest(selected));
    } else if (mode === 'random') {
      target.setLibrary(randomLibrary());
      target.request(randomRequest());
    } else if (mode === 'transition' && transitionA && transitionB) {
      const order = [transitionA, transitionB];
      let committed = 0;
      target.setLibrary(libraries.all);
      target.request(pinRequest(transitionA));
      modeCommit = () => {
        committed += 1;
        target.request(pinRequest(order[committed % 2] ?? transitionA ?? ''));
      };
    } else if (mode === 'evolution') {
      timeline = createTimelineDriver(EVOLUTION_TIMELINE);
      target.setLibrary(libraries.evolution);
      timeline.attach(target);
      modeCommit = timeline.onCommit;
    }
  }

  function stopPlayback(): void {
    if (director && playing) director.stop();
    playing = false;
    modeCommit = null;
    now = null;
    status = 'idle';
  }

  function onPhrase(info: PhraseInfo): void {
    now = info;
    // The evolution preview ends on its first silent boundary after the last stage.
    if (mode === 'evolution' && timeline.finished() && info.status === 'silent') {
      stopPlayback();
    }
    publish();
  }

  function ensureDirector(audio: LoadedBackend): MusicDirector {
    if (director) return director;
    audio.backend.setVolume(volume);
    audio.backend.setMuted(muted);
    director = createDirector({
      backend: audio.backend,
      library: libraries.all,
      seed: options.seed,
      onPhrase,
      onCommit: (info) => {
        modeCommit?.(info);
        if (mode === 'evolution') publish();
      },
    });
    return director;
  }

  function load(): Promise<LoadedBackend | null> {
    loading ??= options.load().then(
      (audio) => {
        if (disposed) {
          audio.backend.dispose();
          return null;
        }
        loaded = audio;
        return audio;
      },
      (error: unknown) => {
        status = 'error';
        message = `Sound could not load: ${String(error)}`;
        loading = null;
        publish();
        return null;
      },
    );
    return loading;
  }

  /** Mode/selection changed while playing: start the new configuration cleanly. */
  function restartIfPlaying(): void {
    if (!playing || !director) return;
    if (blocker()) {
      stopPlayback();
      return;
    }
    arm(director);
    director.start();
  }

  publish();

  return {
    state: snapshot,
    setMode(next) {
      if (next === mode) return;
      stopPlayback();
      mode = next;
      message = null;
      publish();
    },
    select(key) {
      selected = key;
      message = null;
      if (playing && director && mode === 'single') {
        if (blocker()) stopPlayback();
        else director.request(pinRequest(key));
      }
      publish();
    },
    setTempoOverride(bpm) {
      tempoOverride =
        bpm !== null && Number.isFinite(bpm) ? Math.min(240, Math.max(40, bpm)) : null;
      if (playing && director && mode === 'single' && selected) {
        director.request(pinRequest(selected));
      }
      publish();
    },
    setRandom(change) {
      if (change.era !== undefined) randomEra = change.era;
      if (change.includeDemo !== undefined) {
        const libraryChanged = change.includeDemo !== includeDemo;
        includeDemo = change.includeDemo;
        if (libraryChanged && playing && director && mode === 'random') {
          director.setLibrary(randomLibrary());
        }
      }
      message = null;
      if (playing && director && mode === 'random') {
        if (blocker()) stopPlayback();
        else director.request(randomRequest());
      }
      publish();
    },
    setTransition(a, b) {
      transitionA = a;
      transitionB = b;
      message = null;
      restartIfPlaying();
      publish();
    },
    async play() {
      if (disposed) return;
      const problem = blocker();
      if (problem) {
        message = problem;
        publish();
        return;
      }
      if (!loaded) {
        status = 'loading';
        publish();
      }
      const audio = loaded ?? (await load());
      if (!audio) return;
      try {
        await audio.unlock();
      } catch {
        status = 'needsGesture';
        message = 'Press PLAY again to start audio.';
        publish();
        return;
      }
      const target = ensureDirector(audio);
      if (playing) {
        status = 'playing';
        publish();
        return;
      }
      arm(target);
      target.start();
      playing = true;
      if (suspended) target.pause();
      status = suspended ? 'paused' : 'playing';
      message = null;
      publish();
    },
    stop() {
      stopPlayback();
      publish();
    },
    setVolume(next) {
      volume = Math.min(1, Math.max(0, next));
      loaded?.backend.setVolume(volume);
      options.preferences.save({ ...options.preferences.load(), volume });
      publish();
    },
    setMuted(next) {
      muted = next;
      loaded?.backend.setMuted(muted);
      publish();
    },
    suspend() {
      if (suspended) return;
      suspended = true;
      if (playing && director) {
        director.pause();
        status = 'paused';
        publish();
      }
    },
    wake() {
      if (!suspended) return;
      suspended = false;
      if (playing && director) {
        director.resume();
        status = 'playing';
        publish();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      director?.dispose();
      director = null;
      loaded = null;
    },
  };
}

export type { MusicLibrary };
