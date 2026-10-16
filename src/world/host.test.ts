import { describe, expect, it } from 'vitest';
import { createWorldHost, type RendererPort, type WorldProjection } from './host';

function fakeRenderer() {
  const calls: string[] = [];
  const port: RendererPort = {
    resize: (w, h) => calls.push(`resize ${w}x${h}`),
    setActive: (active) => calls.push(`active ${active}`),
    update: (world) => calls.push(`update ${world.technologyIds.length}`),
    destroy: () => calls.push('destroy'),
  };
  return { port, calls };
}

const world: WorldProjection = {
  technologyIds: [],
  pendingRevealId: null,
  cat: { alive: true, presentation: 'normal', round: false },
  theme: 'light',
  reducedMotion: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('world host lifecycle', () => {
  it('applies state requested before the renderer is ready', async () => {
    const fake = fakeRenderer();
    const ready = deferred<RendererPort>();
    const host = createWorldHost(() => ready.promise);
    host.mount({} as HTMLElement);
    host.resize(300, 200);
    host.setActive(true);
    host.update(world);
    ready.resolve(fake.port);
    await host.ready;
    expect(fake.calls).toEqual(['resize 300x200', 'update 0', 'active true']);
  });

  it('destroys exactly once even when disposed twice or before readiness', async () => {
    const fake = fakeRenderer();
    const ready = deferred<RendererPort>();
    const host = createWorldHost(() => ready.promise);
    host.mount({} as HTMLElement);
    host.dispose();
    host.dispose();
    ready.resolve(fake.port);
    await host.ready;
    expect(fake.calls.filter((c) => c === 'destroy')).toHaveLength(1);
    expect(fake.calls).toEqual(['destroy']);
  });

  it('creates the renderer once across repeated mount calls', async () => {
    let created = 0;
    const fake = fakeRenderer();
    const host = createWorldHost(() => {
      created += 1;
      return Promise.resolve(fake.port);
    });
    host.mount({} as HTMLElement);
    host.mount({} as HTMLElement);
    await host.ready;
    expect(created).toBe(1);
  });

  it('pauses and resumes presentation without recreating it', async () => {
    const fake = fakeRenderer();
    const host = createWorldHost(() => Promise.resolve(fake.port));
    host.mount({} as HTMLElement);
    await host.ready;
    host.setActive(false);
    host.setActive(true);
    host.setActive(true);
    expect(fake.calls).toEqual(['active false', 'active true']);
  });

  it('reports a failed renderer without throwing', async () => {
    const host = createWorldHost(() => Promise.reject(new Error('no webgl')));
    host.mount({} as HTMLElement);
    await host.ready;
    expect(host.failed()).toBe(true);
  });
});
