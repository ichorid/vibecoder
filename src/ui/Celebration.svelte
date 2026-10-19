<script lang="ts">
  import { particles, type Burst, type Particle } from './celebration';
  interface Props {
    bursts: readonly Burst[];
    onDone: (id: number) => void;
  }

  const { bursts, onDone }: Props = $props();
  const made = new Map<number, Particle[]>();
  const of = (burst: Burst) => {
    let list = made.get(burst.id);
    if (!list) {
      list = particles(burst);
      made.set(burst.id, list);
    }
    return list;
  };
</script>

<!-- Decorative only: the log and the deck already say what happened. -->
<div class="celebration" aria-hidden="true" data-testid="celebration">
  {#each bursts as burst (burst.id)}
    <div class="burst" data-tier={burst.tier} data-testid="burst">
      {#if burst.tier === 'S'}<div class="flash"></div>{/if}
      {#each of(burst) as p, i (i)}
        <span
          class="p"
          style:left="{p.x * 100}%"
          style:top="{p.y * 100}%"
          style:width="{p.size}px"
          style:height="{p.size}px"
          style:background={p.color}
          style:--dx="{p.dx}px"
          style:--dy="{p.dy}px"
          style:animation-delay="{p.delay}ms"
        ></span>
      {/each}
      {#if burst.text}
        <span
          class="text"
          style:left="{(burst.tier === 'S' ? 0.5 : burst.x) * 100}%"
          style:top="{(burst.tier === 'S' ? 0.42 : burst.y) * 100}%"
          onanimationend={() => {
            made.delete(burst.id);
            onDone(burst.id);
          }}>{burst.text}</span
        >
      {:else}
        <span
          class="timer"
          onanimationend={() => {
            made.delete(burst.id);
            onDone(burst.id);
          }}
        ></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .celebration {
    position: absolute;
    inset: 0;
    z-index: 45;
    overflow: hidden;
    pointer-events: none;
  }
  .burst {
    position: absolute;
    inset: 0;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: #fff;
    animation: flash 420ms ease-out both;
  }
  @keyframes flash {
    0% {
      opacity: 0.55;
    }
    100% {
      opacity: 0;
    }
  }
  .p {
    position: absolute;
    opacity: 0;
    animation: fly 900ms cubic-bezier(0.15, 0.7, 0.4, 1) both;
  }
  .burst[data-tier='S'] .p {
    animation-duration: 1100ms;
  }
  .burst[data-tier='A'] .p {
    animation-name: confetti;
    animation-duration: 1000ms;
  }
  @keyframes fly {
    0% {
      opacity: 1;
      transform: translate(0, 0) scale(1);
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), calc(var(--dy) + 30px)) scale(0.6);
    }
  }
  @keyframes confetti {
    0% {
      opacity: 1;
      transform: translate(0, 0) rotate(0);
    }
    60% {
      opacity: 1;
      transform: translate(calc(var(--dx) * 0.8), var(--dy)) rotate(260deg);
    }
    100% {
      opacity: 0;
      transform: translate(var(--dx), calc(var(--dy) + 60px)) rotate(420deg);
    }
  }
  .text {
    position: absolute;
    transform: translate(-50%, -50%);
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.06em;
    white-space: nowrap;
    color: #ffe066;
    text-shadow:
      2px 0 0 #2a2017,
      -2px 0 0 #2a2017,
      0 2px 0 #2a2017,
      0 -2px 0 #2a2017,
      3px 4px 0 rgba(0, 0, 0, 0.35);
    animation: rise 1300ms ease-out both;
  }
  .burst[data-tier='S'] .text {
    font-size: 30px;
    animation: big 1700ms cubic-bezier(0.2, 1.3, 0.4, 1) both;
  }
  @keyframes rise {
    0% {
      opacity: 0;
      transform: translate(-50%, 0) scale(0.6);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -60%) scale(1.1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -260%) scale(1);
    }
  }
  @keyframes big {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.3);
    }
    25% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.15);
    }
    80% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -70%) scale(1);
    }
  }
  .timer {
    position: absolute;
    animation: hold 1200ms linear both;
  }
  @keyframes hold {
    100% {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .p {
      display: none;
    }
    .text {
      animation-name: hold;
    }
  }
</style>
