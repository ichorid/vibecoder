<script lang="ts">
  /**
   * Design the next demo: three live previews of what it can grow into (the first is the
   * judge's own pick) and a MYSTERY that throws the lineage away for a brand-new form. The
   * previews are built from the next demo's real seed, so the picked one is exactly what gets
   * made. Variants are worked out a little per animation frame.
   */
  import { onMount } from 'svelte';
  import type { DemoOfferViewModel } from '../game/selectors';
  import { genomeFingerprint, type Genome } from '../demo/genome';
  import { MYSTERY, nextVariants, VARIANTS } from '../demo/judge';
  import { createDemoCanvas, DEMO_H, DEMO_W, drawDemo, type DemoCanvas } from '../demo/raster';

  interface Props {
    offer: DemoOfferViewModel;
    onPick: (pick: number | null) => void;
    reducedMotion?: boolean;
  }
  const { offer, onPick, reducedMotion = false }: Props = $props();

  const WORK_MS = 10;
  const LABELS = ['A', 'B', 'C'];

  let genomes = $state.raw<Genome[] | null>(null);
  const canvases: (HTMLCanvasElement | undefined)[] = $state([]);
  let mystery: HTMLCanvasElement | undefined = $state();
  /** The variant shown as chosen: the player's pick, or the judge's (A). */
  const chosen = $derived(offer.pick ?? 0);

  onMount(() => {
    const work = nextVariants(offer.steps, offer.seed);
    let pictures: DemoCanvas[] = [];
    let frame = 0;
    const started = performance.now();
    const contexts = new Map<HTMLCanvasElement, CanvasRenderingContext2D | null>();
    const contextOf = (c: HTMLCanvasElement) => {
      let ctx = contexts.get(c);
      if (ctx === undefined) {
        try {
          ctx = c.getContext('2d');
        } catch {
          ctx = null;
        }
        contexts.set(c, ctx);
      }
      return ctx;
    };
    const tick = (now: number) => {
      if (!genomes) {
        const until = performance.now() + WORK_MS;
        while (!genomes && performance.now() < until) {
          const step = work.next();
          if (step.done) {
            genomes = step.value.slice(0, VARIANTS).map((v) => v.genome);
            pictures = genomes.map((g) => createDemoCanvas(g));
          }
        }
      }
      const t = 3 + (reducedMotion ? 0 : (now - started) / 1000);
      pictures.forEach((picture, i) => {
        const target = canvases[i];
        const ctx = target ? contextOf(target) : null;
        drawDemo(picture, t, { trails: !reducedMotion });
        if (ctx) {
          const image = ctx.createImageData(DEMO_W, DEMO_H);
          image.data.set(new Uint8ClampedArray(picture.rgba.buffer));
          ctx.putImageData(image, 0, 0);
        }
      });
      // the mystery is static on an untuned screen
      const noise = mystery ? contextOf(mystery) : null;
      if (noise && mystery) {
        const image = noise.createImageData(mystery.width, mystery.height);
        for (let i = 0; i < image.data.length; i += 4) {
          const v = Math.random() * 160;
          image.data[i] = v;
          image.data[i + 1] = v;
          image.data[i + 2] = v + 30;
          image.data[i + 3] = 255;
        }
        noise.putImageData(image, 0, 0);
      }
      if (!reducedMotion || !genomes) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<section class="designer" aria-labelledby="designer-title" data-testid="demo-designer">
  <h3 id="designer-title">DESIGN DEMO #{offer.number}</h3>
  <p class="hint">What should it grow into? Your pick is what gets coded next.</p>
  <div class="options" role="radiogroup" aria-labelledby="designer-title">
    {#each LABELS as label, i (label)}
      {@const genome = genomes?.[i]}
      <button
        type="button"
        class="option"
        role="radio"
        aria-checked={chosen === i}
        aria-label="Variant {label}{i === 0 ? ' (the judge’s pick)' : ''}"
        data-testid="demo-variant-{i}"
        data-fingerprint={genome ? genomeFingerprint(genome) : ''}
        disabled={!genome}
        onclick={() => onPick(i)}
      >
        <canvas bind:this={canvases[i]} width={DEMO_W} height={DEMO_H} aria-hidden="true"></canvas>
        <span class="label">{label}{i === 0 ? ' ★' : ''}</span>
      </button>
    {/each}
    <button
      type="button"
      class="option mystery"
      role="radio"
      aria-checked={chosen === MYSTERY}
      aria-label="Mystery: something completely new"
      data-testid="demo-mystery"
      onclick={() => onPick(MYSTERY)}
    >
      <canvas bind:this={mystery} width="80" height="50" aria-hidden="true"></canvas>
      <span class="label">???</span>
    </button>
  </div>
  {#if !genomes}<p class="hint" data-testid="designer-thinking">The judge is thinking…</p>{/if}
</section>

<style>
  .designer {
    width: min(100%, 720px);
    color: #e8e3d0;
  }
  h3 {
    margin: 0;
    font-size: 13px;
    letter-spacing: 0.16em;
    color: #ffd166;
  }
  .hint {
    margin: 2px 0 6px;
    font-size: 11px;
    color: #9aa3d6;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 2px;
    border: 2px solid #2b2f45;
    background: #000;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .option[aria-checked='true'] {
    border-color: #ffd166;
    box-shadow: 0 0 10px rgba(255, 209, 102, 0.4);
  }
  .option:disabled {
    cursor: progress;
  }
  .option:focus-visible {
    outline: 3px solid #59b7ff;
    outline-offset: 1px;
  }
  canvas {
    width: 100%;
    aspect-ratio: 16 / 10;
    image-rendering: pixelated;
    display: block;
  }
  .label {
    font-size: 11px;
    font-weight: 800;
    text-align: center;
  }
</style>
