<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createWorldHost,
    type RendererFactory,
    type WorldProjection,
    type WorldStatus,
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
  }

  const { world, active, description, atlasUrl, createRenderer, onStatus, onRetryReady }: Props =
    $props();
  let element: HTMLDivElement | undefined = $state();

  /** Pixi loads in its own chunk after the DOM shell is interactive. */
  const lazyPixi: RendererFactory = async (parent) =>
    (await import('./renderer')).createPixiRenderer(parent, { atlasUrl });

  const host = createWorldHost((parent) => (createRenderer ?? lazyPixi)(parent), {
    onStatus: (status) => onStatus?.(status),
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
