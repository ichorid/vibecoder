<script lang="ts">
  /**
   * Dev server only (Settings → Demo lab): look at the demo generator and tune the judge.
   * Seed / family / RANDOM / MUTATE / BACK; a 3×3 grid of the judge's candidate children with
   * their scores (★ = the judge's pick) — picking one continues from it and counts whether you
   * agreed with the judge; overrides for palette, style, backdrop and trails; pause and a time
   * slider; the genome as horn-script text; frame statistics.
   */
  import { onMount } from 'svelte';
  import type { DemoViewModel } from '../game/selectors';
  import { hornScript } from '../demo/emit';
  import {
    instanceBound,
    randomGenome,
    TENDRILS,
    type Genome,
    type TendrilKind,
  } from '../demo/genome';
  import {
    candidates,
    firstDemo,
    genomeOf,
    judge,
    nextDemo,
    pickScore,
    type Candidate,
    type Judged,
  } from '../demo/judge';
  import { PALETTE_NAMES } from '../demo/palettes';
  import { createDemoCanvas, DEMO_H, DEMO_W, drawDemo, type DemoCanvas } from '../demo/raster';

  interface Props {
    demos: readonly DemoViewModel[];
    onClose: () => void;
  }
  const { demos, onClose }: Props = $props();

  const PICKS_KEY = 'vibe-coder.demo-lab.picks';

  let seed = $state(1);
  let family = $state<'any' | TendrilKind>('any');
  let current = $state.raw<Judged>(firstDemo(1));
  let back = $state.raw<Judged[]>([]);
  let childSeed = $state(1);
  let kids = $state.raw<Candidate[]>([]);
  let paused = $state(false);
  let time = $state(3);
  let msPerFrame = $state(0);
  let instances = $state(0);
  let agreed = $state(0);
  let picks = $state(0);
  let main: HTMLCanvasElement | undefined = $state();
  const small: (HTMLCanvasElement | undefined)[] = $state([]);

  const ancestors = $derived(back.slice(-3).map((j) => j.verdict.masks));
  const judgePick = $derived(
    kids.length === 0
      ? -1
      : kids.reduce((best, c, i, all) => {
          const top = all[best];
          return top && pickScore(current, c) > pickScore(current, top) ? i : best;
        }, 0),
  );
  const script = $derived(hornScript(current.genome));
  const parts = $derived(current.verdict.parts);

  function show(next: Judged, remember = true) {
    if (remember) back = [...back, current];
    current = next;
    refreshKids();
  }
  function refreshKids() {
    kids = candidates(current, childSeed, ancestors, 9);
  }
  function newForm() {
    const genome = family === 'any' ? firstDemo(seed).genome : randomGenome(seed, family);
    show({ genome, verdict: judge(genome) });
  }
  function randomSeed() {
    seed = Math.floor(Math.random() * 1e9);
    newForm();
  }
  function mutateOnce() {
    childSeed += 1;
    show(nextDemo(current, childSeed, ancestors));
  }
  function goBack() {
    const previous = back.at(-1);
    if (!previous) return;
    back = back.slice(0, -1);
    current = previous;
    refreshKids();
  }
  function loadRun(number: number) {
    const demo = demos.find((d) => d.number === number);
    if (!demo) return;
    const genome = genomeOf(demo.seeds);
    show({ genome, verdict: judge(genome) });
  }
  function pick(i: number) {
    const kid = kids[i];
    if (!kid) return;
    picks += 1;
    if (i === judgePick) agreed += 1;
    try {
      const log = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]') as unknown[];
      log.push({
        picked: i,
        judge: judgePick,
        scores: kids.map((k) => Number(pickScore(current, k).toFixed(3))),
        parts: kids.map((k) => k.verdict.parts),
      });
      localStorage.setItem(PICKS_KEY, JSON.stringify(log.slice(-500)));
    } catch {
      // storage blocked: the counter still works
    }
    childSeed += 1;
    show(kid);
  }
  function copyLog() {
    try {
      void navigator.clipboard?.writeText(localStorage.getItem(PICKS_KEY) ?? '[]');
    } catch {
      // nothing to copy
    }
  }
  function override(change: Partial<Genome>) {
    current = { genome: { ...current.genome, ...change }, verdict: current.verdict };
  }

  onMount(() => {
    let frame = 0;
    let shownGenome: Genome | null = null;
    let picture: DemoCanvas | null = null;
    const kidPictures = new Map<Genome, DemoCanvas>();
    let t = time;
    let last = performance.now();
    const contexts = new Map<HTMLCanvasElement, CanvasRenderingContext2D | null>();
    const image = new ImageData(DEMO_W, DEMO_H);
    const blit = (target: HTMLCanvasElement | undefined, canvas: DemoCanvas) => {
      if (!target) return;
      let ctx = contexts.get(target);
      if (ctx === undefined) {
        ctx = target.getContext('2d');
        contexts.set(target, ctx);
      }
      image.data.set(new Uint8ClampedArray(canvas.rgba.buffer));
      ctx?.putImageData(image, 0, 0);
    };
    const tick = (now: number) => {
      if (!paused) t += (now - last) / 1000;
      else t = time;
      if (!paused) time = Math.round((t % 30) * 10) / 10;
      last = now;
      if (shownGenome !== current.genome) {
        shownGenome = current.genome;
        picture = createDemoCanvas(current.genome);
      }
      if (picture) {
        const start = performance.now();
        drawDemo(picture, t);
        msPerFrame = msPerFrame * 0.9 + (performance.now() - start) * 0.1;
        instances = instanceBound(current.genome);
        blit(main, picture);
      }
      kids.forEach((kid, i) => {
        let canvas = kidPictures.get(kid.genome);
        if (!canvas) {
          canvas = createDemoCanvas(kid.genome);
          kidPictures.set(kid.genome, canvas);
        }
        drawDemo(canvas, t, { trails: false });
        blit(small[i], canvas);
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    refreshKids();
    return () => cancelAnimationFrame(frame);
  });

  const fmt = (x: number) => x.toFixed(3);
  const selected = (e: Event) => (e.currentTarget as HTMLSelectElement).value;
</script>

<div class="lab" role="dialog" aria-modal="true" aria-labelledby="lab-title" data-testid="demo-lab">
  <div class="head">
    <h2 id="lab-title">DEMO LAB <span class="dev">DEV</span></h2>
    <button type="button" onclick={onClose}>CLOSE</button>
  </div>
  <div class="top">
    <canvas class="main" bind:this={main} width={DEMO_W} height={DEMO_H}></canvas>
    <div class="controls">
      <label>Seed <input type="number" bind:value={seed} /></label>
      <label
        >Family
        <select bind:value={family}>
          <option value="any">any (judged)</option>
          {#each TENDRILS as f (f)}<option value={f}>{f} only</option>{/each}
        </select>
      </label>
      <div class="buttons">
        <button type="button" onclick={newForm}>NEW FORM</button>
        <button type="button" onclick={randomSeed}>RANDOM</button>
        <button type="button" onclick={mutateOnce}>MUTATE (judge)</button>
        <button type="button" onclick={goBack} disabled={back.length === 0}>BACK</button>
      </div>
      {#if demos.length > 0}
        <label
          >This run
          <select onchange={(e: Event) => loadRun(Number(selected(e)))}>
            <option value="">load a demo…</option>
            {#each demos as d (d.number)}<option value={d.number}>#{d.number} {d.title}</option
              >{/each}
          </select>
        </label>
      {/if}
      <label
        >Palette
        <select
          value={current.genome.palette}
          onchange={(e: Event) => override({ palette: Number(selected(e)) })}
        >
          {#each PALETTE_NAMES as name, i (name)}<option value={i}>{name}</option>{/each}
        </select>
      </label>
      <label
        >Style
        <select
          value={current.genome.style}
          onchange={(e: Event) => override({ style: selected(e) as Genome['style'] })}
        >
          <option value="bobs">bobs</option>
          <option value="wire">wire</option>
        </select>
      </label>
      <label
        >Backdrop
        <select
          value={current.genome.backdrop}
          onchange={(e: Event) =>
            override({
              backdrop: selected(e) as Genome['backdrop'],
            })}
        >
          <option value="bars">copper bars</option>
          <option value="stars">stars</option>
        </select>
      </label>
      <label
        >Trails
        <select
          value={current.genome.trails}
          onchange={(e: Event) =>
            override({
              trails: Number(selected(e)) as Genome['trails'],
            })}
        >
          <option value={0}>off</option>
          <option value={2}>every 2 frames</option>
          <option value={3}>every 3 frames</option>
        </select>
      </label>
      <label class="row"><input type="checkbox" bind:checked={paused} /> pause</label>
      <label
        >Time {time}s
        <input
          type="range"
          min="0"
          max="30"
          step="0.1"
          bind:value={time}
          disabled={!paused}
        /></label
      >
      <p class="stats" data-testid="demo-lab-stats">
        ≤ {instances} balls · {msPerFrame.toFixed(2)} ms/frame<br />
        score {fmt(current.verdict.score)} · ok {current.verdict.ok}<br />
        coverage {fmt(parts.coverage)} · cells {parts.cells.toFixed(0)} · detail {fmt(
          parts.detail,
        )}<br />
        grain {fmt(parts.grain)} · biggest {fmt(parts.biggest)} · motion {fmt(parts.motion)}
      </p>
    </div>
  </div>
  <div class="kids-head">
    <h3>Children (★ = the judge's pick)</h3>
    <span>you agreed {agreed} / {picks}</span>
    <button type="button" onclick={() => ((childSeed += 1), refreshKids())}>NEW CHILDREN</button>
    <button type="button" onclick={copyLog}>COPY PICK LOG</button>
  </div>
  <ol class="kids">
    {#each kids as kid, i (kid.genome)}
      <li>
        <button type="button" class="kid" class:star={i === judgePick} onclick={() => pick(i)}>
          <canvas bind:this={small[i]} width={DEMO_W} height={DEMO_H}></canvas>
          <span
            >{i === judgePick ? '★ ' : ''}{fmt(pickScore(current, kid))} · Δ{fmt(kid.change)} · {kid.ops.join(
              '+',
            )}</span
          >
        </button>
      </li>
    {:else}
      <li class="none">No viable child for this seed; try NEW CHILDREN.</li>
    {/each}
  </ol>
  <pre class="script" data-testid="demo-lab-script">{script}</pre>
</div>

<style>
  .lab {
    position: fixed;
    inset: 0;
    z-index: 70;
    overflow-y: auto;
    padding: 10px 14px 24px;
    background: #070a1a;
    color: #e4e7ff;
    font:
      13px ui-monospace,
      'DejaVu Sans Mono',
      monospace;
  }
  .head,
  .kids-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  h2,
  h3 {
    margin: 0;
    font-size: 15px;
  }
  .head h2 {
    flex: 1;
  }
  .dev {
    padding: 0 4px;
    border: 1px solid #ffd166;
    color: #ffd166;
    font-size: 10px;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin: 10px 0;
  }
  canvas {
    image-rendering: pixelated;
    display: block;
    background: #000;
  }
  .main {
    width: min(100%, 640px);
    aspect-ratio: 16 / 10;
    border: 2px solid #2b2f45;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 240px;
    flex: 1;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  label.row {
    flex-direction: row;
    align-items: center;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  button,
  select,
  input {
    font: inherit;
  }
  button {
    padding: 3px 8px;
    border: 2px solid #7d6ff0;
    background: #182046;
    color: #e4e7ff;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }
  .stats {
    margin: 4px 0 0;
    color: #8ff5c9;
  }
  .kids {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 8px;
    list-style: none;
    margin: 8px 0;
    padding: 0;
  }
  .kid {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 3px;
    text-align: left;
  }
  .kid canvas {
    width: 100%;
    aspect-ratio: 16 / 10;
  }
  .kid.star {
    border-color: #ffd166;
  }
  .script {
    margin: 0;
    padding: 8px;
    border: 1px solid #2b2f45;
    background: #000;
    color: #8ff5c9;
    white-space: pre-wrap;
  }
</style>
