<script lang="ts">
  import { onMount } from 'svelte';
  import FloatingGains from '../ui/FloatingGains.svelte';
  import { MAX_FLOATING, type FloatingGain } from '../ui/floatingGains';
  import {
    createWorldHost,
    type RendererFactory,
    type WorldProjection,
    type WorldStatus,
    type WorldTap,
  } from './host';

  interface Props {
    world: WorldProjection;
    active: boolean;
    description: string;
    atlasUrl: (theme: 'light' | 'dark') => string;
    createRenderer?: RendererFactory;
    /** Graphics context lost/back/failed: the app pauses the game while the world is gone. */
    onStatus?: (status: WorldStatus) => void;
    /** Receives the retry action once the host exists. */
    onRetryReady?: (retry: () => void) => void;
    /** A tap on the cat, the bowl or the poster; returns the text to float up (or null). */
    onWorldTap?: (tap: WorldTap) => string | null;
  }

  const {
    world,
    active,
    description,
    atlasUrl,
    createRenderer,
    onStatus,
    onRetryReady,
    onWorldTap,
  }: Props = $props();

  let floats = $state<FloatingGain[]>([]);
  let nextFloat = 0;
  function onTap(tap: WorldTap) {
    const text = onWorldTap?.(tap) ?? null;
    if (!text || !element) return;
    const { clientWidth: w, clientHeight: h } = element;
    nextFloat += 1;
    floats = [
      ...floats.slice(-(MAX_FLOATING - 1)),
      {
        id: nextFloat,
        text,
        x: w > 0 ? tap.x / w : 0.5,
        y: h > 0 ? Math.max(0, tap.y - 28) / h : 0,
      },
    ];
  }
  let element: HTMLDivElement | undefined = $state();

  /** Pixi loads in its own chunk after the DOM shell is interactive. */
  const lazyPixi: RendererFactory = async (parent) =>
    (await import('./renderer')).createPixiRenderer(parent, { atlasUrl });

  const host = createWorldHost((parent) => (createRenderer ?? lazyPixi)(parent), {
    onStatus: (status) => onStatus?.(status),
    onTap: (tap) => onTap(tap),
  });
  $effect(() => {
    onRetryReady?.(() => host.retry());
  });

  onMount(() => {
    if (!element) return;
    const target = element;
    host.mount(target);
    const measure = () => host.resize(target.clientWidth, target.clientHeight);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(target);
    measure();
    return () => {
      observer?.disconnect();
      host.dispose();
    };
  });

  $effect(() => {
    host.setActive(active);
  });

  $effect(() => {
    host.update(world);
  });
</script>

<div class="world-canvas" bind:this={element}>
  <p class="visually-hidden">{description}</p>
  <FloatingGains gains={floats} onDone={(id) => (floats = floats.filter((f) => f.id !== id))} />
</div>

<style>
  .world-canvas {
    position: absolute;
    inset: 0;
  }
  .world-canvas :global(canvas) {
    display: block;
    image-rendering: pixelated;
  }
</style>
