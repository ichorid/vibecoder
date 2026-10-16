<script lang="ts">
  import type { DomSpriteSheet } from './contracts';

  interface Props {
    sheet: DomSpriteSheet;
    tag: string;
    scale?: number;
    /** Mirror horizontally (face left). */
    flip?: boolean;
  }

  const { sheet, tag, scale = 4, flip = false }: Props = $props();
  const animation = $derived(sheet.animations[tag]);
  const first = $derived(animation?.frames[0]);
</script>

{#if animation && first}
  <span
    class="atlas-sprite pixelated"
    class:flip
    data-sprite={tag}
    style:width="{first.w * scale}px"
    style:height="{first.h * scale}px"
    style:background-image="url({sheet.imageUrl})"
    style:background-size="{sheet.width * scale}px {sheet.height * scale}px"
    style:--from="{-first.x * scale}px"
    style:--to="{-(first.x + first.w * animation.frames.length) * scale}px"
    style:--y="{-first.y * scale}px"
    style:--steps={animation.frames.length}
    style:--duration="{animation.frameMs * animation.frames.length}ms"
    aria-hidden="true"
  ></span>
{/if}

<style>
  .atlas-sprite {
    display: block;
    background-repeat: no-repeat;
    background-position: var(--from) var(--y);
    animation: strip var(--duration) steps(var(--steps)) infinite;
  }
  .flip {
    transform: scaleX(-1);
  }
  @keyframes strip {
    from {
      background-position: var(--from) var(--y);
    }
    to {
      background-position: var(--to) var(--y);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .atlas-sprite {
      animation: none;
    }
  }
</style>
