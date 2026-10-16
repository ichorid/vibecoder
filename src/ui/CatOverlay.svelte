<script lang="ts">
  import type { AttentionLevel } from '../game/types';
  import AtlasSprite from './AtlasSprite.svelte';
  import type { DomSpriteSheet } from './contracts';
  import PixelIcon from './PixelIcon.svelte';
  import { catRound, catSitting } from './pixelArt';

  interface Props {
    level: AttentionLevel;
    /** Intrusion counter: varies the cosmetic placement. */
    variant: number;
    /** Which surfaces exist right now, so the cat never sits on something absent. */
    surfaces: { cards: boolean; log: boolean };
    sprites?: DomSpriteSheet | null;
    onOpen: () => void;
  }

  const { level, variant, surfaces, sprites = null, onOpen }: Props = $props();
  const spot = $derived.by(() => {
    if (level === 'large') return 'block';
    const options = [
      'button',
      ...(surfaces.cards ? (['card'] as const) : []),
      ...(surfaces.log ? (['walk'] as const) : []),
    ];
    return options[variant % options.length] ?? 'button';
  });
</script>

<!-- Only the sprite's own footprint intercepts input; the header and world stay reachable. -->
<button
  type="button"
  class="intruder {level} {spot}"
  data-testid="cat-overlay"
  data-level={level}
  aria-label="The cat wants attention. Open Cat."
  onclick={onOpen}
>
  {#if sprites}
    <AtlasSprite
      sheet={sprites}
      tag="cat-attention"
      scale={level === 'large' ? 8 : 3}
      flip={variant % 2 === 1}
    />
  {:else}
    <PixelIcon map={variant % 2 === 0 ? catSitting : catRound} scale={level === 'large' ? 9 : 4} />
  {/if}
</button>

<style>
  .intruder {
    position: absolute;
    z-index: 15;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
    animation: arrive 0.3s steps(3) both;
  }
  @keyframes arrive {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }
  /* Small: sits on the right end of the primary button. */
  .small.button {
    top: 0;
    right: 14px;
  }
  /* Small: sits on the first upgrade card's price. */
  .small.card {
    top: 64px;
    right: 18px;
  }
  /* Small: strolls across the event log. */
  .small.walk {
    bottom: 6px;
    left: 0;
    animation: stroll 4s linear both;
  }
  @keyframes stroll {
    from {
      transform: translateX(-10%);
    }
    to {
      transform: translateX(260%);
    }
  }
  /* Large: covers the primary action until tapped or the intrusion passes. */
  .large.block {
    top: -84px;
    left: 50%;
    margin-left: -90px;
    width: 180px;
    display: grid;
    place-items: center;
  }
  .large.block :global(svg) {
    width: 180px;
    height: auto;
  }
</style>
