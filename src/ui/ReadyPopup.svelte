<script lang="ts">
  import type { DemoOfferViewModel, ReleaseOfferViewModel } from '../game/selectors';
  import { APPEAR_INERT_MS } from './buildLane';
  import PixelIcon from './PixelIcon.svelte';
  import { DEMO_ICON, RELEASE_ICON } from './cardIcons';

  interface Props {
    kind: 'release' | 'demo';
    /** The ready release (kind `release`). */
    release?: ReleaseOfferViewModel | null;
    /** The ready demo (kind `demo`). */
    demo?: DemoOfferViewModel | null;
    onGo: () => void;
    onLater: () => void;
  }

  const { kind, release = null, demo = null, onGo, onLater }: Props = $props();

  // Inert for a moment: a press meant for CODE must not ship a release (§6.5).
  let inert = $state(true);
  $effect(() => {
    const start = performance.now();
    let frame = 0;
    const wait = () => {
      if (performance.now() - start < APPEAR_INERT_MS) frame = requestAnimationFrame(wait);
      else inert = false;
    };
    frame = requestAnimationFrame(wait);
    return () => cancelAnimationFrame(frame);
  });
  const go = (event: MouseEvent) => {
    if (inert && event.detail > 0) return;
    onGo();
  };
</script>

<!-- The release (or a demo) is ready: the choice is offered once, over the world (§9). -->
<div
  class="ready-popup"
  class:inert
  class:demo={kind === 'demo'}
  role="dialog"
  aria-modal="false"
  aria-label={release ? `${release.version} is ready` : 'Demo is ready'}
  data-testid="ready-popup"
>
  <span class="icon" aria-hidden="true"
    ><PixelIcon map={kind === 'release' ? RELEASE_ICON : DEMO_ICON} scale={4} /></span
  >
  {#if release}
    <h2>{release.version} IS READY</h2>
    <p class="title">{release.title}</p>
    <p class="odds" data-testid="ready-odds">
      retire chance {Number((release.retireChance * 100).toFixed(2))}%
    </p>
  {:else if demo}
    <h2>DEMO #{demo.number} IS READY</h2>
    <p class="title">{demo.title}</p>
  {/if}
  <div class="actions">
    <button type="button" class="go" data-testid="ready-go" onclick={go}
      >{kind === 'release' ? '🚀 SHIP IT' : '▶ RUN'}</button
    >
    <button type="button" class="later" data-testid="ready-later" onclick={onLater}>Later</button>
  </div>
</div>

<style>
  .ready-popup {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: min(320px, calc(100% - 24px));
    padding: 12px 12px 14px;
    border: 3px solid #c99a1e;
    background: color-mix(in srgb, #f6c945 22%, var(--panel));
    box-shadow:
      0 6px 0 rgba(0, 0, 0, 0.25),
      0 0 0 4px color-mix(in srgb, #f6c945 40%, transparent);
    transform: translate(-50%, -50%);
    animation: pop-in 360ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
  }
  .ready-popup.demo {
    border-color: #7d6ff0;
    background: color-mix(in srgb, #7d6ff0 18%, var(--panel));
  }
  @keyframes pop-in {
    0% {
      opacity: 0;
      transform: translate(-50%, -40%) scale(0.7);
    }
  }
  h2 {
    margin: 4px 0 0;
    font-size: 18px;
    letter-spacing: 0.08em;
  }
  p {
    margin: 0;
    font-size: 13px;
    font-weight: 800;
  }
  .odds {
    color: var(--ink-soft);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .actions button {
    min-height: 44px;
    padding: 0 14px;
    border: 3px solid var(--border);
    font-weight: 900;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .go {
    background: var(--accent);
    color: var(--accent-ink);
    box-shadow: 0 4px 0 var(--accent-strong);
  }
  .later {
    background: var(--panel-strong);
  }
  .inert .go {
    opacity: 0.6;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .ready-popup {
      animation: none;
    }
  }
</style>
