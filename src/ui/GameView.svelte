<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import type { ChoiceId, TechnologyId, UpgradeId } from '../game/ids';
  import type { ProjectBadge, ProjectViewModel } from '../game/projectViews';
  import type { GameViewModel, OfferViewModel } from '../game/selectors';
  import type { ProjectKey } from '../game/types';
  import type { Dispatch, DomSpriteSheet, WheelSound } from './contracts';
  import { formatActiveTime, formatAmount, formatCountdown, formatEta } from './format';
  import CatOverlay from './CatOverlay.svelte';
  import EndingPanel from './EndingPanel.svelte';
  import ReleaseWheel from './ReleaseWheel.svelte';
  import UnlockAnnouncement from './UnlockAnnouncement.svelte';
  import FloatingGains from './FloatingGains.svelte';
  import Stats from './Stats.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import {
    ACTION_ICONS,
    cardIcon,
    DECISION_ICON,
    DEMO_ICON,
    GIG_ICON,
    JOB_ICON,
    RELEASE_ICON,
    RENT_ICON,
    SEARCH_ICON,
    STAT_ICONS,
  } from './cardIcons';
  const CODE_ICON = STAT_ICONS.code;
  import { buildSelector, gainText, MAX_FLOATING, type FloatingGain } from './floatingGains';
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
    onSetup,
    onDemo,
  }: Props = $props();
  let offersOpen = $state(false);
  // An ending closes the cards popup; it does not come back open on the next run or a load.
  $effect(() => {
    if (game.ending) offersOpen = false;
  });
  let sheet: HTMLElement | undefined = $state();
  /**
   * What wants the player's attention in the cards: money cards the money pays for now, and
   * builds drifting at half speed (a tap confirms them).
   */
  const affordable = $derived(
    game.offers.filter(
      (o) =>
        o.kind === 'upgrade' &&
        ((o.currency === 'money' && o.affordable) || o.project?.badge === 'auto-half'),
    ).length,
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
    // Faster than the fingers can type: the press fizzles visibly (pacing, not lag).
    const capped = !game.primaryAction.ready && !observing;
    if (dispatch({ type: 'primaryAction' }) !== 'applied' || (!gain && !observing)) return;
    const text = capped
      ? 'typing…'
      : gain
        ? gainText(gain, formatAmount)
        : (OBSERVE_GAINS[observed++ % OBSERVE_GAINS.length] ?? '+1 boredom');
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const fromPointer = event.detail > 0 && rect.width > 0;
    const x = Math.min(
      0.9,
      Math.max(0.1, fromPointer ? (event.clientX - rect.left) / rect.width : 0.5),
    );
    nextGainId += 1;
    gains = [
      ...gains.slice(-(MAX_FLOATING - 1)),
      { id: nextGainId, text, x, ...flight(gain?.unit === 'code' && !capped, rect, x) },
    ];
  }

  /**
   * A press of code flies into the build it fills: the first slot's card or strip, or the
   * cards button while the popup is closed. Nothing to fly to: it simply rises.
   */
  function flight(code: boolean, host: DOMRect, x: number): { to?: { x: number; y: number } } {
    const selector = code ? buildSelector(game.buildTarget) : null;
    if (!selector || !controls || host.width <= 0) return {};
    const into =
      controls.querySelector<HTMLElement>(selector) ??
      controls.querySelector<HTMLElement>('[data-testid="offers-toggle"]');
    const box = into?.getBoundingClientRect();
    if (!box || box.width <= 0) return {};
    return {
      to: {
        x: Math.round(box.left + box.width / 2 - (host.left + host.width * x)),
        y: Math.round(box.top + box.height / 2 - host.top),
      },
    };
  }

  /** Pick a project to build (or confirm one drifting at half speed). */
  function build(id: ProjectKey) {
    dispatch({ type: 'selectProject', id });
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

  async function codeDemo() {
    if (dispatch({ type: 'makeDemo' }) !== 'applied') return;
    offersOpen = false;
    await tick();
    const made = game.demos.at(-1);
    if (made) onDemo?.(made.number);
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

  const BADGES: Record<NonNullable<ProjectBadge>, string> = {
    building: 'BUILDING',
    auto: 'AUTO',
    'auto-half': 'AUTO · ½',
    paused: 'PAUSED',
    employed: 'EMPLOYED',
  };

  function badgeText(project: ProjectViewModel): string | null {
    if (!project.badge) return null;
    if (project.badge === 'paused') return `PAUSED ${Math.floor(project.progress * 100)}%`;
    return BADGES[project.badge];
  }

  /** The release or demo strip's state in words (for its accessible name). */
  function projectWords(project: ProjectViewModel): string {
    const badge = badgeText(project);
    return `${Math.floor(project.progress * 100)}% built${badge ? `, ${badge.toLowerCase()}` : ''}`;
  }
</script>

<section class="game-view" aria-label="Game">
  {#snippet effectLine(effects: readonly string[])}
    {#if effects.length > 0}
      <span class="offer-effects" data-testid="offer-effects">▸ {effects.join(' · ')}</span>
    {/if}
  {/snippet}
  {#snippet badge(project: ProjectViewModel)}
    {@const text = badgeText(project)}
    {#if text}
      <span class="badge" data-badge={project.badge} data-testid="project-badge">{text}</span>
    {/if}
  {/snippet}
  {#snippet bar(project: ProjectViewModel)}
    <!-- The build's fill; a fallback at half speed pulses dimmed (a tap confirms it). -->
    <span
      class="project-bar"
      class:half={project.badge === 'auto-half'}
      class:ready={project.ready}
      aria-hidden="true"
      ><span class="project-fill" style:width="{Math.min(100, project.progress * 100)}%"
      ></span></span
    >
  {/snippet}
  {#snippet shipStrip()}
    {#if game.release && !game.ending}
      {@const r = game.release}
      {@const p = r.project}
      <!-- Ship It has its own strip (outside the three cards): the original project. A tap
           builds it; SHIP is its own button once it is built. -->
      <div
        class="ship-strip"
        class:ready={r.affordable}
        class:half={p.badge === 'auto-half'}
        data-release={r.window}
        data-testid="ship-strip"
      >
        <button
          type="button"
          class="strip-body"
          data-testid="ship-build"
          aria-label="{r.title}: {projectWords(p)}, {formatAmount(r.price)} code{r.shippable
            ? `, ${Number((r.retireChance * 100).toFixed(2))}% chance to retire`
            : ''}"
          onclick={() => build('release')}
        >
          <span class="ship-icon" aria-hidden="true"
            ><PixelIcon map={RELEASE_ICON} scale={2} /></span
          >
          <!-- Short: the version and the build; the full story is in the accessible name. -->
          <span class="ship-text"
            >{r.shippable ? r.version : 'Project'}
            {formatAmount(p.code)}/{formatAmount(r.price)}{#if r.affordable}
              · retire {Number((r.retireChance * 100).toFixed(2))}%{:else if p.ready}
              · polishing{/if}</span
          >
          {@render badge(p)}
          {@render bar(p)}
        </button>
        {#if r.shippable}
          <button
            type="button"
            class="ship-go"
            data-testid="ship-go"
            disabled={!r.affordable}
            onclick={ship}>SHIP</button
          >
        {/if}
      </div>
    {/if}
  {/snippet}
  {#snippet demoStrip()}
    {#if game.demo && !game.ending}
      {@const d = game.demo}
      {@const p = d.project}
      <!-- Code a demo: a cosmetic build next to Ship It; RUN shows it once it is built. -->
      <div
        class="ship-strip demo-strip"
        class:ready={d.affordable}
        class:half={p.badge === 'auto-half'}
        data-demo={d.number}
        data-testid="demo-strip"
      >
        <button
          type="button"
          class="strip-body"
          data-testid="demo-build"
          aria-label="{d.title} number {d.number}: {projectWords(p)}, {formatAmount(d.price)} code"
          onclick={() => build('demo')}
        >
          <span class="ship-icon" aria-hidden="true"><PixelIcon map={DEMO_ICON} scale={2} /></span>
          <span class="ship-text">#{d.number} {formatAmount(p.code)}/{formatAmount(d.price)}</span>
          {@render badge(p)}
          {@render bar(p)}
        </button>
        <button
          type="button"
          class="ship-go"
          data-testid="demo-go"
          disabled={!d.affordable}
          onclick={codeDemo}>RUN</button
        >
      </div>
    {/if}
  {/snippet}
  {#snippet moneyStrip()}
    {#if game.money && !game.ending}
      {@const m = game.money}
      <!-- Money: the balance, rent day, and the gig board (or the search for one). -->
      <div class="money-strip" class:broke={m.balance < 0} data-testid="money-strip">
        <span class="money-head">
          <span class="money-balance" data-testid="money-balance">${formatAmount(m.balance)}</span>
          {#if m.rentInSeconds !== null && m.rent !== null}
            <span class="rent" data-testid="rent-due"
              ><span class="currency" aria-hidden="true"
                ><PixelIcon map={RENT_ICON} scale={2} /></span
              >${m.rent} in {formatCountdown(m.rentInSeconds)}{#if m.missedStreak > 0}
                · missed ×{m.missedStreak}{/if}</span
            >
          {/if}
        </span>
        {#if m.employed}
          <span class="gig-note">💼 Employed: no gigs.</span>
        {:else if m.gig}
          {@const g = m.gig}
          <button
            type="button"
            class="gig"
            data-testid="gig"
            aria-label="Gig: {g.title}, pays ${g.payMin}–{g.payMax}, {projectWords(g.project)}"
            onclick={() => build('gig')}
          >
            <span class="currency" aria-hidden="true"><PixelIcon map={GIG_ICON} scale={2} /></span>
            <span class="gig-text"
              >{g.title} · ${g.payMin}–{g.payMax} · {formatEta(g.project.etaSeconds)}</span
            >
            {@render badge(g.project)}
            {@render bar(g.project)}
          </button>
        {:else if m.search}
          <button
            type="button"
            class="gig search"
            data-testid="search-job"
            onclick={() => dispatch({ type: 'searchJob' })}
          >
            <span class="currency" aria-hidden="true"
              ><PixelIcon map={SEARCH_ICON} scale={2} /></span
            >
            <span class="gig-text" aria-label="No gigs: search for a job"
              >SEARCH {m.search.done}/{m.search.needed}</span
            >
          </button>
        {/if}
      </div>
    {/if}
  {/snippet}
  {#snippet jobCard()}
    {#if game.job && !game.ending}
      {@const j = game.job}
      <button
        type="button"
        class="offer job"
        class:employed={j.employed}
        data-testid="job-card"
        aria-describedby="job-desc"
        onclick={() => build('job')}
      >
        <span class="card-icon" aria-hidden="true"><PixelIcon map={JOB_ICON} scale={3} /></span>
        <span class="offer-text">
          <span class="offer-title">{j.title}</span>
          <span class="offer-desc" id="job-desc"
            >${formatAmount(j.salary)} a month. Takes all your code.{#if j.expiresInSeconds !== null}{' '}Offer
              ends in {formatCountdown(j.expiresInSeconds)}.{/if}</span
          >
          {#if j.tenure}
            {#if j.tenure.permanent}
              <span class="tenure permanent" data-testid="job-permanent"
                >📜 PERMANENT ✓ · Permanent. Relax.</span
              >
            {:else}
              <span class="tenure" data-testid="job-tryout"
                >TRYOUT PERIOD {j.tenure.paydays}/{j.tenure.of}<span
                  class="tryout"
                  aria-hidden="true"
                  >{#each Array.from({ length: j.tenure.of }, (_, i) => i) as i (i)}<span
                      class="segment"
                      class:full={i < j.tenure.paydays}
                      style:--part={i === j.tenure.paydays ? j.tenure.monthFraction : 0}
                    ></span>{/each}</span
                ></span
              >
            {/if}
          {/if}
          {@render badge(j.project)}
        </span>
        <span class="price" data-testid="job-price">∞</span>
      </button>
    {/if}
  {/snippet}
  {#snippet offerList()}
    <ul class="offers" aria-label="Upgrades">
      {#each game.offers as offer (offer.id)}
        <li>
          {#if offer.kind === 'upgrade'}
            {@const project = offer.project}
            <button
              type="button"
              class="offer"
              class:project={project !== null}
              class:half={project?.badge === 'auto-half'}
              class:internal={offer.internal}
              data-offer={offer.id}
              disabled={project ? offer.internal || !project.selectable : !offer.affordable}
              aria-describedby="offer-{offer.id}-desc"
              onclick={() => (project ? build(offer.id) : buy(offer.id))}
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
                >{#if offer.currency === 'money'}${:else}<span
                    class="currency"
                    aria-hidden="true"
                    data-testid="price-code-icon"><PixelIcon map={CODE_ICON} scale={2} /></span
                  >{/if}{formatAmount(offer.price)}{#if project}<span class="eta"
                    >{formatEta(project.etaSeconds)}</span
                  >{/if}</span
              >
              {#if project}
                {@render badge(project)}
                {@render bar(project)}
              {/if}
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
    {#if game.ending && !wheel && !game.rentWheel}
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
        <button
          type="button"
          class="primary"
          data-testid="primary-action"
          data-ready={game.primaryAction.ready}
          onclick={primary}
        >
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
    {@render moneyStrip()}
    {@render jobCard()}
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
    {#if (game.release || game.demo) && !game.ending}
      <div class="strips">
        {@render shipStrip()}
        {@render demoStrip()}
      </div>
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
  .ship-strip {
    display: flex;
    align-items: stretch;
    gap: 6px;
    min-height: 40px;
    padding: 2px;
    border: 2px dashed #c99a1e;
    background: color-mix(in srgb, #f6c945 10%, var(--panel));
    font-size: 13px;
    font-weight: 800;
  }
  .strip-body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 9px 4px 8px;
    border: 0;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .ship-go:disabled {
    cursor: not-allowed;
    color: var(--ink-soft);
    opacity: 0.6;
  }
  .ship-strip.ready {
    border-style: solid;
    background: color-mix(in srgb, #f6c945 30%, var(--panel));
  }
  /* Progress text changes every step: one line, never a re-wrap. */
  .ship-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .strips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .strips > .ship-strip {
    flex: 1 1 140px;
    min-width: 0;
  }
  .demo-strip {
    border-color: #7d6ff0;
    background: color-mix(in srgb, #7d6ff0 10%, var(--panel));
  }
  .demo-strip.ready {
    background: color-mix(in srgb, #7d6ff0 28%, var(--panel));
  }
  .ship-go {
    flex: none;
    align-self: center;
    min-height: 32px;
    cursor: pointer;
    padding: 2px 4px;
    border: 2px solid var(--border);
    background: var(--panel-strong);
    font-size: 11px;
    letter-spacing: 0.08em;
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
  /* A fixed width: the ETA under the price changes every step and must never re-wrap the card. */
  .price {
    flex: none;
    width: 64px;
    padding: 4px 2px;
    text-align: center;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    border: 2px solid var(--border);
    background: var(--panel-strong);
  }
  .offer.choice {
    border-style: dashed;
  }
  /* Projects: a build's fill along the bottom edge and a badge on the top edge. */
  .offer.project,
  .strip-body,
  .gig {
    position: relative;
    padding-bottom: 10px;
  }
  .offer.internal {
    border-style: dotted;
  }
  .badge {
    position: absolute;
    top: -9px;
    right: 8px;
    padding: 0 5px;
    border: 2px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.06em;
    line-height: 14px;
  }
  .badge[data-badge='auto'] {
    background: #59b7ff;
    color: #10202e;
  }
  .badge[data-badge='auto-half'] {
    background: var(--panel-strong);
    color: var(--ink);
    border-style: dashed;
  }
  .badge[data-badge='paused'] {
    background: var(--panel-strong);
    color: var(--ink-soft);
  }
  .badge[data-badge='employed'] {
    background: #c0392b;
    color: #fff;
  }
  .project-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 5px;
    border-top: 1px solid var(--border);
    background: var(--bar-track);
  }
  .project-fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--accent);
  }
  .project-bar.ready .project-fill {
    background: #f6c945;
  }
  /* A fallback build at half speed: dimmed, slowly pulsing — tap it to build at full speed. */
  .project-bar.half .project-fill {
    opacity: 0.45;
    animation: half 2.4s ease-in-out infinite;
  }
  @keyframes half {
    50% {
      opacity: 0.8;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .project-bar.half .project-fill {
      animation: none;
    }
  }
  .eta {
    display: block;
    font-size: 10px;
    font-weight: 800;
    color: var(--ink-soft);
  }
  /* One row: balance and rent day on the left, the gig (or SEARCH) filling the rest. */
  .money-strip {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 3px 4px;
    border: 2px solid #3f9d4a;
    background: color-mix(in srgb, #4caf50 10%, var(--panel));
    font-size: 13px;
    font-weight: 800;
  }
  .money-strip.broke {
    border-color: #c0392b;
    background: color-mix(in srgb, #e8483c 12%, var(--panel));
  }
  .money-head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 1px;
    line-height: 1.1;
  }
  .money-balance {
    font-size: 15px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }
  .money-strip.broke .money-balance {
    color: #c0392b;
  }
  .rent {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .gig {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 4px 6px 10px;
    border: 2px solid var(--border);
    background: var(--panel);
    font-weight: 800;
    text-align: left;
    cursor: pointer;
  }
  .gig.search {
    border-style: dashed;
  }
  .gig-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
  }
  .gig-note {
    flex: 1;
    min-width: 0;
    color: var(--ink-soft);
  }
  .offer.job {
    position: relative;
    border-color: #c0392b;
    background: color-mix(in srgb, #c0392b 8%, var(--panel));
  }
  .tenure {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.05em;
  }
  .tenure.permanent {
    color: #8a5a00;
  }
  .tryout {
    display: flex;
    gap: 2px;
  }
  .segment {
    flex: 1;
    height: 6px;
    border: 1px solid var(--border);
    background: linear-gradient(
      to right,
      var(--accent) calc(var(--part, 0) * 100%),
      var(--bar-track) calc(var(--part, 0) * 100%)
    );
  }
  .segment.full {
    background: var(--accent);
  }
  .currency {
    display: inline-flex;
    vertical-align: middle;
    margin-right: 2px;
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
    flex: none;
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
    .controls {
      gap: 6px;
    }
    .ship-strip {
      min-height: 34px;
    }
    .log {
      max-height: 4.5em;
    }
    .log li:nth-last-child(n + 4) {
      display: none;
    }
  }
  /* Short phones: the world keeps its share; the terminal shows its two newest lines. */
  @media (max-height: 700px) {
    .controls {
      gap: 5px;
      padding-top: 6px;
    }
    .primary {
      min-height: 48px;
    }
    .offers-toggle {
      min-height: 44px;
    }
    .log {
      max-height: 3.4em;
    }
    .ship-strip {
      min-height: 34px;
    }
    .money-strip .gig {
      min-height: 34px;
    }
  }
  /* Narrow phones: the strips keep their numbers, the icons step aside. */
  @media (max-width: 400px) {
    .strips .ship-icon {
      display: none;
    }
    .ship-go {
      font-size: 10px;
      padding: 2px 3px;
    }
  }
</style>
