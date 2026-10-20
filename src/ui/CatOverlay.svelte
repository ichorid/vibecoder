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
  /* The overlay lives in the controls; `100%` up from their bottom is the world's foot, where the
     press label sits and the thumb taps. */
  /* Small: sits on the right end of the press label (the foot of the world). */
  .small.button {
    bottom: calc(100% + 20px);
    left: calc(50% + 36px);
  }
  /* Small: sits on the build lane (the bottom of the controls). */
  .small.card {
    bottom: max(16px, env(safe-area-inset-bottom));
    right: 18px;
  }
  /* Small: strolls across the event log (the top of the controls). */
  .small.walk {
    top: 0;
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
  /* Large: covers the press label and the world around it until tapped or the intrusion passes. */
  .large.block {
    bottom: 100%;
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
