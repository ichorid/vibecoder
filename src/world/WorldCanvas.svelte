<script lang="ts">
  import { onMount } from 'svelte';
  import { createWorldHost, type RendererFactory, type WorldProjection } from './host';

  interface Props {
    world: WorldProjection;
    active: boolean;
    description: string;
    createRenderer?: RendererFactory;
  }

  const { world, active, description, createRenderer }: Props = $props();
  let element: HTMLDivElement | undefined = $state();

  /** Pixi loads in its own chunk after the DOM shell is interactive. */
  const lazyPixi: RendererFactory = async (parent) =>
    (await import('./renderer')).createPixiRenderer(parent);

  const host = createWorldHost((parent) => (createRenderer ?? lazyPixi)(parent));

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
