<script lang="ts">
  import Candle from './Candle.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { memorialKeyboard, memorialLap } from './pixelArt';

  /** URLs of the two exported photos; inline fallbacks keep the memorial if they fail. */
  const { urls = [] }: { urls?: readonly string[] } = $props();
  const photos = [
    { caption: 'The cat asleep on the keyboard beside you.', fallback: memorialKeyboard },
    { caption: 'The cat curled up happily on your lap.', fallback: memorialLap },
  ];
  const failed = $state<boolean[]>([false, false]);
</script>

<div class="memorial" data-testid="memorial">
  {#each photos as photo, i (i)}
    <figure class="photo" class:tilted={i === 1}>
      {#if urls[i] && !failed[i]}
        <img
          class="pixelated"
          src={urls[i]}
          alt={photo.caption}
          width="64"
          height="48"
          onerror={() => (failed[i] = true)}
        />
      {:else}
        <PixelIcon map={photo.fallback} scale={5} />
        <figcaption class="visually-hidden">{photo.caption}</figcaption>
      {/if}
    </figure>
  {/each}
  <div class="candle-row"><Candle /></div>
</div>

<style>
  .memorial {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px;
    padding: 24px 8px;
  }
  .candle-row {
    flex-basis: 100%;
    padding-top: 6px;
  }
  .photo {
    margin: 0;
    padding: 8px 8px 26px;
    background: #f5f1e6;
    border: 2px solid #cfc6b2;
    box-shadow: 0 3px 0 var(--shadow);
    filter: sepia(0.25) saturate(0.85);
    transform: rotate(-2deg);
  }
  .photo img {
    display: block;
    width: min(192px, 70vw);
    height: auto;
  }
  .tilted {
    transform: rotate(3deg);
  }
</style>
