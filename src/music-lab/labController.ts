/**
 * Music Lab controller: four audition modes over ONE director and one backend per document.
 * Tone is loaded only on the first PLAY (a user gesture). Every mode is data fed to the same
 * director; mode drivers advance on its audio-clock commits, never on browser timers.
 *
 * Reviews bind to exact versions (id@revision#sha256 of the canonical payload). Random's
 * approved bank is rebuilt from current, non-stale approvals and swapped in at the next safe
 * boundary. Local candidates (imported JSON) join the catalog through the same validators.
 */
import type { MusicBackendPort } from '../music/backend/port';
import { buildCatalog, type MusicCatalog, type MusicSources } from '../music/core/catalog';
import { DEFAULT_BOUNDARY_RULES, pairAllowed } from '../music/core/compatibility';
import { analyzePattern, type NormalizedPattern } from '../music/core/validation';
import type { PatternDocument } from '../music/data/patterns.generated';
import {
  createDirector,
  type MusicDirector,
  type MusicRequest,
  type PhraseInfo,
} from '../music/director';
import { contentHash } from '../music/hash';
import { createLibrary, patternKey, type MusicLibrary } from '../music/library';
import type { AudioPreferenceStore } from '../music/preferences';
import { EVOLUTION_TIMELINE, createTimelineDriver, planTimeline } from '../music/previewTimeline';
import patternSchema from '../../music/PATTERN_SCHEMA.json';
import { importCandidateText, type CandidateReport, type CandidateStore } from './candidates';
import { formatFeedbackPrompt } from './feedback';
import type { ReviewStore } from './reviewStore';
import {
  approvedKeys,
  decide as decideReview,
  decodeReviewEnvelope,
  emptyBook,
  encodeReviewEnvelope,
  exactKey,
  mergeImport,
  resolveConflict as resolveReviewConflict,
  reviewFor,
  type Result,
  type ReviewBook,
  type ReviewConflict,
  type ReviewStatus,
  type ReviewView,
} from './reviews';

export type LabMode = 'single' | 'random' | 'transition' | 'evolution';
export type LabStatus = 'idle' | 'loading' | 'needsGesture' | 'playing' | 'paused' | 'error';

