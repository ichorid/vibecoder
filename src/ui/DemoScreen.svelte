<script lang="ts">
  /**
   * A coded demo, demoscene style (docs/feature_demo.md): a "depacking" bar while the lineage
   * is replayed (one demo per animation frame), then the 160×100 picture scaled up with hard
   * pixels, the title card and a scroller. Reduced motion: one still frame, no scroller.
   */
  import { onMount } from 'svelte';
  import type { DemoViewModel } from '../game/selectors';
  import type { Genome } from '../demo/genome';
  import { lineage } from '../demo/judge';
  import { createDemoCanvas, DEMO_H, DEMO_W, drawDemo, type DemoCanvas } from '../demo/raster';

  interface Props {
    demo: DemoViewModel;
    reducedMotion: boolean;
    onClose: () => void;
  }

  const { demo, reducedMotion, onClose }: Props = $props();

  /** The intro is part of the joke: at least this long, even when nothing needs replaying. */
  const MIN_DEPACK_MS = 900;
  /** Lineage work per animation frame, so the page never stalls. */
  const WORK_MS = 10;

  let phase = $state<'depack' | 'play'>('depack');
  let progress = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();
  let close: HTMLButtonElement | undefined = $state();
  let skipIntro = false;

  const scrollText = $derived(
    [...demo.scroller, `Greetings to ${demo.greetings.join(', ')}.`].join('   ·   '),
  );

  onMount(() => {
    close?.focus();
    const replay = lineage(demo.seeds);
    let genome: Genome | null = null;
    let picture: DemoCanvas | null = null;
    let context: CanvasRenderingContext2D | null = null;
    let image: ImageData | null = null;
    let frame = 0;
    let playStart = 0;
    const opened = performance.now();

    function paint(t: number) {
      if (!picture) return;
      drawDemo(picture, t, { trails: !reducedMotion });
      if (context && image) {
        image.data.set(new Uint8ClampedArray(picture.rgba.buffer));
        context.putImageData(image, 0, 0);
      }
    }

    function start() {
      if (!genome) return;
      phase = 'play';
      picture = createDemoCanvas(genome);
      try {
        context = canvas?.getContext('2d') ?? null;
      } catch {
        context = null; // no 2D canvas (tests, very old browsers): the texts still show
      }
      image = context ? context.createImageData(DEMO_W, DEMO_H) : null;
      playStart = performance.now();
      paint(3);
    }

    function tick(now: number) {
      if (phase === 'depack') {
        const until = performance.now() + WORK_MS;
        while (!genome && performance.now() < until) {
          const step = replay.next();
          if (step.done) genome = step.value;
          else progress = step.value;
        }
        const shown = Math.min(1, (now - opened) / MIN_DEPACK_MS);
        progress = genome ? Math.max(progress, shown) : Math.min(progress, shown);
        if (genome && (skipIntro || reducedMotion || now - opened >= MIN_DEPACK_MS)) {
          start();
          if (reducedMotion) return;
        }
      } else if (!reducedMotion) {
        paint(3 + (now - playStart) / 1000);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }
</script>

<div
  class="demo-screen"
  role="dialog"
  aria-modal="true"
  aria-labelledby="demo-title"
  tabindex="-1"
  data-testid="demo-screen"
  data-phase={phase}
  onkeydown={keydown}
>
  <div class="crt">
    <canvas
      bind:this={canvas}
      class="picture"
      class:hidden={phase !== 'play'}
      width={DEMO_W}
      height={DEMO_H}
      aria-hidden="true"
    ></canvas>
    {#if phase === 'depack'}
      <button
        type="button"
        class="depack"
        data-testid="demo-depack"
        aria-label="Skip the intro"
        onclick={() => (skipIntro = true)}
      >
        <span class="depack-title">DEPACKING…</span>
        <span class="bar" aria-hidden="true"
          ><span class="bar-fill" style:width="{Math.round(progress * 100)}%"></span></span
        >
        <span class="depack-note">CRUNCHED BY VIBE CODER · {demo.seeds.length} GENERATIONS</span>
      </button>
    {/if}
  </div>
  <div class="card">
    <p class="presents">VIBE CODER PRESENTS · DEMO #{demo.number}</p>
    <h2 id="demo-title" data-testid="demo-title">{demo.title}</h2>
    <p class="group">by {demo.group}</p>
  </div>
  {#if reducedMotion}
    <p class="scroller still" data-testid="demo-scroller">{scrollText}</p>
  {:else}
    <div class="scroller" data-testid="demo-scroller">
      <span class="scroll-text" style:animation-duration="{Math.max(12, scrollText.length / 6)}s"
        >{scrollText}</span
      >
    </div>
  {/if}
  <button type="button" class="close" bind:this={close} onclick={onClose}>CLOSE</button>
</div>

<style>
  .demo-screen {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 12px max(12px, env(safe-area-inset-bottom));
    /* A CRT in a dark room, whatever the theme. */
    background: #05060c;
    color: #e8e3d0;
    font-family: ui-monospace, 'Cascadia Mono', 'DejaVu Sans Mono', monospace;
  }
  .crt {
    position: relative;
    width: min(100%, 720px, calc((100dvh - 200px) * 1.6));
    aspect-ratio: 16 / 10;
    border: 3px solid #2b2f45;
    background: #000;
    box-shadow: 0 0 40px rgba(120, 140, 255, 0.15);
  }
  .picture {
    width: 100%;
    height: 100%;
    display: block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  .picture.hidden {
    visibility: hidden;
  }
  .depack {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border: 0;
    background: #000;
    color: #8ff5c9;
    font: inherit;
    cursor: pointer;
  }
  .depack-title {
    font-size: 18px;
    letter-spacing: 0.2em;
  }
  .bar {
    width: 60%;
    height: 12px;
    border: 2px solid #8ff5c9;
  }
  .bar-fill {
    display: block;
    height: 100%;
    background: repeating-linear-gradient(90deg, #8ff5c9 0 6px, #2c7d41 6px 8px);
  }
  .depack-note {
    font-size: 11px;
    color: #4f8f74;
  }
  .card {
    text-align: center;
  }
  .presents {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.18em;
    color: #9aa3d6;
  }
  h2 {
    margin: 2px 0;
    font-size: clamp(20px, 5vw, 30px);
    letter-spacing: 0.06em;
    color: #ffd166;
    text-shadow: 2px 2px 0 #6c3a00;
  }
  .group {
    margin: 0;
    font-size: 13px;
    color: #59b7ff;
  }
  .scroller {
    width: min(100%, 720px);
    overflow: hidden;
    white-space: nowrap;
    font-size: 14px;
    color: #ff8fa3;
  }
  .scroller.still {
    white-space: normal;
    text-align: center;
    margin: 0;
  }
  .scroll-text {
    display: inline-block;
    padding-left: 100%;
    animation-name: scroll;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  @keyframes scroll {
    to {
      transform: translateX(-100%);
    }
  }
  .close {
    min-height: 44px;
    padding: 4px 18px;
    border: 2px solid #e8e3d0;
    background: #182046;
    color: #e8e3d0;
    font: inherit;
    font-weight: 800;
    letter-spacing: 0.12em;
    cursor: pointer;
  }
  .close:focus-visible,
  .depack:focus-visible {
    outline: 3px solid #ffd166;
    outline-offset: 2px;
  }
</style>
