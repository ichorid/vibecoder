<script lang="ts">
  import type { FloatingGain } from './floatingGains';

  interface Props {
    gains: readonly FloatingGain[];
    onDone: (id: number) => void;
  }

  const { gains, onDone }: Props = $props();
</script>

<!-- Decorative: the counters already announce the change; the effect itself is aria-hidden. -->
<div class="floating-gains">
  {#each gains as gain (gain.id)}
    <span
      class="gain"
      class:fly={gain.to !== undefined}
      class:spend={gain.tone === 'spend'}
      class:earn={gain.tone === 'earn'}
      data-testid="floating-gain"
      data-tone={gain.tone}
      data-flies={gain.to ? 'build' : undefined}
      aria-hidden="true"
      style:left="{gain.x * 100}%"
      style:top={gain.y === undefined ? undefined : `${gain.y * 100}%`}
      style:--tx={gain.to ? `${gain.to.x}px` : undefined}
      style:--ty={gain.to ? `${gain.to.y}px` : undefined}
      onanimationend={() => onDone(gain.id)}>{gain.text}</span
    >
  {/each}
</div>

<style>
  .floating-gains {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 5;
  }
  .gain {
    position: absolute;
    top: 0;
    transform: translate(-50%, 0);
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 0.04em;
    white-space: nowrap;
    color: #ffe066;
    /* A one-pixel-step dark outline: the classic hit/heal number look. */
    text-shadow:
      2px 0 0 #2a2017,
      -2px 0 0 #2a2017,
      0 2px 0 #2a2017,
      0 -2px 0 #2a2017,
      2px 2px 0 #2a2017,
      -2px -2px 0 #2a2017,
      2px -2px 0 #2a2017,
      -2px 2px 0 #2a2017,
      3px 4px 0 rgba(0, 0, 0, 0.35);
    animation: float-up 900ms ease-out forwards;
  }
  /* Money paid out: red, rising like any number. */
  .gain.spend {
    font-size: 20px;
    color: #ff5a4e;
  }
  /* Money earned: a big gold pop below the balance that flies up into it. */
  .gain.earn {
    font-size: 28px;
    color: #ffc62a;
    filter: drop-shadow(0 0 6px rgba(255, 198, 42, 0.75));
    animation: earn-in 1300ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
  }
  @keyframes earn-in {
    0% {
      opacity: 0;
      transform: translate(-50%, 44px) scale(0.5);
    }
    18% {
      opacity: 1;
      transform: translate(-50%, 30px) scale(1.5);
    }
    32% {
      transform: translate(-50%, 30px) scale(1.15);
    }
    65% {
      opacity: 1;
      transform: translate(-50%, 30px) scale(1.15);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -6px) scale(0.6);
    }
  }
  /* Into the build the press fills: it pops, then drops into the bar and fades. */
  .gain.fly {
    animation: fly-in 900ms ease-in forwards;
  }
  @keyframes fly-in {
    0% {
      opacity: 1;
      transform: translate(-50%, 6px) scale(1.35);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -10px) scale(1);
    }
    100% {
      opacity: 0.15;
      transform: translate(calc(-50% + var(--tx, 0px)), var(--ty, 0px)) scale(0.6);
    }
  }
  @keyframes float-up {
    0% {
      opacity: 1;
      transform: translate(-50%, 6px) scale(1.35);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, -10px) scale(1);
    }
    65% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -72px) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .gain,
    .gain.fly,
    .gain.earn {
      animation: fade 900ms linear forwards;
    }
    @keyframes fade {
      to {
        opacity: 0;
      }
    }
  }
</style>
