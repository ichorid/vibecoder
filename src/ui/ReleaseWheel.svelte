<script lang="ts">
  import { onMount } from 'svelte';
  import type { ReleaseWheelViewModel } from '../game/selectors';
  import type { WheelSound } from './contracts';
  import {
    boundariesCrossed,
    landingAngle,
    rotationAt,
    sectorPath,
    sliceArcs,
    spinRotation,
  } from './wheelGeometry';

  interface Props {
    /** A release that is already committed; the wheel only animates toward it. */
    wheel: ReleaseWheelViewModel;
    reducedMotion: boolean;
    sound?: ((id: WheelSound) => void) | undefined;
    onDone: () => void;
  }

  const { wheel, reducedMotion, sound, onDone }: Props = $props();

  const SPIN_MS = 4000;
  const SKIP_AFTER_MS = 1000;
  const FLASH_MS = 600;
  const C = 100;
  const R = 84;

  const arcs = $derived(sliceArcs(wheel.slices.length - 1, wheel.hazard));
  const total = $derived(
    spinRotation(landingAngle(arcs, wheel.target, wheel.spinSeed), wheel.spinSeed),
  );
  const percent = $derived(`${Number((wheel.hazard * 100).toFixed(2))} %`);
  const COLORS = ['#f6c945', '#59b7ff', '#ff8fa3', '#7ee2a8', '#c9a7ff'];

  let rotation = $state(0);
  let phase = $state<'spinning' | 'flash' | 'result'>('spinning');
  let started = 0;
  let frame = 0;
  let dialog: HTMLElement | undefined = $state();
  let back: HTMLButtonElement | undefined = $state();

  function land() {
    rotation = total;
    sound?.(wheel.result.jackpot ? 'jackpot' : 'release');
    if (wheel.result.jackpot && !reducedMotion) {
      phase = 'flash';
      started = performance.now();
      frame = requestAnimationFrame(flash);
    } else {
      phase = 'result';
      queueMicrotask(() => back?.focus());
    }
  }

  function flash(now: number) {
    if (now - started >= FLASH_MS) onDone();
    else frame = requestAnimationFrame(flash);
  }

  function spin(now: number) {
    const progress = (now - started) / SPIN_MS;
    const next = rotationAt(total, progress);
    if (boundariesCrossed(arcs, rotation, next) > 0) sound?.('tick');
    rotation = next;
    if (progress >= 1) land();
    else frame = requestAnimationFrame(spin);
  }

  /** After a second, a tap, click, Enter or Space jumps to the result. */
  function skip() {
    if (phase !== 'spinning' || performance.now() - started < SKIP_AFTER_MS) return;
    cancelAnimationFrame(frame);
    land();
  }

  function keydown(event: KeyboardEvent) {
    if (phase === 'spinning' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      skip();
    }
  }

  onMount(() => {
    dialog?.focus();
    if (reducedMotion) land();
    else {
      started = performance.now();
      frame = requestAnimationFrame(spin);
    }
    return () => cancelAnimationFrame(frame);
  });
</script>

<div
  class="wheel-overlay"
  class:flash={phase === 'flash'}
  role="dialog"
  aria-modal="true"
  aria-label="Release {wheel.version}"
  tabindex="-1"
  data-testid="release-wheel"
  data-phase={phase}
  bind:this={dialog}
  onclick={skip}
  onkeydown={keydown}
>
  <p class="kicker">SHIPPING {wheel.version}</p>
  <div class="wheel">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <g transform="rotate({rotation} {C} {C})">
        {#each wheel.slices as slice, i (slice.id)}
          {@const arc = arcs[i]}
          {#if arc}
            {@const mid = (arc.start + arc.end) / 2}
            <path
              d={sectorPath(arc, C, C, R)}
              fill={slice.gold ? '#e7b42f' : (COLORS[i % COLORS.length] ?? '#ffffff')}
              stroke="#2b1d14"
              stroke-width="1.5"
            />
            {#if slice.gold}
              <!-- A glint on the rim so even a sub-degree slice can be found. -->
              <circle
                cx={C}
                cy={C - R - 6}
                r="4"
                fill="#e7b42f"
                stroke="#2b1d14"
                transform="rotate({mid} {C} {C})"
              />
            {:else}
              <text
                x={C + 22}
                y={C}
                transform="rotate({mid - 90} {C} {C})"
                dominant-baseline="middle"
                class="label">{slice.label}</text
              >
            {/if}
          {/if}
        {/each}
        <circle cx={C} cy={C} r="10" fill="#2b1d14" />
      </g>
      <polygon points="{C - 7},4 {C + 7},4 {C},20" fill="#e8483c" stroke="#2b1d14" />
    </svg>
  </div>
  <p class="odds" data-testid="wheel-odds">
    <span class="gold-chip" aria-hidden="true"></span>{wheel.slices.at(-1)?.label}: {percent}
  </p>
  <div class="result" aria-live="polite">
    {#if phase === 'result'}
      <h2 data-testid="release-result">{wheel.result.label}</h2>
      {#if wheel.result.text}<p class="line">{wheel.result.text}</p>{/if}
      {#if wheel.result.comment}
        <p class="comment">Top comment: “{wheel.result.comment}”</p>
      {/if}
      <button
        type="button"
        class="back"
        bind:this={back}
        onclick={(event) => {
          event.stopPropagation();
          onDone();
        }}>{wheel.result.jackpot ? 'CONTINUE' : 'BACK TO WORK'}</button
      >
    {:else if phase === 'spinning'}
      <p class="hint">Spinning… tap to skip</p>
    {/if}
  </div>
</div>

<style>
  .wheel-overlay {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 16px max(16px, env(safe-area-inset-bottom));
    overflow-y: auto;
    background: var(--panel);
    outline: none;
  }
  .wheel-overlay.flash {
    animation: gold 0.6s steps(3);
  }
  @keyframes gold {
    50% {
      background: #f6c945;
    }
  }
  .kicker {
    margin: 0;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.2em;
    color: var(--ink-soft);
  }
  .wheel {
    width: min(300px, 80vw, 42vh);
    aspect-ratio: 1;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .label {
    font-size: 9px;
    font-weight: 900;
    fill: #2b1d14;
  }
  .odds {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 800;
  }
  .gold-chip {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
    background: #e7b42f;
  }
  .result {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }
  h2 {
    margin: 0;
    font-size: 22px;
    letter-spacing: 0.06em;
  }
  .line {
    margin: 0;
    line-height: 1.45;
  }
  .comment {
    margin: 0;
    font-size: 13px;
    font-style: italic;
    color: var(--ink-soft);
  }
  .hint {
    margin: 0;
    color: var(--ink-soft);
  }
  .back {
    min-height: 48px;
    margin-top: 4px;
    padding: 0 18px;
    border: 3px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 900;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
</style>
