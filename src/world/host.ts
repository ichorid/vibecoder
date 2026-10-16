/** World presentation contracts and a renderer lifecycle independent of Pixi drawing. */
import type { WorldViewModel } from '../game/selectors';

/** Discovered-world projection plus presentation preferences. */
export interface WorldProjection extends WorldViewModel {
  readonly theme: 'light' | 'dark';
  readonly reducedMotion: boolean;
}

export interface RendererPort {
  resize(width: number, height: number): void;
  setActive(active: boolean): void;
  update(world: WorldProjection): void;
  destroy(): void;
}

export type RendererFactory = (parent: HTMLElement) => Promise<RendererPort>;

export interface WorldHost {
  mount(parent: HTMLElement): void;
  resize(width: number, height: number): void;
  setActive(active: boolean): void;
  update(world: WorldProjection): void;
  dispose(): void;
  failed(): boolean;
  readonly ready: Promise<void>;
}

/**
 * Owns one renderer for the application's lifetime: created once on first mount, kept alive
 * across view switches (only activity toggles), destroyed exactly once on dispose. Requests
 * made before the asynchronous renderer is ready are applied when it arrives.
 */
export function createWorldHost(factory: RendererFactory): WorldHost {
  let renderer: RendererPort | null = null;
  let started = false;
  let disposed = false;
  let destroyed = false;
  let failed = false;
  let size: { width: number; height: number } | null = null;
  let latest: WorldProjection | null = null;
  let active = false;
  let appliedActive: boolean | null = null;
  let markReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  const destroy = () => {
    if (destroyed || !renderer) return;
    destroyed = true;
    renderer.destroy();
  };

  const applyActive = () => {
    if (!renderer || disposed || appliedActive === active) return;
    appliedActive = active;
    renderer.setActive(active);
  };

  return {
    ready,
    mount(parent) {
      if (started) return;
      started = true;
      factory(parent).then(
        (created) => {
          renderer = created;
          if (disposed) {
            destroy();
          } else {
            if (size) created.resize(size.width, size.height);
            if (latest) created.update(latest);
            applyActive();
          }
          markReady();
        },
        () => {
          failed = true;
          markReady();
        },
      );
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
    dispose() {
      if (disposed) return;
      disposed = true;
      destroy();
    },
    failed: () => failed,
  };
}
