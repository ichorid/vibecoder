<script lang="ts">
  import type { CatViewModel } from '../game/selectors';
  import AtlasSprite from './AtlasSprite.svelte';
  import type { DomSpriteSheet } from './contracts';
  import PixelIcon from './PixelIcon.svelte';
  import { catFace, catSkull, catSunset } from './pixelArt';
  import { describeLevel } from './format';

  interface Props {
    cat: CatViewModel;
    /** The world atlas: the button shows the same animated cat as the room once it loads. */
    sprites?: DomSpriteSheet | null;
    settingsOpen: boolean;
    onCat: () => void;
    onHistory: () => void;
    onSettings: (event: MouseEvent) => void;
  }

  const { cat, sprites = null, settingsOpen, onCat, onHistory, onSettings }: Props = $props();

  const catLabel = $derived(
    cat.alive
      ? `Cat. Health ${describeLevel(cat.health)}, mood ${describeLevel(cat.mood)}.`
      : 'Cat. Gone.',
  );
</script>

<header class="header">
  <div class="top">
    <h1 class="title">VIBE CODER</h1>
    <nav class="nav" aria-label="Views">
      <button
        type="button"
        class="cat-button"
        class:gone={!cat.alive}
        data-fate={cat.fate}
        aria-label={catLabel}
        data-testid="cat-button"
        onclick={onCat}
      >
        <span class="cat-icon" data-testid="cat-icon">
          {#if cat.alive && sprites}
            <AtlasSprite
              sheet={sprites}
              tag={cat.overfed ? 'cat-round-idle' : 'cat-idle'}
              scale={2}
            />
          {:else}
            <PixelIcon
              map={cat.fate === 'alive' ? catFace : cat.fate === 'stray' ? catSunset : catSkull}
              scale={3}
            />
          {/if}
        </span>
        <span class="bars" aria-hidden="true">
          <span class="bar health" data-testid="health-bar">
            <span class="fill" style:width="{cat.alive ? cat.health : 0}%"></span>
          </span>
          <span class="bar mood" data-testid="mood-bar">
            <span class="fill" style:width="{cat.alive ? cat.mood : 0}%"></span>
          </span>
        </span>
      </button>
      <button type="button" class="nav-button" onclick={onHistory}>HISTORY</button>
      <button
        type="button"
        class="nav-button settings"
        aria-label="Settings"
        aria-haspopup="true"
        aria-expanded={settingsOpen}
        data-testid="settings-button"
        onclick={onSettings}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 9 9"
          shape-rendering="crispEdges"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M3 0h3v1h1v1h1v1h1v3H8v1H7v1H6v1H3V8H2V7H1V6H0V3h1V2h1V1h1zM3 3v3h3V3z"
          />
        </svg>
      </button>
    </nav>
  </div>
</header>

<style>
  .header {
    padding: max(6px, env(safe-area-inset-top)) 10px 4px;
    border-bottom: 3px solid var(--border);
    background: var(--panel);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .title {
    min-width: 0;
    overflow: hidden;
    margin: 0;
    font-size: clamp(17px, 5.6vw, 24px);
    letter-spacing: 0.06em;
    font-weight: 900;
    white-space: nowrap;
  }
  .nav {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }
  .cat-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
    padding: 4px;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .cat-icon {
    display: block;
    width: 36px;
    border: 0;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 36px;
    margin-top: 2px;
  }
  .bar {
    position: relative;
    display: block;
    width: 100%;
    height: 3px;
    background: var(--bar-track);
    overflow: hidden;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    display: block;
    transition: width 0.8s linear;
  }
  .health .fill {
    background: var(--health);
  }
  .mood .fill {
    /* Striped fill distinguishes mood without relying on color. */
    background: repeating-linear-gradient(90deg, var(--mood) 0 2px, transparent 2px 3px);
  }
  .gone .bar {
    background: var(--bar-dead);
  }
  .nav-button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 8px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  .settings {
    display: grid;
    place-items: center;
    padding: 0;
  }
  @media (max-width: 360px) {
    .header {
      padding-left: 6px;
      padding-right: 6px;
    }
    .title {
      font-size: 15px;
      letter-spacing: 0.02em;
    }
    .nav {
      gap: 4px;
    }
    .nav-button {
      padding: 0 5px;
      font-size: 12px;
    }
  }
</style>
