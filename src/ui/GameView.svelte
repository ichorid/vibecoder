<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import type { TechnologyId } from '../game/ids';
  import type { DeckItemViewModel, MomentTier } from '../game/deck';
  import type { ChoiceOfferViewModel, GameViewModel } from '../game/selectors';
  import type { Dispatch, DomSpriteSheet, Moment, Payout, UiSound } from './contracts';
  import { formatActiveTime, formatAmount } from './format';
  import BuildDeck from './BuildDeck.svelte';
  import CatOverlay from './CatOverlay.svelte';
  import Celebration from './Celebration.svelte';
  import type { Burst } from './celebration';
  import ChoicePopup from './ChoicePopup.svelte';
  import EndingPanel from './EndingPanel.svelte';
  import ReadyPopup from './ReadyPopup.svelte';
  import ReleaseWheel from './ReleaseWheel.svelte';
  import TokenGauge from './TokenGauge.svelte';
  import UnlockAnnouncement from './UnlockAnnouncement.svelte';
  import FloatingGains from './FloatingGains.svelte';
  import Stats from './Stats.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import { ACTION_ICONS } from './cardIcons';
  import {
    buildSelector,
    gainText,
    MAX_FLOATING,
    observeText,
    type FloatingGain,
  } from './floatingGains';
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
    onSound?: ((id: UiSound) => void) | undefined;
    /** Small screens: the build lane scrolls; wide screens: it wraps into rows. */
    compactOffers?: boolean;
    /** Money just earned: each new one pops a golden "+$x" into the balance. */
    payouts?: readonly Payout[];
    /** Completions: each new one is a ta-da (and a ready release asks to ship). */
    moments?: readonly Moment[];
    /** Opens the Setup view (from the stats panel). */
    onSetup?: () => void;
    /** Shows a coded demo (right after coding it). */
    onDemo?: (number: number) => void;
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
    payouts = [],
    moments = [],
    onSetup,
    onDemo,
  }: Props = $props();
  let controls: HTMLElement | undefined = $state();
  let press: HTMLButtonElement | undefined = $state();

  let gains = $state<FloatingGain[]>([]);

  /** The terminal: it stays on the newest line while the player has not scrolled up. */
  let terminal: HTMLElement | undefined = $state();
  let following = true;
  $effect(() => {
    void game.log.at(-1);
    void game.log.length;
    if (terminal && following) terminal.scrollTop = terminal.scrollHeight;
  });

  /** Golden "+$x" for money earned: it pops under the balance and flies up into it. */
  let earned = $state<FloatingGain[]>([]);
  let statsBar: HTMLElement | undefined = $state();
  // Payouts from before this view existed are old news.
  let seenPayout = untrack(() => payouts.at(-1)?.id ?? 0);
  $effect(() => {
    const fresh = payouts.filter((p) => p.id > seenPayout);
    if (fresh.length === 0) return;
    seenPayout = fresh[fresh.length - 1]?.id ?? seenPayout;
    const x = untrack(moneyX);
    earned = [
      ...untrack(() => earned).slice(-(MAX_FLOATING - fresh.length)),
      ...fresh.map((p) => ({
        id: p.id,
        text: `+$${formatAmount(p.amount)}`,
        x,
        y: 0.5,
        tone: 'earn' as const,
      })),
    ];
  });
  /** The balance's place in the stats bar, 0–1 (the middle when it cannot be measured). */
  function moneyX(): number {
    const cell = statsBar?.querySelector<HTMLElement>('[data-testid="stat-money"]');
    const bar = statsBar?.getBoundingClientRect();
    const box = cell?.getBoundingClientRect();
    if (!bar || !box || bar.width <= 0) return 0.5;
    return (box.left + box.width / 2 - bar.left) / bar.width;
  }
  let nextGainId = 0;

  let observed = 0;
  /** The press label pulses until the first press here, so a new player sees what to tap. */
  let pressed = $state(false);

  function primary(event: MouseEvent) {
    // The gain of *this* press is read before dispatching; nothing floats if it adds nothing.
    const gain = game.primaryAction.gain;
    const observing = game.primaryAction.id === 'observe';
    if (dispatch({ type: 'primaryAction' }) !== 'applied' || (!gain && !observing)) return;
    pressed = true;
    const target = event.currentTarget as HTMLElement;
    const text = gain ? gainText(gain, formatAmount) : observeText(observed++);
    const rect = target.getBoundingClientRect();
    const fromPointer = event.detail > 0 && rect.width > 0;
    const x = Math.min(
      0.9,
      Math.max(0.1, fromPointer ? (event.clientX - rect.left) / rect.width : 0.5),
    );
    nextGainId += 1;
    gains = [
      ...gains.slice(-(MAX_FLOATING - 1)),
      { id: nextGainId, text, x, ...flight(gain?.unit === 'code', rect, x) },
    ];
  }

  /** A press of code flies into the build row it fills. Nothing to fly to: it simply rises. */
  function flight(code: boolean, host: DOMRect, x: number): { to?: { x: number; y: number } } {
    const selector = code ? buildSelector(game.buildTarget) : null;
    if (!selector || !controls || host.width <= 0) return {};
    const box = controls.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
    if (!box || box.width <= 0) return {};
    return {
      to: {
        x: Math.round(box.left + box.width / 2 - (host.left + host.width * x)),
        y: Math.round(box.top + box.height / 2 - host.top),
      },
    };
  }

  /** The window whose release wheel is showing (only right after shipping; never on reload). */
  let wheelWindow = $state<number | null>(null);
  const wheel = $derived(
    wheelWindow !== null && game.lastRelease?.window === wheelWindow ? game.lastRelease : null,
  );

  // ---- The build deck (docs/feature_build_deck.md) ----
  let deckOpen = $state(false);
  let deckBuilt = $state<string | null>(null);
  /** The release or demo whose SHIP / RUN is being offered (§9). */
  let asking = $state<'release' | 'demo' | null>(null);
  /** A decision opened from the lane. */
  let deciding = $state<ChoiceOfferViewModel | null>(null);
  const readyRelease = $derived(
    asking === 'release' && game.release?.affordable ? game.release : null,
  );
  const readyDemo = $derived(asking === 'demo' && game.demo?.affordable ? game.demo : null);
  const overlaid = $derived(
    game.announcement !== null || game.notice !== null || game.rentWheel !== null || wheel !== null,
  );
  // An ending closes everything the deck opened.
  $effect(() => {
    if (!game.ending) return;
    deckOpen = false;
    asking = null;
    deciding = null;
  });

  /** Titles and first effects of what the deck showed, for the ta-da after it is gone. */
  const known = new Map<string, { title: string; effect: string | null }>();
  function remember(item: DeckItemViewModel) {
    const effect =
      item.kind === 'upgrade' ? (item.offer.effects[0] ?? null) : item.kind === 'gig' ? null : null;
    known.set(item.key, { title: item.title, effect });
  }
  $effect(() => {
    for (const row of game.deck.builds) remember(row.item);
    for (const item of game.deck.lane) remember(item);
  });

  // ---- Ta-da (§8.1) ----
  let bursts = $state<Burst[]>([]);
  let fxHost: HTMLElement | undefined = $state();
  let burstId = 0;
  let lastBurstAt = -1e9;
  let lastBigAt = -1e9;
  let shaking = $state(false);
  const clock = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
  const LOWER: Record<MomentTier, MomentTier | null> = { S: 'A', A: 'B', B: null };

  function celebrate(wanted: MomentTier, text: string) {
    const t = clock();
    let tier: MomentTier | null = wanted;
    // Two completions within 3 s: the second plays one tier lower; never two big ones at once.
    if (t - lastBurstAt < 3000) tier = LOWER[wanted];
    if (tier === 'S' && t - lastBigAt < 1700) tier = 'A';
    if (!tier) return;
    // From Manager Agent on, an upgrade is a flash of the bar and the float only.
    if (tier === 'A' && game.deck.managed && wanted === 'A') tier = 'B';
    lastBurstAt = t;
    if (tier === 'S') lastBigAt = t;
    const fx = fxHost?.getBoundingClientRect();
    const statsBottom = statsBar?.getBoundingClientRect().bottom ?? 0;
    const height = fx?.height ?? 0;
    burstId += 1;
    const burst: Burst = {
      id: burstId,
      tier,
      text: tier === 'B' && wanted !== 'B' ? text : tier === 'B' ? '' : text,
      x: tier === 'B' && wanted === 'B' ? moneyX() : 0.5,
      y:
        tier === 'B' && wanted === 'B' && fx && height > 0
          ? Math.min(0.9, (statsBottom - fx.top) / height)
          : 0.96,
    };
    bursts = [...bursts.slice(-2), burst];
    onSound?.(tier === 'S' ? 'fanfare' : tier === 'A' ? 'built' : 'coin');
    if (tier === 'S' && !reducedMotion) {
      shaking = true;
    }
  }

  /** Wait about `ms` (in animation frames: the UI owns no timers). */
  function after(ms: number, then: () => void) {
    const start = clock();
    if (typeof requestAnimationFrame !== 'function') return then();
    const wait = () => (clock() - start < ms ? requestAnimationFrame(wait) : then());
    requestAnimationFrame(wait);
  }

  let seenMoment = untrack(() => moments.at(-1)?.id ?? 0);
  $effect(() => {
    const fresh = moments.filter((m) => m.id > seenMoment);
    if (fresh.length === 0) return;
    seenMoment = fresh.at(-1)?.id ?? seenMoment;
    untrack(() => {
      for (const moment of fresh) {
        const what = known.get(moment.key);
        if (moment.kind === 'ready') {
          celebrate('S', '');
          const key = moment.key === 'demo' ? 'demo' : 'release';
          // The popup opens as the fireworks peak (§8.1).
          after(300, () => {
            if ((key === 'release' ? game.release : game.demo)?.affordable) asking = key;
          });
          continue;
        }
        const text =
          moment.tier === 'S'
            ? `${(what?.title ?? 'Built').toUpperCase()}!`
            : moment.tier === 'A'
              ? (what?.effect ?? `${what?.title ?? 'Built'} ✓`)
              : '';
        celebrate(moment.tier, text);
      }
    });
  });

  // ---- Tokens (§7) ----
  let tokenState: string | null = null;
  $effect(() => {
    const state = game.deck.tokens?.state ?? null;
    const before = tokenState;
    tokenState = state;
    if (before === null || state === before) return;
    if (state === 'low' || state === 'empty' || state === 'noMoney') {
      if (before === 'full' || before === 'low') untrack(() => onSound?.('warn'));
    }
  });
  const stalled = $derived(
    game.deck.tokens?.state === 'empty' || game.deck.tokens?.state === 'noMoney',
  );
  /** No money for tokens: take the gig (or search for one). */
  const earn = $derived.by(() => {
    if (game.deck.lane.some((i) => i.kind === 'gig')) {
      return () => {
        dispatch({ type: 'selectProject', id: 'gig' });
      };
    }
    if (game.deck.lane.some((i) => i.kind === 'search')) {
      return () => {
        dispatch({ type: 'searchJob' });
      };
    }
    return null;
  });

  async function ship() {
    if (dispatch({ type: 'shipRelease' }) !== 'applied') return;
    asking = null;
    deckOpen = false;
    await tick();
    wheelWindow = game.lastRelease?.window ?? null;
  }

  async function codeDemo() {
    if (dispatch({ type: 'makeDemo' }) !== 'applied') return;
    asking = null;
    deckOpen = false;
    await tick();
    const made = game.demos.at(-1);
    if (made) onDemo?.(made.number);
  }

  /** Later: the release waits as READY in the lane; meanwhile, what next? */
  function later() {
    asking = null;
    deckBuilt = null;
    deckOpen = true;
  }

  async function closeWheel() {
    const shipped = wheel;
    wheelWindow = null;
    if (shipped && !shipped.result.jackpot) celebrate('S', 'SHIPPED!');
    await tick();
    press?.focus();
  }

  let confirmingRestart = $state(false);

  function restart() {
    confirmingRestart = false;
    dispatch({ type: 'restart' });
  }

  function acknowledge(id: TechnologyId) {
    dispatch({ type: 'acknowledgeUnlock', id });
  }
