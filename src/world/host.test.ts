import { describe, expect, it } from 'vitest';
import { createWorldHost, type RendererPort, type WorldProjection, type WorldTap } from './host';

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
  releases: 0,
  computeSlots: 0,
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

  it('on context loss reports a recovery pause; on restore rebuilds from the latest projection', async () => {
    const renderers: ReturnType<typeof contextRenderer>[] = [];
    const statuses: string[] = [];
    const host = createWorldHost(
      () => {
        const created = contextRenderer();
        renderers.push(created);
        return Promise.resolve(created.port);
      },
      { onStatus: (status) => statuses.push(status) },
    );
    host.mount({} as HTMLElement);
    host.resize(320, 200);
    host.setActive(true);
    host.update({ ...world, technologyIds: ['autocomplete'] });
    await host.ready;
    renderers[0]?.emit('lost');
    expect(statuses).toEqual(['lost']);
    host.update({ ...world, technologyIds: ['autocomplete', 'generated-snippets'] });
    renderers[0]?.emit('restored');
    await host.recovered();
    expect(statuses).toEqual(['lost', 'ok']);
    expect(renderers).toHaveLength(2);
    expect(renderers[0]?.calls.at(-1)).toBe('destroy');
    expect(renderers[1]?.calls).toEqual(['resize 320x200', 'update 2', 'active true']);
  });

  it('a failed rebuild stays paused with retry; retry cleans up and tries again', async () => {
    let attempt = 0;
    const statuses: string[] = [];
    const first = contextRenderer();
    const host = createWorldHost(
      () => {
        attempt += 1;
        if (attempt === 1) return Promise.resolve(first.port);
        if (attempt === 2) return Promise.reject(new Error('no GPU'));
        return Promise.resolve(contextRenderer().port);
      },
      { onStatus: (status) => statuses.push(status) },
    );
    host.mount({} as HTMLElement);
    await host.ready;
    first.emit('lost');
    first.emit('restored');
    await host.recovered();
    expect(statuses).toEqual(['lost', 'failed']);
    host.retry();
    await host.recovered();
    expect(statuses).toEqual(['lost', 'failed', 'ok']);
    expect(first.listeners()).toBe(0);
  });
});

describe('world taps', () => {
  it('forwards taps on the cat, the bowl and the poster with their position', async () => {
    const bus: { emit: ((tap: WorldTap) => void) | null } = { emit: null };
    const taps: string[] = [];
    const host = createWorldHost(
      () =>
        Promise.resolve({
          ...fakeRenderer().port,
          onTap(listener: (tap: WorldTap) => void) {
            bus.emit = listener;
            return () => (bus.emit = null);
          },
        }),
      { onTap: (tap) => taps.push(`${tap.target}@${tap.x},${tap.y}`) },
    );
    host.mount({} as HTMLElement);
    await host.ready;
    bus.emit?.({ target: 'poster', x: 10, y: 20 });
    bus.emit?.({ target: 'bowl', x: 1, y: 2 });
    const stale = bus.emit;
    host.dispose();
    stale?.({ target: 'cat', x: 3, y: 4 });
    expect(taps).toEqual(['poster@10,20', 'bowl@1,2']);
  });
});

function contextRenderer() {
  const fake = fakeRenderer();
  const listeners = new Set<(event: 'lost' | 'restored') => void>();
  const port: RendererPort = {
    ...fake.port,
    onContext(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    port,
    calls: fake.calls,
    emit: (event: 'lost' | 'restored') => {
      for (const l of [...listeners]) l(event);
    },
    listeners: () => listeners.size,
  };
}
