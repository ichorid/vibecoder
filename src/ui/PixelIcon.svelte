<script lang="ts">
  import { pixelRects, type PixelMap } from './pixelArt';

  const { map, scale = 2 }: { map: PixelMap; scale?: number } = $props();
  const rects = $derived(pixelRects(map));
  const width = $derived(Math.max(...map.rows.map((r) => r.length)));
  const height = $derived(map.rows.length);
</script>

<svg
  class="pixel-icon"
  width={width * scale}
  height={height * scale}
  viewBox="0 0 {width} {height}"
  shape-rendering="crispEdges"
  aria-hidden="true"
  focusable="false"
>
  {#each rects as r, i (i)}
    <rect x={r.x} y={r.y} width={r.w} height="1" fill={r.color} />
  {/each}
</svg>

<style>
  .pixel-icon {
    display: block;
  }
</style>
