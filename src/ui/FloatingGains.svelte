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
      data-testid="floating-gain"
      aria-hidden="true"
      style:left="{gain.x * 100}%"
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
    .gain {
      animation: fade 900ms linear forwards;
    }
    @keyframes fade {
      to {
        opacity: 0;
      }
    }
  }
</style>
