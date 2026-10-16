<script lang="ts">
  import PixelIcon from './PixelIcon.svelte';
  import { catSitting } from './pixelArt';
</script>

<!-- The cat left as a stray: no memorial, just the poster you put up too late. -->
<div class="poster" data-testid="missing-poster">
  <h3>MISSING</h3>
  <figure class="photo">
    <PixelIcon map={catSitting} scale={6} />
    <figcaption class="visually-hidden">The cat, sitting.</figcaption>
  </figure>
  <p class="lead">Orange. Answers to nothing.</p>
  <p>Last seen: you are not sure.</p>
  <p class="small">The bowl is still full.</p>
</div>

<style>
  .poster {
    align-self: center;
    width: min(260px, 86%);
    margin: 18px auto;
    padding: 14px 16px 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: #f6f0dc;
    color: #2b2620;
    border: 2px solid #cfc6b2;
    box-shadow: 0 3px 0 var(--shadow);
    transform: rotate(-1.5deg);
    text-align: center;
  }
  h3 {
    margin: 0;
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 0.16em;
  }
  .photo {
    margin: 4px 0;
    padding: 6px;
    background: #fff;
    border: 2px solid #cfc6b2;
    filter: grayscale(0.85) contrast(1.1);
  }
  p {
    margin: 0;
    font-weight: 700;
  }
  .lead {
    font-size: 16px;
  }
  .small {
    font-size: 12px;
    font-weight: 600;
    font-style: italic;
  }
</style>
