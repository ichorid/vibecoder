<script lang="ts">
  import PixelIcon from './PixelIcon.svelte';
  import { memorialKeyboard, memorialLap } from './pixelArt';
</script>

<div class="memorial" data-testid="memorial">
  <figure class="photo">
    <PixelIcon map={memorialKeyboard} scale={5} />
    <figcaption class="visually-hidden">The cat asleep on the keyboard beside you.</figcaption>
  </figure>
  <figure class="photo tilted">
    <PixelIcon map={memorialLap} scale={5} />
    <figcaption class="visually-hidden">The cat curled up happily on your lap.</figcaption>
  </figure>
</div>

<style>
  .memorial {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px;
    padding: 24px 8px;
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
  .tilted {
    transform: rotate(3deg);
  }
</style>