export interface LabEntry {
  readonly key: string;
  readonly id: string;
  readonly revision: number;
  readonly eraId: string;
  readonly demo: boolean;
  /** Imported in this browser (not part of the installed catalog). */
  readonly local: boolean;
  readonly playable: boolean;
  readonly bpm: number | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  /** SHA-256 of the canonical payload; null until computed (or unavailable). */
  readonly hash: string | null;
  readonly review: ReviewView | null;
  /** Unsaved feedback text (or the saved feedback when there is no draft). */
  readonly draft: string;
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
  readonly reviews: {
    /** Hashes computed: reviews can be recorded. */
    readonly ready: boolean;
    readonly error: string | null;
    readonly conflicts: readonly ReviewConflict[];
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
  readonly reviews?: ReviewStore;
  readonly candidates?: CandidateStore;
  readonly hash?: (pattern: PatternDocument, catalog: MusicCatalog) => Promise<string>;
  readonly now?: () => string;
}

export interface LabController {
  state(): LabState;
  /** Resolves once content hashes for the current catalog are known. */
  ready(): Promise<void>;
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
  rate(key: string, rating: number | null): void;
  setDraft(key: string, text: string): void;
  /** APPROVE / REVISE / REJECT (or back to unreviewed); saves the current feedback draft. */
  decide(key: string, status: ReviewStatus): void;
  exportReviews(): string;
  /** The composer prompt for one era: its revise/rejected versions plus approved metadata. */
  feedbackPrompt(eraId: string): Result<string>;
  importReviews(text: string): void;
  resolveConflict(key: string, choice: 'keep-local' | 'use-import'): void;
  /** Discard unreadable stored reviews (explicit reviewer action). */
  resetReviews(): void;
  importCandidates(text: string, fileName: string): CandidateReport;
  /** Editable JSON of any installed or local version. */
  exportPattern(key: string): string | null;
  removeCandidate(key: string): void;
  /** Document hidden/visible: silence immediately, resume without catch-up. */
  suspend(): void;
  wake(): void;
  dispose(): void;
}

const PPQ = 192;

type BaseEntry = Omit<LabEntry, 'hash' | 'review' | 'draft'>;

function describeEntries(catalog: MusicCatalog, localKeys: ReadonlySet<string>): BaseEntry[] {
  return catalog.patterns
    .map((document) => {
      const { normalized, diagnostics } = analyzePattern(document, catalog);
      const key = patternKey(document);
      return {
        key,
        id: document.id,
        revision: document.revision,
        eraId: document.eraId,
        demo: document.demo,
        local: localKeys.has(key),
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

const keyOfRaw = (value: unknown) => {
  const v = value as { id?: unknown; revision?: unknown };
  return `${String(v.id)}@${String(v.revision)}`;
};

export function createLabController(options: LabControllerOptions): LabController {
  const hashOf = options.hash ?? contentHash;
  const nowIso = options.now ?? (() => new Date().toISOString());
  const prefs = options.preferences.load();
  const storedReviews = options.reviews?.load() ?? { book: emptyBook(), error: null };
  const storedCandidates = options.candidates?.load() ?? { patterns: [], error: null };

  let localPatterns: unknown[] = storedCandidates.patterns;
  let book: ReviewBook = storedReviews.book;
  let reviewError: string | null = storedReviews.error ?? storedCandidates.error;
  let hashes = new Map<string, string>();
  let hashesReady = false;
  let conflicts: ReviewConflict[] = [];

  // Catalog-derived state, rebuilt when local candidates change.
  let catalog: MusicCatalog;
  let entries: BaseEntry[] = [];
  let catalogErrors: string[] = [];
  let libraries: Record<'all' | 'approved' | 'demo' | 'evolution', MusicLibrary>;
  let orderedEras: { id: string; title: string }[] = [];
  let evolutionPlan: ReturnType<typeof planTimeline>;
  let readyPromise: Promise<void> = Promise.resolve();

  const progression = EVOLUTION_TIMELINE.map((stage) => stage.era);
  const rank = (id: string) => {
    const index = progression.indexOf(id);
    return index < 0 ? progression.length : index;
  };

  function rebuild(): void {
    const built = buildCatalog({
      ...options.sources,
      patterns: [...options.sources.patterns, ...localPatterns],
    });
    catalog = built.catalog;
    entries = describeEntries(catalog, new Set(localPatterns.map(keyOfRaw)));
    catalogErrors = built.diagnostics
      .filter((d) => d.level === 'error' && !entries.some((e) => d.source.includes(e.key)))
      .map((d) => d.message);
    libraries = {
      all: createLibrary(catalog, { candidates: 'all' }),
      approved: createLibrary(catalog, {
        candidates: 'approved',
        approved: approvedKeys(book, hashes),
      }),
      demo: createLibrary(catalog, { candidates: 'demo' }),
      evolution: createLibrary(catalog, { candidates: 'demo', demoFallback: true }),
    };
    orderedEras = [...catalog.eras.values()]
      .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
      .map((e) => ({ id: e.id, title: e.title }));
    evolutionPlan = planTimeline(EVOLUTION_TIMELINE, libraries.evolution, PPQ);
  }
  rebuild();
  const firstEra = () => orderedEras[0]?.id ?? 'discovery';

  let mode: LabMode = 'single';
  let status: LabStatus = 'idle';
  let message: string | null = null;
  let now: PhraseInfo | null = null;
  let selected: string | null = entries.find((e) => e.playable)?.key ?? null;
  let tempoOverride: number | null = null;
  let randomEra = firstEra();
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
  const modeLibrary = () =>
    mode === 'random'
      ? randomLibrary()
      : mode === 'evolution'
        ? libraries.evolution
        : libraries.all;

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

  function versionOf(entry: BaseEntry) {
    const contentHash = hashes.get(entry.key);
    return contentHash ? { patternId: entry.id, revision: entry.revision, contentHash } : null;
  }

  function project(entry: BaseEntry): LabEntry {
    const version = versionOf(entry);
    const review = version ? reviewFor(book, version) : null;
    const draft = version ? book.drafts.get(exactKey(version)) : undefined;
    return {
      ...entry,
      hash: version?.contentHash ?? null,
      review,
      draft: draft ?? review?.feedback ?? '',
    };
  }

  const snapshot = (): LabState => {
    const projected = entries.map(project);
    const isDemo = (key: string | null) => projected.find((e) => e.key === key)?.demo ?? false;
    return {
      mode,
      status,
      message,
      eras: orderedEras,
      entries: projected,
      catalogErrors,
      now,
      demoPlayback:
        mode === 'evolution' ||
        (mode === 'random' && includeDemo) ||
        (mode === 'single' && isDemo(selected)) ||
        (mode === 'transition' && (isDemo(transitionA) || isDemo(transitionB))),
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
      reviews: { ready: hashesReady, error: reviewError, conflicts },
      volume,
      muted,
    };
  };
  const publish = () => options.onState(snapshot());

  function rehash(): void {
    const target = catalog;
    hashesReady = false;
    readyPromise = Promise.all(
      target.patterns.map(async (p) => [patternKey(p), await hashOf(p, target)] as const),
    ).then(
      (pairs) => {
        if (target !== catalog || disposed) return;
        hashes = new Map(pairs);
        hashesReady = true;
        refreshApproved();
        publish();
      },
      (error: unknown) => {
        reviewError = error instanceof Error ? error.message : String(error);
        publish();
      },
    );
  }

  /** Rebuild the approved bank; a playing Random sequence picks it up at the next boundary. */
  function refreshApproved(): void {
    libraries = {
      ...libraries,
      approved: createLibrary(catalog, {
        candidates: 'approved',
        approved: approvedKeys(book, hashes),
      }),
    };
    if (playing && director && mode === 'random' && !includeDemo) {
      director.setLibrary(libraries.approved);
    }
  }

  function persistReviews(): void {
    if (!options.reviews) return;
    const saved = options.reviews.save(book);
    reviewError = saved.ok ? null : saved.error;
  }

  function pinRequest(key: string): MusicRequest {
    const entry = libraries.all.pattern(key);
    const era = entry ? catalog.eras.get(entry.eraId) : undefined;
    return {
      era: entry?.eraId ?? firstEra(),
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

  /** Local candidates changed: rebuild the catalog; playback continues on the new library. */
  function candidatesChanged(): void {
    rebuild();
    rehash();
    if (playing && director) {
      if (blocker()) stopPlayback();
      else director.setLibrary(modeLibrary());
    }
  }

  function withEntry(
    key: string,
    action: (entry: BaseEntry, version: NonNullable<ReturnType<typeof versionOf>>) => void,
  ) {
    const entry = entries.find((e) => e.key === key);
    const version = entry ? versionOf(entry) : null;
    if (!entry || !version) {
      message = hashesReady ? `Unknown version ${key}.` : 'Reviews are not ready yet.';
      publish();
      return;
    }
    action(entry, version);
  }

  rehash();
  publish();

  return {
    state: snapshot,
    ready: () => readyPromise,
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
    rate(key, rating) {
      withEntry(key, (entry, version) => {
        const result = decideReview(book, version, { rating }, nowIso(), entry.playable);
        if (!result.ok) message = result.error;
        else {
          book = result.value;
          persistReviews();
        }
        publish();
      });
    },
    setDraft(key, text) {
      withEntry(key, (_entry, version) => {
        book = { records: book.records, drafts: new Map(book.drafts).set(exactKey(version), text) };
        persistReviews();
        publish();
      });
    },
    decide(key, decision) {
      withEntry(key, (entry, version) => {
        const draft = book.drafts.get(exactKey(version));
        const result = decideReview(
          book,
          version,
          { status: decision, ...(draft !== undefined ? { feedback: draft } : {}) },
          nowIso(),
          entry.playable,
        );
        if (!result.ok) message = result.error;
        else {
          book = result.value;
          message = null;
          persistReviews();
          refreshApproved();
        }
        publish();
      });
    },
    exportReviews: () => encodeReviewEnvelope(book),
    feedbackPrompt(eraId) {
      if (!hashesReady) return { ok: false, error: 'Reviews are not ready yet.' };
      const inEra = entries.filter((e) => e.eraId === eraId);
      const approved = [];
      const requested = [];
      for (const entry of inEra) {
        const version = versionOf(entry);
        const pattern = catalog.patterns.find(
          (p) => p.id === entry.id && p.revision === entry.revision,
        );
        if (!version || !pattern) continue;
        const review = reviewFor(book, version);
        if (review.status === 'approved') {
          approved.push({ key: entry.key, hash: version.contentHash, rating: review.rating });
        } else if (review.status === 'revise' || review.status === 'rejected') {
          requested.push({
            pattern,
            hash: version.contentHash,
            review: {
              status: review.status,
              rating: review.rating,
              ...(review.feedback ? { feedback: review.feedback } : {}),
            },
          });
        }
      }
      return formatFeedbackPrompt({
        eraId,
        catalog,
        schemaText: JSON.stringify(patternSchema, null, 2),
        approved,
        requested,
      });
    },
    importReviews(text) {
      const decoded = decodeReviewEnvelope(text);
      if (!decoded.ok) {
        message = `Reviews not imported: ${decoded.error}`;
        publish();
        return;
      }
      const merged = mergeImport(book, decoded.value);
      book = merged.book;
      conflicts = [
        ...conflicts.filter((c) => !merged.conflicts.some((m) => m.key === c.key)),
        ...merged.conflicts,
      ];
      persistReviews();
      refreshApproved();
      message = `Reviews imported: ${merged.added} added, ${merged.identical} already present, ${merged.conflicts.length} conflict(s) to resolve.`;
      publish();
    },
    resolveConflict(key, choice) {
      const conflict = conflicts.find((c) => c.key === key);
      if (!conflict) return;
      book = resolveReviewConflict(book, conflict, choice);
      conflicts = conflicts.filter((c) => c !== conflict);
      persistReviews();
      refreshApproved();
      publish();
    },
    resetReviews() {
      options.reviews?.reset();
      book = emptyBook();
      conflicts = [];
      reviewError = null;
      refreshApproved();
      publish();
    },
    importCandidates(text, fileName) {
      const result = importCandidateText(text, fileName, options.sources, localPatterns);
      if (result.report.added.length > 0) {
        const saved = options.candidates?.save(result.candidates) ?? { ok: true as const };
        if (!saved.ok) {
          message = `Candidates not imported: ${saved.error}`;
          publish();
          return { ...result.report, added: [] };
        }
        localPatterns = result.candidates;
        candidatesChanged();
      }
      const r = result.report;
      const parts = [
        r.added.length > 0 ? `added ${r.added.join(', ')}` : '',
        r.identical.length > 0 ? `already present ${r.identical.join(', ')}` : '',
        ...r.conflicts.map((c) => `conflict ${c.key}: ${c.reason}`),
        ...r.rejected.map((x) => `rejected ${x.key ?? x.file}: ${x.problems.join('; ')}`),
      ].filter(Boolean);
      message = `Import ${fileName}: ${parts.join(' · ') || 'nothing to import'}`;
      publish();
      return r;
    },
    exportPattern(key) {
      const raw = [...localPatterns, ...options.sources.patterns].find((p) => keyOfRaw(p) === key);
      return raw === undefined ? null : `${JSON.stringify(raw, null, 2)}\n`;
    },
    removeCandidate(key) {
      const next = localPatterns.filter((p) => keyOfRaw(p) !== key);
      if (next.length === localPatterns.length) return;
      const saved = options.candidates?.save(next) ?? { ok: true as const };
      if (!saved.ok) {
        message = saved.error;
        publish();
        return;
      }
      localPatterns = next;
      if (selected === key) selected = null;
      candidatesChanged();
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
