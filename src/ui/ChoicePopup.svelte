<script lang="ts">
  import type { ChoiceOfferViewModel } from '../game/selectors';
  import PixelIcon from './PixelIcon.svelte';
  import { DECISION_ICON } from './cardIcons';

  interface Props {
    choice: ChoiceOfferViewModel;
    onChoose: () => void;
    onClose: () => void;
  }

  const { choice, onChoose, onClose }: Props = $props();
  /** A decision with a confirmation text asks once more before committing. */
  let confirming = $state(false);
</script>

<!-- A decision from the lane, in full (docs/feature_build_deck.md B12). -->
<div class="choice-popup" role="dialog" aria-label={choice.title} data-testid="choice-popup">
  <span class="icon" aria-hidden="true"><PixelIcon map={DECISION_ICON} scale={4} /></span>
  <h2>{choice.title}</h2>
  <p class="desc">{confirming && choice.confirm ? choice.confirm : choice.description}</p>
  {#if choice.effects.length > 0 && !confirming}
    <p class="effects">▸ {choice.effects.join(' · ')}</p>
  {/if}
  <div class="actions">
    {#if confirming}
      <button type="button" class="yes" onclick={onChoose}>YES</button>
      <button type="button" class="no" onclick={() => (confirming = false)}>NO</button>
    {:else}
      <button
        type="button"
        class="yes"
        data-testid="choice-decide"
        onclick={() => (choice.confirm ? (confirming = true) : onChoose())}>DECIDE</button
      >
      <button type="button" class="no" data-testid="choice-later" onclick={onClose}>Later</button>
    {/if}
  </div>
</div>

<style>
  .choice-popup {
    position: absolute;
    inset: 8px;
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    overflow-y: auto;
    border: 3px dashed var(--border);
    background: var(--panel);
    text-align: center;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.06em;
  }
  p {
    margin: 0;
    max-width: 420px;
    font-size: 14px;
  }
  .effects {
    font-size: 12px;
    font-weight: 800;
    color: var(--accent-strong);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .actions button {
    min-height: 44px;
    min-width: 72px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 900;
    cursor: pointer;
  }
  .yes {
    background: var(--health) !important;
    color: #fff;
  }
</style>
