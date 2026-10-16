<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { ChoiceId, TechnologyId, UpgradeId } from '../game/ids';
  import type { GameViewModel, OfferViewModel } from '../game/selectors';
  import type { Dispatch, DomSpriteSheet, WheelSound } from './contracts';
  import { formatActiveTime, formatAmount } from './format';
  import CatOverlay from './CatOverlay.svelte';
  import EndingPanel from './EndingPanel.svelte';
  import ReleaseWheel from './ReleaseWheel.svelte';
  import UnlockAnnouncement from './UnlockAnnouncement.svelte';
  import FloatingGains from './FloatingGains.svelte';
  import Stats from './Stats.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { ACTION_ICONS, cardIcon, DECISION_ICON, RELEASE_ICON, STAT_ICONS } from './cardIcons';
  const CODE_ICON = STAT_ICONS.output;
  import { gainText, MAX_FLOATING, type FloatingGain } from './floatingGains';
  import type { AttentionLevel } from '../game/types';

  interface Props {
    game: GameViewModel;
    dispatch: Dispatch;
    illustrationUrl: (illustrationId: string) => string | null;
    attention?: { readonly level: AttentionLevel | null; readonly key: number } | undefined;
    onCatOverlay?: () => void;
    sprites?: DomSpriteSheet | null;
    world?: Snippet;
    reducedMotion?: boolean;
    onSound?: ((id: WheelSound) => void) | undefined;
    /** Small screens: show the cards in a popup instead of under the primary action. */
    compactOffers?: boolean;
    /** Opens the Setup view (from the stats panel). */
    onSetup?: () => void;
  }

  const {
    game,
    dispatch,
    illustrationUrl,
    attention,
    onCatOverlay,
    sprites = null,
    world,
    reducedMotion = false,
    onSound,
    compactOffers = false,
    onSetup,
  }: Props = $props();
  let offersOpen = $state(false);
  // An ending closes the cards popup; it does not come back open on the next run or a load.
  $effect(() => {
    if (game.ending) offersOpen = false;
  });
  let sheet: HTMLElement | undefined = $state();
  /** Purchases the current balance pays for right now (upgrades and releases). */
  const affordable = $derived(
    game.offers.filter((o) => o.kind !== 'choice' && o.affordable).length,
  );
  const decisions = $derived(game.offers.filter((o) => o.kind === 'choice').length);
  let controls: HTMLElement | undefined = $state();

  let gains = $state<FloatingGain[]>([]);
  let nextGainId = 0;

  /** OBSERVE changes nothing; the button still answers (cosmetic, for the lulz). */
  const OBSERVE_GAINS = [
    '+1 existential dread',
    '+1 boredom',
    '+1 existential dread',
    '+1 staring',
    '+1 boredom',
    '+0 purpose',
  ];
  let observed = 0;

  function primary(event: MouseEvent) {
    // The gain of *this* press is read before dispatching; nothing floats if it adds nothing.
    const gain = game.primaryAction.gain;
    const observing = game.primaryAction.id === 'observe';
    if (dispatch({ type: 'primaryAction' }) !== 'applied' || (!gain && !observing)) return;
    const text = gain
      ? gainText(gain, formatAmount)
      : (OBSERVE_GAINS[observed++ % OBSERVE_GAINS.length] ?? '+1 boredom');
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const fromPointer = event.detail > 0 && rect.width > 0;
    const x = fromPointer ? (event.clientX - rect.left) / rect.width : 0.5;
    nextGainId += 1;
    gains = [
      ...gains.slice(-(MAX_FLOATING - 1)),
      { id: nextGainId, text, x: Math.min(0.9, Math.max(0.1, x)) },
    ];
  }

  async function buy(id: UpgradeId) {
    const index = game.offers.findIndex((offer) => offer.id === id);
    dispatch({ type: 'buyUpgrade', id });
    await tick();
    // A discovery takes over the screen; afterwards the player is back at the code.
    if (game.announcement) offersOpen = false;
    // Keep focus predictable when the bought card disappears: next card, else primary action.
    const cards = (sheet ?? controls)?.querySelectorAll<HTMLButtonElement>('.offer');
    const target = cards?.[Math.min(index, (cards?.length ?? 1) - 1)];
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      (target ?? controls?.querySelector<HTMLButtonElement>('.primary'))?.focus();
    }
  }

  /** Decision cards with a confirmation text ask once, inline, before committing. */
  let confirming = $state<ChoiceId | null>(null);
  let confirmingRestart = $state(false);

  function choose(id: ChoiceId, confirm: string | null) {
    if (confirm && confirming !== id) {
      confirming = id;
      return;
    }
    confirming = null;
    dispatch({ type: 'choose', id });
  }

  function chooseOffer(offer: OfferViewModel) {
    if (offer.kind === 'choice') choose(offer.id, offer.confirm);
  }

  /** The window whose release wheel is showing (only right after shipping; never on reload). */
  let wheelWindow = $state<number | null>(null);
  const wheel = $derived(
    wheelWindow !== null && game.lastRelease?.window === wheelWindow ? game.lastRelease : null,
  );

  async function ship() {
    if (dispatch({ type: 'shipRelease' }) !== 'applied') return;
    offersOpen = false;
    await tick();
    wheelWindow = game.lastRelease?.window ?? null;
  }

  async function closeWheel() {
    wheelWindow = null;
    await tick();
    controls?.querySelector<HTMLButtonElement>('.offer, .primary')?.focus();
  }

  /** "+12", "−0.4": a signed, compact number for the impact line. */
  function signed(value: number): string {
    const size = Math.abs(value);
    const text = size >= 10 ? formatAmount(size) : String(Number(size.toFixed(size < 1 ? 2 : 1)));
    return `${value < 0 ? '−' : '+'}${text}`;
  }

  function restart() {
    confirmingRestart = false;
    dispatch({ type: 'restart' });
  }

  function acknowledge(id: TechnologyId) {
    dispatch({ type: 'acknowledgeUnlock', id });
  }
