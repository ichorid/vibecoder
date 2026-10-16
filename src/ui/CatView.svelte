<script lang="ts">
  import type { CatViewModel } from '../game/selectors';
  import PixelIcon from './PixelIcon.svelte';
  import { catFace } from './pixelArt';

  const { cat, onReturn }: { cat: CatViewModel; onReturn: () => void } = $props();

  const meters = $derived([
    { id: 'health', label: 'Health', value: cat.health },
    { id: 'mood', label: 'Mood', value: cat.mood },
    { id: 'fullness', label: 'Fullness', value: cat.fullness },
  ]);
</script>

<section class="cat-view" aria-labelledby="cat-title">
  <div class="bar">
    <button type="button" class="return" onclick={onReturn}>← GAME</button>
    <h2 id="cat-title">CAT</h2>
  </div>
  <div class="portrait" aria-hidden="true">
    <PixelIcon map={catFace} scale={12} />
  </div>
  <dl class="status">
    {#each meters as meter (meter.id)}
      <div class="meter">
        <dt>{meter.label}</dt>
        <dd>
          <span class="track"
            ><span class="fill {meter.id}" style:width="{meter.value}%"></span></span
          >
          <span class="value">{Math.round(meter.value)}</span>
        </dd>
      </div>
    {/each}
  </dl>
  <p class="dev-note">Care controls are not part of this development build yet.</p>
</section>

<style>
  .cat-view {
    height: 100%;
    overflow-y: auto;
    padding: 10px 12px max(16px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.1em;
  }
  .return {
    min-height: 44px;
    padding: 0 12px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
    cursor: pointer;
  }
  .portrait {
    display: grid;
    place-items: center;
    padding: 16px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
  }
  .status {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .meter {
    display: grid;
    grid-template-columns: 9ch 1fr;
    align-items: center;
  }
  dt {
    font-weight: 700;
  }
  dd {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .track {
    position: relative;
    flex: 1;
    height: 10px;
    border: 2px solid var(--border);
    background: var(--bar-track);
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
  }
  .fill.health {
    background: var(--health);
  }
  .fill.mood {
    background: var(--mood);
  }
  .fill.fullness {
    background: #d9a13b;
  }
  .value {
    min-width: 3ch;
    text-align: right;
  }
  .dev-note {
    color: var(--ink-soft);
    font-size: 13px;
  }
</style>
