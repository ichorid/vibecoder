<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { TechnologyId, UpgradeId } from '../game/ids';
  import type { GameViewModel } from '../game/selectors';
  import type { Dispatch } from './contracts';
  import { formatActiveTime, formatAmount } from './format';
  import CatOverlay from './CatOverlay.svelte';
  import UnlockAnnouncement from './UnlockAnnouncement.svelte';
  import type { AttentionLevel } from '../game/types';

  interface Props {
    game: GameViewModel;
    dispatch: Dispatch;
    illustrationUrl: (illustrationId: string) => string | null;
    attention?: { readonly level: AttentionLevel | null; readonly key: number } | undefined;
    onCatOverlay?: () => void;
    world?: Snippet;
  }

  const { game, dispatch, illustrationUrl, attention, onCatOverlay, world }: Props = $props();
  let controls: HTMLElement | undefined = $state();

  function primary() {
    dispatch({ type: 'primaryAction' });
  }

  async function buy(id: UpgradeId) {
    const index = game.offers.findIndex((offer) => offer.id === id);
    dispatch({ type: 'buyUpgrade', id });
    await tick();
    // Keep focus predictable when the bought card disappears: next card, else primary action.
    const cards = controls?.querySelectorAll<HTMLButtonElement>('.offer');
    const target = cards?.[Math.min(index, (cards?.length ?? 1) - 1)];
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      (target ?? controls?.querySelector<HTMLButtonElement>('.primary'))?.focus();
    }
  }

  function acknowledge(id: TechnologyId) {
    dispatch({ type: 'acknowledgeUnlock', id });
  }
</script>

<section class="game-view" aria-label="Game">
  <div class="world" data-testid="world">
    {@render world?.()}
    {#if game.announcement}
      {@const announcement = game.announcement}
      <UnlockAnnouncement
        {announcement}
        illustrationUrl={illustrationUrl(announcement.illustrationId)}
        onAcknowledge={() => acknowledge(announcement.id)}
      />
    {/if}
  </div>
  <div class="controls" bind:this={controls}>
    {#if attention?.level && onCatOverlay}
      {#key attention.key}
        <CatOverlay
          level={attention.level}
          variant={attention.key}
          surfaces={{ cards: game.offers.length > 0, log: game.log.length > 0 }}
          onOpen={onCatOverlay}
        />
      {/key}
    {/if}
    <button type="button" class="primary" data-testid="primary-action" onclick={primary}>
      {game.primaryAction.label}
    </button>
    {#if game.offers.length > 0}
      <ul class="offers" aria-label="Upgrades">
        {#each game.offers as offer (offer.id)}
          <li>
            <button
              type="button"
              class="offer"
              disabled={!offer.affordable}
              aria-describedby="offer-{offer.id}-desc"
              onclick={() => buy(offer.id)}
            >
              <span class="offer-text">
                <span class="offer-title">{offer.title}</span>
                <span class="offer-desc" id="offer-{offer.id}-desc">{offer.description}</span>
              </span>
              <span class="price">{formatAmount(offer.price)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if game.log.length > 0}
      <ol class="log" aria-label="Recent events">
        {#each game.log as line, i (i)}
          <li><span class="time">[{formatActiveTime(line.activeMs)}]</span> {line.text}</li>
        {/each}
      </ol>
    {/if}
  </div>
</section>

<style>
  .game-view {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
    min-height: 0;
  }
  .world {
    position: relative;
    min-height: 120px;
    overflow: hidden;
    border-bottom: 3px solid var(--border);
    background: var(--panel-strong);
  }
  .controls {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 10px max(10px, env(safe-area-inset-bottom));
  }
  .primary {
    min-height: 56px;
    border: 3px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 20px;
    font-weight: 900;
    letter-spacing: 0.08em;
    box-shadow: 0 4px 0 var(--accent-strong);
    cursor: pointer;
    user-select: none;
  }
  .primary:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 var(--accent-strong);
  }
  .offers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .offer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 6px 8px;
    text-align: left;
    border: 3px solid var(--border);
    background: var(--panel);
    cursor: pointer;
  }
  .offer:disabled {
    cursor: not-allowed;
    border-color: var(--disabled);
  }
  .offer:disabled .offer-title,
  .offer:disabled .price {
    opacity: 0.6;
  }
  .offer-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .offer-title {
    font-weight: 800;
  }
  .offer-desc {
    font-size: 12px;
    color: var(--ink-soft);
  }
  .price {
    flex: none;
    min-width: 54px;
    padding: 4px 6px;
    text-align: center;
    font-weight: 900;
    border: 2px solid var(--border);
    background: var(--panel-strong);
  }
  .log {
    list-style: none;
    margin: 0;
    padding: 6px 8px;
    max-height: 7.5em;
    overflow: hidden;
    background: var(--log-bg);
    color: var(--log-ink);
    font-size: 12px;
    line-height: 1.45;
  }
  .time {
    opacity: 0.7;
  }
  @media (max-height: 640px) {
    .primary {
      min-height: 48px;
      font-size: 18px;
    }
    .offer-desc {
      display: none;
    }
    .log li:nth-last-child(n + 4) {
      display: none;
    }
  }
</style>