</script>

<section class="game-view" aria-label="Game">
  {#snippet effectLine(effects: readonly string[])}
    {#if effects.length > 0}
      <span class="offer-effects" data-testid="offer-effects">▸ {effects.join(' · ')}</span>
    {/if}
  {/snippet}
  {#snippet offerList()}
    <ul class="offers" aria-label="Upgrades">
      {#each game.offers as offer (offer.id)}
        <li>
          {#if offer.kind === 'upgrade'}
            <button
              type="button"
              class="offer"
              disabled={!offer.affordable}
              aria-describedby="offer-{offer.id}-desc"
              onclick={() => buy(offer.id)}
            >
              <span class="card-icon" aria-hidden="true">
                {#if offer.illustrationId && illustrationUrl(offer.illustrationId)}
                  <img
                    class="pixelated"
                    src={illustrationUrl(offer.illustrationId)}
                    alt=""
                    width="48"
                    height="36"
                  />
                {:else}
                  <PixelIcon map={cardIcon(offer.id)} scale={3} />
                {/if}
              </span>
              <span class="offer-text">
                <span class="offer-title">{offer.title}</span>
                <span class="offer-desc" id="offer-{offer.id}-desc"
                  >{#if offer.tokens}<strong>+{formatAmount(offer.tokens)} tokens.</strong>
                  {/if}{offer.description}</span
                >
                {@render effectLine(offer.effects)}
                {#if offer.impact && (Math.abs(offer.impact.codePerSecond) >= 0.05 || Math.abs(offer.impact.debtPerSecond) >= 0.05)}
                  <span class="offer-impact" data-testid="offer-impact"
                    >≈ {#if Math.abs(offer.impact.codePerSecond) >= 0.05}{signed(
                        offer.impact.codePerSecond,
                      )} code/s{/if}{#if Math.abs(offer.impact.codePerSecond) >= 0.05 && Math.abs(offer.impact.debtPerSecond) >= 0.05}
                      ·
                    {/if}{#if Math.abs(offer.impact.debtPerSecond) >= 0.05}{signed(
                        offer.impact.debtPerSecond,
                      )} debt/s{/if} right now</span
                  >
                {/if}
              </span>
              <span class="price"
                >{#if offer.currency === 'revenue'}${:else}<span
                    class="currency"
                    aria-hidden="true"
                    data-testid="price-code-icon"><PixelIcon map={CODE_ICON} scale={2} /></span
                  >{/if}{formatAmount(offer.price)}</span
              >
            </button>
          {:else if offer.kind === 'release'}
            <button
              type="button"
              class="offer release"
              data-release={offer.window}
              disabled={!offer.affordable}
              aria-describedby="release-{offer.window}-desc"
              onclick={ship}
            >
              <span class="card-icon" aria-hidden="true"
                ><PixelIcon map={RELEASE_ICON} scale={3} /></span
              >
              <span class="offer-text">
                <span class="offer-title">{offer.title}</span>
                <span class="offer-desc" id="release-{offer.window}-desc">{offer.description}</span>
                {@render effectLine(offer.effects)}
              </span>
              <span class="price ship"
                ><span class="amount"
                  ><span class="currency" aria-hidden="true" data-testid="price-code-icon"
                    ><PixelIcon map={CODE_ICON} scale={2} /></span
                  >{formatAmount(offer.price)}</span
                ><span class="ship-label">SHIP</span></span
              >
            </button>
          {:else if confirming === offer.id}
            <div class="offer choice confirm" role="group" aria-label="Confirm {offer.title}">
              <span class="offer-text">
                <span class="offer-title">{offer.title}</span>
                <span class="offer-desc">{offer.confirm}</span>
              </span>
              <span class="confirm-actions">
                <button type="button" class="yes" onclick={() => chooseOffer(offer)}>YES</button>
                <button type="button" class="no" onclick={() => (confirming = null)}>NO</button>
              </span>
            </div>
          {:else}
            <button
              type="button"
              class="offer choice"
              data-choice={offer.id}
              aria-describedby="choice-{offer.id}-desc"
              onclick={() => chooseOffer(offer)}
            >
              <span class="card-icon" aria-hidden="true"
                ><PixelIcon map={DECISION_ICON} scale={3} /></span
              >
              <span class="offer-text">
                <span class="offer-title">{offer.title}</span>
                <span class="offer-desc" id="choice-{offer.id}-desc">{offer.description}</span>
                {@render effectLine(offer.effects)}
              </span>
              <span class="price choose">DECIDE</span>
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/snippet}
  <div class="world" data-testid="world">
    {@render world?.()}
    {#if game.ending && !wheel}
      <EndingPanel ending={game.ending} {illustrationUrl} />
    {/if}
  </div>
  <div class="controls" bind:this={controls}>
    {#if attention?.level && onCatOverlay}
      {#key attention.key}
        <CatOverlay
          level={attention.level}
          variant={attention.key}
          surfaces={{ cards: game.offers.length > 0, log: game.log.length > 0 }}
          {sprites}
          onOpen={onCatOverlay}
        />
      {/key}
    {/if}
    {#if game.ending}
      {#if confirmingRestart}
        <div class="confirm" role="group" aria-label="Confirm new run">
          <p>This replaces the current run with a new one. Discovered endings are kept.</p>
          <button type="button" class="primary" onclick={restart}>START NEW RUN</button>
          <button type="button" class="cancel" onclick={() => (confirmingRestart = false)}
            >CANCEL</button
          >
        </div>
      {:else}
        <button type="button" class="primary" onclick={() => (confirmingRestart = true)}>
          NEW RUN…
        </button>
      {/if}
    {:else}
      <div class="primary-host">
        <button type="button" class="primary" data-testid="primary-action" onclick={primary}>
          <span class="action-icon" aria-hidden="true"
            ><PixelIcon map={ACTION_ICONS[game.primaryAction.id]} scale={3} /></span
          >{game.primaryAction.label}
        </button>
        <FloatingGains {gains} onDone={(id) => (gains = gains.filter((g) => g.id !== id))} />
      </div>
    {/if}
    <Stats stats={game.stats} onOpen={onSetup} />
    {#if game.credit && !game.ending}
      {@const credit = game.credit}
      <!-- Running on borrowed money: how much is owed, and how long until the bank stops. -->
      <div class="credit" data-testid="credit" role="status">
        <span class="credit-text"
          >🏦 CREDIT ${formatAmount(credit.owed)} / ${formatAmount(
            credit.limit,
          )}{#if credit.secondsLeft !== null}
            · ~{Math.ceil(credit.secondsLeft)} s left{:else}
            · recovering{/if}</span
        >
        <span class="credit-bar" aria-hidden="true"
          ><span
            class="credit-fill"
            style:width="{Math.min(100, (credit.owed / Math.max(1, credit.limit)) * 100)}%"
          ></span></span
        >
      </div>
    {/if}
    {#if game.offers.length > 0 && !game.ending}
      {#if compactOffers}
        <!-- Small screens: the cards live in a popup so the world keeps its room. -->
        <button
          type="button"
          class="offers-toggle"
          class:affordable={affordable > 0}
          data-testid="offers-toggle"
          data-affordable={affordable}
          aria-haspopup="dialog"
          aria-expanded={offersOpen}
          aria-label="Upgrades: {game.offers
            .length} cards, {affordable} affordable, {decisions} decisions"
          onclick={() => (offersOpen = true)}
        >
          <!-- Compact chips on one line: their appearing never re-wraps the button. -->
          <span class="toggle-title">UPGRADES</span>
          <span class="toggle-count">{game.offers.length}</span>
          {#if affordable > 0}
            <span class="toggle-ready" data-testid="offers-affordable" title="affordable now"
              ><span class="currency" aria-hidden="true"
                ><PixelIcon map={CODE_ICON} scale={2} /></span
              >{affordable}</span
            >
          {/if}
          {#if decisions > 0}<span class="toggle-decision" title="decisions"
              ><span class="currency" aria-hidden="true"
                ><PixelIcon map={DECISION_ICON} scale={2} /></span
              >{decisions}</span
            >{/if}
          <span class="toggle-open" aria-hidden="true">▲</span>
        </button>
      {:else}
        {@render offerList()}
      {/if}
    {/if}
    {#if game.log.length > 0}
      <ol class="log" aria-label="Recent events">
        {#each game.log as line, i (i)}
          {#if i === game.log.length - 1}
            <!-- The newest line flashes in, so a purchase visibly lands in the terminal. -->
            {#key `${line.activeMs}|${line.text}|${game.log.length}`}
              <li class="fresh" data-testid="log-fresh">
                <span class="time">[{formatActiveTime(line.activeMs)}]</span>
                {line.text}
              </li>
            {/key}
          {:else}
            <li><span class="time">[{formatActiveTime(line.activeMs)}]</span> {line.text}</li>
          {/if}
        {/each}
      </ol>
    {/if}
  </div>
  {#if compactOffers && offersOpen && game.offers.length > 0 && !game.ending}
    <div
      class="offers-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrades"
      data-testid="offers-sheet"
      bind:this={sheet}
    >
      <div class="sheet-head">
        <button type="button" class="sheet-close" onclick={() => (offersOpen = false)}
          >← BACK TO CODE</button
        >
        <h2>UPGRADES</h2>
      </div>
      <Stats stats={game.stats} onOpen={onSetup} />
      {@render offerList()}
    </div>
  {/if}
  {#if wheel}
    <ReleaseWheel {wheel} {reducedMotion} sound={onSound} onDone={closeWheel} />
  {/if}
  <!-- A discovery takes over everything below the header (which stays usable). -->
  {#if !game.ending && game.announcement}
    {@const announcement = game.announcement}
    <UnlockAnnouncement
      {announcement}
      illustrationUrl={illustrationUrl(announcement.illustrationId)}
      onAcknowledge={() => acknowledge(announcement.id)}
    />
  {/if}
</section>

<style>
  .game-view {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
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
    min-width: 0;
    gap: 8px;
    padding: 10px 10px max(10px, env(safe-area-inset-bottom));
  }
  .primary-host {
    position: relative;
    display: flex;
    flex-direction: column;
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
  .credit {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px 8px;
    border: 2px solid #c0392b;
    background: color-mix(in srgb, #e8483c 14%, var(--panel));
    font-size: 12px;
    font-weight: 900;
  }
  .credit-bar {
    position: relative;
    height: 6px;
    border: 1px solid var(--border);
    background: var(--bar-track);
  }
  .credit-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: #e8483c;
  }
  .offers-toggle {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    min-width: 0;
    white-space: nowrap;
    min-height: 48px;
    padding: 0 12px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 900;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .toggle-count {
    min-width: 22px;
    padding: 1px 6px;
    border: 2px solid var(--border);
    background: var(--panel);
  }
  .offers-toggle.affordable {
    border-color: var(--accent-strong);
    background: color-mix(in srgb, var(--accent) 22%, var(--panel-strong));
    animation: nudge 1.6s ease-in-out infinite;
  }
  @keyframes nudge {
    50% {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .offers-toggle.affordable {
      animation: none;
    }
  }
  .toggle-ready {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 12px;
  }
  .toggle-decision {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 6px;
    border: 2px dashed var(--border);
    font-size: 12px;
  }
  .toggle-open {
    margin-left: auto;
    font-size: 12px;
  }
  .offers-sheet {
    position: absolute;
    inset: 0;
    z-index: 35;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 10px max(12px, env(safe-area-inset-bottom));
    overflow-y: auto;
    background: var(--panel);
  }
  .sheet-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sheet-head h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.1em;
  }
  .sheet-close {
    min-height: 44px;
    padding: 0 12px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
    cursor: pointer;
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
  .card-icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 36px;
  }
  .card-icon img {
    width: 48px;
    height: 36px;
    border: 2px solid var(--border);
  }
  .action-icon {
    display: inline-grid;
    vertical-align: middle;
    margin-right: 10px;
  }
  .offer-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .offer-title {
    font-weight: 800;
  }
  .offer-desc {
    font-size: 14px;
    color: var(--ink-soft);
  }
  .offer-impact {
    font-size: 12px;
    font-weight: 800;
    color: var(--ink);
  }
  /* What the card does to the game, generated from its real effects. */
  .offer-effects {
    font-size: 12px;
    font-weight: 800;
    color: var(--accent-strong);
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
  .offer.choice {
    border-style: dashed;
  }
  .offer.release {
    border-color: #c99a1e;
    background: color-mix(in srgb, #f6c945 18%, var(--panel));
  }
  .ship {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .currency {
    display: inline-flex;
    vertical-align: middle;
    margin-right: 2px;
  }
  .amount {
    white-space: nowrap;
  }
  .ship-label {
    font-size: 11px;
    letter-spacing: 0.08em;
  }
  .choose {
    font-size: 11px;
  }
  .confirm {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .confirm p {
    margin: 0;
    font-size: 13px;
  }
  .confirm-actions {
    display: flex;
    gap: 6px;
  }
  .confirm-actions button,
  .cancel {
    min-height: 44px;
    min-width: 56px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 900;
    cursor: pointer;
  }
  .yes {
    background: var(--health) !important;
    color: #fff;
  }
  .log .fresh {
    animation: fresh 0.9s ease-out;
  }
  @keyframes fresh {
    0% {
      background: color-mix(in srgb, var(--accent) 55%, transparent);
      transform: translateX(-4px);
    }
    100% {
      background: transparent;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .log .fresh {
      animation: none;
    }
  }
  .log {
    list-style: none;
    margin: 0;
    padding: 6px 8px 8px;
    max-height: 7.5em;
    overflow: hidden;
    /* The newest line sits fully visible at the bottom; older ones clip at the top. */
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: var(--log-bg);
    color: var(--log-ink);
    font-size: 12px;
    line-height: 1.45;
  }
  .log li {
    flex: none;
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