</script>

<section class="game-view" aria-label="Game">
  <!-- The counters head the screen, right under the navbar, above the world. -->
  <div class="stats-bar" bind:this={statsBar}>
    <Stats stats={game.stats} onOpen={onSetup} />
    <FloatingGains gains={earned} onDone={(id) => (earned = earned.filter((g) => g.id !== id))} />
  </div>
  <div
    class="world"
    class:shake={shaking}
    data-testid="world"
    onanimationend={(e) => {
      if (e.animationName.includes('shake')) shaking = false;
    }}
  >
    {@render world?.()}
    {#if stalled && !game.ending}
      <div class="idle" data-testid="agents-idle" role="status">💤 AGENTS IDLE · NO TOKENS</div>
    {/if}
    {#if game.ending && !wheel && !game.rentWheel}
      <EndingPanel ending={game.ending} {illustrationUrl} />
    {/if}
    {#if !game.ending && !overlaid}
      {#if readyRelease}
        <ReadyPopup kind="release" release={readyRelease} onGo={ship} onLater={later} />
      {:else if readyDemo}
        <ReadyPopup kind="demo" demo={readyDemo} onGo={codeDemo} onLater={later} />
      {:else if deciding}
        {@const choice = deciding}
        <ChoicePopup
          {choice}
          onChoose={() => {
            // Read the decision before closing: `choice` follows `deciding`.
            const id = choice.id;
            deciding = null;
            dispatch({ type: 'choose', id });
          }}
          onClose={() => (deciding = null)}
        />
      {/if}
    {/if}
  </div>
  {#if !game.ending && !readyRelease && !readyDemo && !deciding}
    <!-- No CODE bar at the bottom edge (a long thumb reach): a tap anywhere on the world that no
         object answers is the press. This label names it at the world's foot; it is a press too,
         and the keyboard's (next after the world in tab order). It sits outside the world, so a code
         gain can fly into its build. -->
    <div class="press-host">
      <button
        type="button"
        class="press"
        class:hint={!pressed}
        data-testid="primary-action"
        bind:this={press}
        onclick={primary}
      >
        <span class="action-icon" aria-hidden="true"
          ><PixelIcon map={ACTION_ICONS[game.primaryAction.id]} scale={2} /></span
        >{game.primaryAction.label}
      </button>
      <FloatingGains {gains} onDone={(id) => (gains = gains.filter((g) => g.id !== id))} />
    </div>
  {/if}
  <div class="controls" bind:this={controls}>
    {#if attention?.level && onCatOverlay}
      {#key attention.key}
        <CatOverlay
          level={attention.level}
          variant={attention.key}
          surfaces={{ cards: game.deck.lane.length > 0, log: game.log.length > 0 }}
          {sprites}
          onOpen={onCatOverlay}
        />
      {/key}
    {/if}
    {#if game.log.length > 0}
      <!-- The terminal scrolls through the remembered lines; it follows the newest one unless
           the player has scrolled up to read. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="log"
        role="region"
        aria-label="Recent events"
        tabindex="0"
        bind:this={terminal}
        onscroll={() => {
          if (terminal) {
            following = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 8;
          }
        }}
      >
        <ol>
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
      </div>
    {/if}
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
    {#if !game.ending}
      {#if game.deck.tokens}
        <TokenGauge
          gauge={game.deck.tokens}
          onReload={() => dispatch({ type: 'buyUpgrade', id: 'token-supply' })}
          onEarn={earn}
        />
      {/if}
      <BuildDeck
        deck={game.deck}
        {dispatch}
        wrap={!compactOffers}
        {reducedMotion}
        {moments}
        {illustrationUrl}
        {onSound}
        expanded={deckOpen}
        built={deckBuilt}
        onExpanded={(open: boolean, built: string | null) => {
          deckOpen = open;
          deckBuilt = built;
        }}
        onReady={(key: 'release' | 'demo') => (asking = key)}
        onDecide={(choice: ChoiceOfferViewModel) => (deciding = choice)}
      />
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
    {/if}
  </div>
  <!-- The ta-da plays over the counters and the world, never over the deck or CODE (§8). -->
  <div class="fx" bind:this={fxHost}>
    <Celebration {bursts} onDone={(id) => (bursts = bursts.filter((b) => b.id !== id))} />
  </div>
  {#if wheel}
    <ReleaseWheel {wheel} {reducedMotion} sound={onSound} onDone={closeWheel} />
  {:else if game.rentWheel}
    {#key game.rentWheel.index}
      <ReleaseWheel
        wheel={game.rentWheel}
        variant="rent"
        {reducedMotion}
        sound={onSound}
        onDone={() => dispatch({ type: 'acknowledgeRentWheel' })}
      />
    {/key}
  {/if}
  <!-- A discovery takes over everything below the header (which stays usable). -->
  {#if !game.ending && game.announcement}
    {@const announcement = game.announcement}
    <UnlockAnnouncement
      {announcement}
      illustrationUrl={illustrationUrl(announcement.illustrationId)}
      onAcknowledge={() => acknowledge(announcement.id)}
    />
  {:else if !game.ending && game.notice && !game.rentWheel}
    {@const notice = game.notice}
    <!-- Market updates and milestones use the same panel as a discovery. -->
    <UnlockAnnouncement
      announcement={{ title: notice.title, description: notice.text }}
      kicker={notice.kicker}
      illustrationUrl={notice.illustrationId ? illustrationUrl(notice.illustrationId) : null}
      onAcknowledge={() => dispatch({ type: 'acknowledgeNotice' })}
    />
  {/if}
</section>

<style>
  .game-view {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: 100%;
    min-height: 0;
  }
  .stats-bar {
    grid-row: 1;
    grid-column: 1;
    position: relative;
    padding: 4px 10px;
    border-bottom: 3px solid var(--border);
  }
  .world {
    grid-row: 2;
    grid-column: 1;
    position: relative;
    min-height: 120px;
    overflow: hidden;
    border-bottom: 3px solid var(--border);
    background: var(--panel-strong);
  }
  .world.shake {
    animation: shake 360ms steps(6) both;
  }
  @keyframes shake {
    20% {
      transform: translate(-4px, 2px);
    }
    40% {
      transform: translate(4px, -2px);
    }
    60% {
      transform: translate(-3px, -2px);
    }
    80% {
      transform: translate(3px, 2px);
    }
    100% {
      transform: none;
    }
  }
  /* No tokens: the agents sleep (the world says so, not just a number). */
  .idle {
    position: absolute;
    top: 8px;
    left: 50%;
    z-index: 5;
    transform: translateX(-50%);
    padding: 2px 8px;
    border: 2px solid #c0392b;
    background: color-mix(in srgb, #e8483c 22%, var(--panel));
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.06em;
    white-space: nowrap;
    pointer-events: none;
  }
  /* Over the counters and the world (the first two rows), never over the controls. */
  .fx {
    grid-row: 1 / 3;
    grid-column: 1;
    position: relative;
    pointer-events: none;
    z-index: 45;
  }
  .controls {
    grid-row: 3;
    grid-column: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 6px;
    padding: 8px 10px max(10px, env(safe-area-inset-bottom));
  }
  .press-host {
    grid-row: 2;
    grid-column: 1;
    align-self: end;
    justify-self: center;
    position: relative;
    z-index: 6;
    display: flex;
    margin-bottom: 12px;
    pointer-events: none;
  }
  /* A caption, not a bar: the world around it is the button. */
  .press {
    min-height: 36px;
    padding: 0 12px;
    border: 2px solid var(--border);
    background: color-mix(in srgb, var(--panel) 72%, transparent);
    color: var(--ink);
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.08em;
    cursor: pointer;
    user-select: none;
    touch-action: manipulation;
    pointer-events: auto;
  }
  .press:active {
    transform: translateY(1px);
  }
  .press:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
  /* Until the first press: say it is a tap (CSS text, so the label stays the action's name). */
  .press.hint::before {
    content: 'TAP · ';
    color: var(--accent-strong);
    animation: hint 1.2s ease-in-out infinite;
  }
  @keyframes hint {
    50% {
      opacity: 0.35;
    }
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
    touch-action: manipulation;
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
  .action-icon {
    display: inline-grid;
    vertical-align: middle;
    margin-right: 8px;
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
  .cancel {
    min-height: 44px;
    min-width: 56px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 900;
    cursor: pointer;
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
    .log .fresh,
    .press.hint::before,
    .world.shake {
      animation: none;
    }
  }
  /* The terminal: a fixed-height window that scrolls (it starts at the newest line). */
  .log {
    max-height: 5.9em;
    flex: none;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 8px 6px;
    background: var(--log-bg);
    color: var(--log-ink);
    font-size: 12px;
    line-height: 1.45;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--log-ink) 40%, transparent) transparent;
  }
  .log:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
  .log ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .time {
    opacity: 0.7;
  }
  /* Phones: the world keeps its share; the terminal is one or two lines tall (it scrolls). */
  @media (max-height: 900px) {
    .log {
      max-height: 3.4em;
    }
  }
  @media (max-height: 700px) {
    .controls {
      gap: 5px;
      padding-top: 6px;
    }
    .primary {
      min-height: 48px;
      font-size: 18px;
    }
    .log {
      max-height: 2em;
      padding: 2px 8px;
    }
  }
  @media (max-height: 640px) {
    .controls {
      gap: 4px;
      padding-top: 4px;
      padding-bottom: max(6px, env(safe-area-inset-bottom));
    }
    .primary {
      min-height: 46px;
    }
    /* One line of the terminal (it still scrolls). */
    .log {
      max-height: 1.6em;
      padding: 1px 8px;
    }
  }
</style>
