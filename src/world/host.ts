/** World presentation contracts and a renderer lifecycle independent of Pixi drawing. */
import type { WorldViewModel } from '../game/selectors';

/** Discovered-world projection plus presentation preferences. */
export interface WorldProjection extends WorldViewModel {
  readonly theme: 'light' | 'dark';
  readonly reducedMotion: boolean;
}

/** A tap on an interactive world object; x/y in CSS pixels relative to the world canvas. */
export interface WorldTap {
  readonly target: 'cat' | 'bowl' | 'poster' | 'shelf' | 'window' | 'monitor' | 'plant';
  readonly x: number;
  readonly y: number;
}

export interface RendererPort {
  resize(width: number, height: number): void;
  setActive(active: boolean): void;
  update(world: WorldProjection): void;
  destroy(): void;
  /** Graphics context lost/restored (WebGL); returns an unsubscribe function. */
  onContext?(listener: (event: 'lost' | 'restored') => void): () => void;
  /** Taps on the world cat, the cat bowl and the poster; returns an unsubscribe function. */
  onTap?(listener: (tap: WorldTap) => void): () => void;
  /** The player zoomed or panned away from the automatic framing (true) or back (false). */
  onView?(listener: (adjusted: boolean) => void): () => void;
  /** Fit the whole scene again (drops the player's zoom and pan). */
  resetView?(): void;
}

export type RendererFactory = (parent: HTMLElement) => Promise<RendererPort>;

/** ok: drawing; lost: context gone (the app pauses the game); failed: rebuild failed (retry). */
export type WorldStatus = 'ok' | 'lost' | 'failed';

export interface WorldHostOptions {
  readonly onStatus?: (status: WorldStatus) => void;
  readonly onTap?: (tap: WorldTap) => void;
  readonly onView?: (adjusted: boolean) => void;
}

export interface WorldHost {
  mount(parent: HTMLElement): void;
  resize(width: number, height: number): void;
  setActive(active: boolean): void;
  update(world: WorldProjection): void;
  dispose(): void;
  failed(): boolean;
  /** After a loss: rebuild the renderer now (also used after a failed rebuild). */
  retry(): void;
  /** Fit the whole scene again after the player zoomed or panned. */
  resetView(): void;
  readonly ready: Promise<void>;
  /** Resolves when the current recovery attempt finished (tests and UI). */
  recovered(): Promise<void>;
}

/**
 * Owns one renderer at a time: created on first mount, kept alive across view switches (only
 * activity toggles), destroyed exactly once on dispose. Requests made before the asynchronous
 * renderer is ready are applied when it arrives. When the graphics context is lost the host
 * reports `lost`; on restore (or an explicit retry) it destroys the old renderer and builds a
 * new one from the latest projection with the same scene builder — never a separate algorithm.
 */
export function createWorldHost(
  factory: RendererFactory,
  options: WorldHostOptions = {},
): WorldHost {
  let renderer: RendererPort | null = null;
  let parentElement: HTMLElement | null = null;
  let started = false;
  let disposed = false;
  let failed = false;
  let size: { width: number; height: number } | null = null;
  let latest: WorldProjection | null = null;
  let active = false;
  let appliedActive: boolean | null = null;
  let unsubscribe: () => void = () => {};
  let recovery: Promise<void> = Promise.resolve();
  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  const status = (next: WorldStatus) => options.onStatus?.(next);

  function release(): void {
    unsubscribe();
    unsubscribe = () => {};
    const old = renderer;
    renderer = null;
    appliedActive = null;
    old?.destroy();
  }

  const applyActive = () => {
    if (!renderer || disposed || appliedActive === active) return;
    appliedActive = active;
    renderer.setActive(active);
  };

  function attach(created: RendererPort): void {
    renderer = created;
    const offContext =
      created.onContext?.((event) => {
        if (event === 'lost') status('lost');
        else rebuild();
      }) ?? (() => {});
    const offTap =
      created.onTap?.((tap) => {
        if (!disposed) options.onTap?.(tap);
      }) ?? (() => {});
    const offView =
      created.onView?.((adjusted) => {
        if (!disposed) options.onView?.(adjusted);
      }) ?? (() => {});
    unsubscribe = () => {
      offContext();
      offTap();
      offView();
    };
    if (size) created.resize(size.width, size.height);
    if (latest) created.update(latest);
    applyActive();
  }

  function create(): Promise<boolean> {
    if (!parentElement) return Promise.resolve(false);
    return factory(parentElement).then(
      (created) => {
        if (disposed) {
          created.destroy();
          return false;
        }
        attach(created);
        return true;
      },
      () => false,
    );
  }

  function rebuild(): void {
    if (disposed) return;
    release();
    recovery = create().then((ok) => {
      failed = !ok;
      if (!disposed) status(ok ? 'ok' : 'failed');
    });
  }

  return {
    ready,
    recovered: () => recovery,
    mount(parent) {
      if (started) return;
      started = true;
      parentElement = parent;
      void create().then((ok) => {
        if (!ok && !disposed) failed = true;
        markReady();
      });
    },
    resize(width, height) {
      size = { width, height };
      if (renderer && !disposed) renderer.resize(width, height);
    },
    setActive(next) {
      active = next;
      applyActive();
    },
    update(world) {
      latest = world;
      if (renderer && !disposed) renderer.update(world);
    },
    retry: () => rebuild(),
    resetView: () => renderer?.resetView?.(),
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
    },
    failed: () => failed,
  };
}
