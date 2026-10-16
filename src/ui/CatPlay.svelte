<script lang="ts">
  import { onMount } from 'svelte';
  import {
    playPhase,
    playPosition,
    type PlayPhase,
    type ReadonlyPlay,
  } from '../game/catPlaySession';
  import type { Dispatch, PresentationClock } from './contracts';

  interface Props {
    play: ReadonlyPlay;
    attempts: number;
    clock: PresentationClock;
    dispatch: Dispatch;
  }

  const { play, attempts, clock, dispatch }: Props = $props();
  let lane: HTMLElement | undefined = $state();
  let phase = $state<PlayPhase>('ready');

  const RESULT_TEXT = {
    hit: 'Pounce! The cat got it.',
    near: 'So close. The cat rolls over instead.',
    miss: ['The mouse escapes.', 'The cat gets distracted by its own tail.'],
  } as const;

  const resultText = $derived.by(() => {
    const kind = play.outcome?.kind;
    if (!kind) return '';
    if (kind === 'miss') return RESULT_TEXT.miss[play.attemptId % 2] ?? RESULT_TEXT.miss[0];
    return RESULT_TEXT[kind];
  });

  onMount(() =>
    clock.frames(() => {
      const t = clock.activeNow();
      lane?.style.setProperty('--pos', String(playPosition(play, t)));
      phase = playPhase(play, t);
    }),
  );

  let lastKeyActivation = -1;

  function fire(timeStamp: number) {
    dispatch({ type: 'catchMouse', attemptId: play.attemptId }, { timeStamp });
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    fire(event.timeStamp);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (event.repeat) return;
    lastKeyActivation = event.timeStamp;
    fire(event.timeStamp);
  }

  /** Assistive-technology activation produces a bare click (detail 0) with no key/pointer. */
  function onClick(event: MouseEvent) {
    if (event.detail === 0 && event.timeStamp - lastKeyActivation > 500) fire(event.timeStamp);
  }
</script>

<div class="play" data-testid="cat-play" data-phase={phase} data-attempt={play.attemptNumber}>
  <p class="round">
    Attempt {play.attemptNumber} of {attempts}
    <span class="dots" aria-hidden="true">
      {#each play.previous as result, i (i)}<span class="dot {result}"></span>{/each}
    </span>
  </p>
  <div class="track" aria-hidden="true">
    <div class="lane" bind:this={lane} data-testid="play-lane">
      <div
        class="target"
        data-testid="play-target"
        style:left="{play.target.start * 100}%"
        style:width="{play.target.width * 100}%"
      ></div>
      <div class="mouse" data-testid="play-mouse">
        <svg width="24" height="14" viewBox="0 0 12 7" shape-rendering="crispEdges">
          <path fill="#8d8d99" d="M2 2h6v1h2v1h1v2H1V5H0V4h1V3h1z" />
          <path fill="#f2a3a3" d="M3 1h2v1H3zM10 4h1v1h-1z" />
          <path fill="#2a2017" d="M9 3h1v1H9z" />
          <path fill="#8d8d99" d="M0 6h1v1H0z" />
        </svg>
      </div>
    </div>
  </div>
  <p class="status" aria-live="polite">
    {#if phase === 'ready' || phase === 'resume'}Ready…{:else if phase === 'result'}{resultText}{/if}
  </p>
  <button
    type="button"
    class="catch"
    data-testid="catch-button"
    onpointerdown={onPointerDown}
    onkeydown={onKeyDown}
    onclick={onClick}
  >
    CATCH!
  </button>
</div>

<style>
  .play {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .round {
    margin: 0;
    display: flex;
    justify-content: space-between;
    font-weight: 700;
  }
  .dots {
    display: flex;
    gap: 4px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border: 2px solid var(--border);
  }
  .dot.hit {
    background: var(--accent);
  }
  .dot.near {
    background: var(--panel-strong);
  }
  .track {
    padding: 10px 0;
    border: 3px solid var(--border);
    background: var(--panel-strong);
  }
  .lane {
    --pos: 0;
    position: relative;
    height: 28px;
    margin: 0 14px;
    background: repeating-linear-gradient(90deg, var(--bar-track) 0 6px, transparent 6px 12px);
  }
  .target {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--accent) 70%, transparent);
    border: 2px solid var(--accent-strong);
  }
  .mouse {
    position: absolute;
    top: 7px;
    left: calc(var(--pos) * 100%);
    transform: translateX(-50%);
    will-change: left;
  }
  .play[data-phase='resume'] .track {
    outline: 3px dashed var(--focus);
  }
  .status {
    margin: 0;
    min-height: 1.4em;
    text-align: center;
    font-weight: 700;
  }
  .catch {
    min-height: 64px;
    border: 3px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.08em;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;
  }
</style>
