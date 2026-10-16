<script lang="ts">
  import PixelIcon from './PixelIcon.svelte';
  import type { PixelMap } from './pixelArt';

  /** A memorial candle: a wax stick on a saucer, and a flame that flickers through 3 frames. */
  const body: PixelMap = {
    rows: [
      '....k....',
      '..kkwkk..',
      '..kwwwk..',
      '..kwwwk..',
      '..kwwsk..',
      '..kwwsk..',
      '..kwwsk..',
      '..kwwsk..',
      '.kkkkkkk.',
      'kmmmmmmmk',
      '.kkkkkkk.',
    ],
    palette: { k: '#2a2017', w: '#f3ead2', s: '#d9cfb8', m: '#b7b3a9' },
  };
  const flames: PixelMap[] = [
    {
      rows: ['....y....', '...yoy...', '...yoy...', '....r....'],
      palette: { y: '#f6c945', o: '#fff4c2', r: '#e8892f' },
    },
    {
      rows: ['...y.....', '...yoy...', '...yoy...', '....r....'],
      palette: { y: '#f6c945', o: '#fff4c2', r: '#e8892f' },
    },
    {
      rows: ['.....y...', '...yoyy..', '...yoy...', '....r....'],
      palette: { y: '#f6c945', o: '#fff4c2', r: '#e8892f' },
    },
  ];
</script>

<div class="candle" data-testid="memorial-candle" aria-hidden="true">
  <span class="glow"></span>
  <span class="flame">
    {#each flames as flame, i (i)}
      <span class="frame f{i}"><PixelIcon map={flame} scale={5} /></span>
    {/each}
  </span>
  <PixelIcon map={body} scale={5} />
</div>

<style>
  .candle {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 45px;
    margin: 0 auto;
  }
  .glow {
    position: absolute;
    top: -14px;
    left: 50%;
    width: 60px;
    height: 60px;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(246, 201, 69, 0.45), rgba(246, 201, 69, 0) 70%);
    animation: glow 1.8s ease-in-out infinite;
  }
  .flame {
    position: relative;
    width: 45px;
    height: 20px;
  }
  .frame {
    position: absolute;
    inset: 0;
    opacity: 0;
    animation: flicker 0.6s steps(1) infinite;
  }
  .f0 {
    animation-delay: 0s;
  }
  .f1 {
    animation-delay: -0.2s;
  }
  .f2 {
    animation-delay: -0.4s;
  }
  @keyframes flicker {
    0% {
      opacity: 1;
    }
    33.3% {
      opacity: 0;
    }
  }
  @keyframes glow {
    50% {
      opacity: 0.6;
      transform: translateX(-50%) scale(0.9);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .frame,
    .glow {
      animation: none;
    }
    .f0 {
      opacity: 1;
    }
  }
</style>
