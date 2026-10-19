<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { BuildRowViewModel, DeckItemViewModel, DeckViewModel } from '../game/deck';
  import type { ProjectBadge, ProjectViewModel } from '../game/projectViews';
  import type { ChoiceOfferViewModel } from '../game/selectors';
  import type { Dispatch, Moment, UiSound } from './contracts';
  import { formatAmount, formatCountdown, formatEta } from './format';
  import PixelIcon from './PixelIcon.svelte';
  import {
    cardIcon,
    DECISION_ICON,
    DEMO_ICON,
    GIG_ICON,
    JOB_ICON,
    RELEASE_ICON,
    SEARCH_ICON,
    STAT_ICONS,
  } from './cardIcons';
  import {
    APPEAR_INERT_MS,
    arrivalReady,
    isTap,
    MOVED_INERT_MS,
    NEW_SEEN_MS,
    peekIndex,
    reconcileLane,
  } from './buildLane';

  interface Props {
    deck: DeckViewModel;
    dispatch: Dispatch;
    /** Wide screens: the lane wraps into rows instead of scrolling. */
    wrap?: boolean;
    reducedMotion?: boolean;
    moments?: readonly Moment[];
    illustrationUrl?: (illustrationId: string) => string | null;
    /** The release or a demo is ready and was tapped: offer SHIP / RUN. */
    onReady: (key: 'release' | 'demo') => void;
    /** A decision was tapped: show it in full. */
    onDecide: (choice: ChoiceOfferViewModel) => void;
    onSound?: ((id: UiSound) => void) | undefined;
    /** Open: the lane is grown into cards over the world. */
    expanded?: boolean;
    /** Why it is open: the title of the build just completed (null: opened by hand). */
    built?: string | null;
    /** Open or close the cards (with the title of what was just built, if that is why). */
    onExpanded: (open: boolean, built: string | null) => void;
  }

  const {
    deck,
    dispatch,
    wrap = false,
    reducedMotion = false,
    moments = [],
    illustrationUrl = () => null,
    onReady,
    onDecide,
    onSound,
    expanded = false,
    built = null,
    onExpanded,
  }: Props = $props();

  const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
  const frame = (callback: () => void): number | null =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(callback) : null;

  // ---- Order: the thumb's map of the lane (§6.3) ----
  let laneEl: HTMLElement | undefined = $state();
  let order = $state<string[] | null>(null);
  /** A pick's displaced build comes back at the picked item's index. */
  const place = new Map<string, number>();
  const present = $derived(deck.lane.map((i) => i.key));
  const byKey = $derived(new Map(deck.lane.map((i) => [i.key, i])));
  const items = $derived(
    (order ?? present).flatMap((key) => {
      const item = byKey.get(key);
      return item ? [item] : [];
    }),
  );
  /** Every title seen recently, for "✓ X BUILT" after X has left the deck. */
  const titles = new Map<string, string>();
  $effect(() => {
    for (const row of deck.builds) titles.set(row.item.key, row.item.title);
    for (const item of deck.lane) titles.set(item.key, item.title);
  });

  let root: HTMLElement | undefined = $state();

  function laneButtons(): HTMLElement[] {
    return laneEl ? [...laneEl.querySelectorAll<HTMLElement>('[data-lane-key]')] : [];
  }

  /** The chip or the expanded card of an item (whichever is showing). */
  function itemElement(key: string): HTMLElement | null {
    // Keys are ids like `auto-refill-v1` or `choice:keep-manual`; quote-safe is enough.
    const id = key.replace(/["\\]/g, '\\$&');
    return (
      root?.querySelector<HTMLElement>(`[data-lane-key="${id}"], [data-lane-card="${id}"]`) ?? null
    );
  }

  /** Where new items go: the first one not fully visible (the end on a wrapped lane). */
  function insertIndex(): number {
    const buttons = laneButtons();
    if (wrap || !laneEl || buttons.length === 0) return Number.MAX_SAFE_INTEGER;
    const view = laneEl.getBoundingClientRect();
    if (view.width <= 0) return Number.MAX_SAFE_INTEGER;
    return peekIndex(
      buttons.map((el) => el.getBoundingClientRect().right),
      view.right,
    );
  }

  // ---- Arrivals (§8.2): queued, one at a time, never while the player aims ----
  const queue: string[] = [];
  const pending = new SvelteSet<string>();
  const landing = new SvelteSet<string>();
  const fresh = new SvelteSet<string>();
  const shining = new SvelteSet<string>();
  const seenMs = new Map<string, number>();
  const aim = { pressing: false, lastTouchMs: -1e9, lastArrivalMs: -1e9 };
  let movedUntil = 0;
  /** An auto-scroll just moved the items: taps wait (§6.5). */
  let movedInert = $state(false);
  let loop: number | null = null;
  let lastLoop = 0;

  function enqueue(key: string) {
    if (!queue.includes(key)) queue.push(key);
    if (!reducedMotion) pending.add(key);
    fresh.add(key);
    seenMs.set(key, 0);
    run();
  }

  function run() {
    if (loop !== null) return;
    lastLoop = now();
    loop = frame(step);
  }

  function step() {
    loop = null;
    const t = now();
    const dt = Math.min(250, t - lastLoop);
    lastLoop = t;
    // NEW goes once the item has been fully visible for a while.
    let watching = false;
    if (fresh.size > 0) {
      for (const key of [...fresh]) {
        if (pending.has(key)) continue;
        const el = itemElement(key);
        const host = el?.closest('ul');
        if (!el || !host) {
          if (!byKey.has(key)) fresh.delete(key);
          continue;
        }
        const view = host.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const visible = box.left >= view.left - 1 && box.right <= view.right + 1;
        if (!visible) continue;
        watching = true;
        const seen = (seenMs.get(key) ?? 0) + dt;
        seenMs.set(key, seen);
        if (seen >= NEW_SEEN_MS) fresh.delete(key);
      }
    }
    while (queue.length > 0 && arrivalReady(aim, t)) {
      const key = queue.shift();
      if (key === undefined || !byKey.has(key)) continue;
      land(key, t);
      break;
    }
    if (movedInert && t >= movedUntil) movedInert = false;
    // Idle while nothing is due: a scroll or a new item wakes the loop again.
    if (queue.length > 0 || watching || movedInert) loop = frame(step);
  }

  function land(key: string, t: number) {
    pending.delete(key);
    aim.lastArrivalMs = t;
    const el = itemElement(key);
    const host = el?.closest('ul');
    if (el && host && !wrap) {
      const view = host.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const delta =
        box.right > view.right
          ? box.right - view.right + 8
          : box.left < view.left
            ? box.left - view.left - 8
            : 0;
      if (delta !== 0) {
        host.scrollBy?.({ left: delta, behavior: reducedMotion ? 'auto' : 'smooth' });
        movedUntil = t + MOVED_INERT_MS + (reducedMotion ? 0 : 300);
        movedInert = true;
      }
    }
    if (!reducedMotion) landing.add(key);
    onSound?.('pop');
  }

  // Reconcile before the DOM changes: the peek is measured on what the player sees now.
  $effect.pre(() => {
    const keys = present;
    untrack(() => {
      const result = reconcileLane(order, keys, insertIndex(), place);
      place.clear();
      if (
        order === null ||
        result.order.length !== order.length ||
        result.order.some((k, i) => k !== order?.[i])
      ) {
        order = result.order;
      }
      for (const key of result.added) enqueue(key);
    });
  });

  // A release or demo turning READY gets the same scroll-to; a money card turning affordable
  // shines once.
  const notable = new Map<string, string>();
  $effect(() => {
    for (const item of deck.lane) {
      const ready =
        (item.kind === 'release' && item.release.affordable) ||
        (item.kind === 'demo' && item.demo.affordable);
      const affordable = item.kind === 'upgrade' && !item.offer.project && item.offer.affordable;
      const state = `${ready ? 'r' : ''}${affordable ? 'a' : ''}`;
      const before = notable.get(item.key);
      notable.set(item.key, state);
      if (before === undefined) continue;
      untrack(() => {
        if (ready && !before.includes('r')) enqueue(item.key);
        if (state !== before && (ready || affordable)) shining.add(item.key);
      });
    }
  });

  // ---- Edge counters (§6.4) ----
  let hiddenLeft = $state(0);
  let hiddenRight = $state(0);
  let freshLeft = $state(false);
  let freshRight = $state(false);
  function measureEdges() {
    if (!laneEl || wrap) {
      hiddenLeft = hiddenRight = 0;
      freshLeft = freshRight = false;
      return;
    }
    const view = laneEl.getBoundingClientRect();
    let left = 0;
    let right = 0;
    let newLeft = false;
    let newRight = false;
    for (const el of laneButtons()) {
      const box = el.getBoundingClientRect();
      const key = el.dataset.laneKey ?? '';
      if (box.width <= 0) continue;
      if (box.right > view.right + 1) {
        right += 1;
        newRight ||= fresh.has(key);
      } else if (box.left < view.left - 1) {
        left += 1;
        newLeft ||= fresh.has(key);
      }
    }
    hiddenLeft = left;
    hiddenRight = right;
    freshLeft = newLeft;
    freshRight = newRight;
  }
  $effect(() => {
    void items.length;
    void fresh.size;
    void expanded;
    measureEdges();
    if (fresh.size > 0) untrack(run);
  });
  $effect(() => {
    if (!laneEl || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureEdges());
    observer.observe(laneEl);
    return () => observer.disconnect();
  });

  // The first time the lane overflows in this session it scrolls a little and back, once.
  let hinted = false;
  $effect(() => {
    if (hinted || wrap || reducedMotion || hiddenRight === 0 || !laneEl) return;
    hinted = true;
    const lane = laneEl;
    const start = now();
    const nudge = () => {
      const t = now() - start;
      if (t < 1200) return void frame(nudge);
      lane.scrollBy?.({ left: 40, behavior: 'smooth' });
      const back = () => {
        if (now() - start < 1700) return void frame(back);
        lane.scrollBy?.({ left: -40, behavior: 'smooth' });
      };
      frame(back);
    };
    frame(nudge);
  });

  // ---- Taps (§6.4, §6.5) ----
  // A tap that stops a fling never becomes a click (the browser's own rule), so only drags
  // and inert moments need filtering here.
  let press: { x: number; y: number; moved: boolean } | null = null;
  function onPointerDown(event: PointerEvent) {
    aim.pressing = true;
    aim.lastTouchMs = now();
    press = { x: event.clientX, y: event.clientY, moved: false };
  }
  function onPointerMove(event: PointerEvent) {
    if (press && !isTap(event.clientX - press.x, event.clientY - press.y)) press.moved = true;
  }
  function onPointerUp() {
    aim.pressing = false;
    aim.lastTouchMs = now();
    run();
  }
  function onScroll() {
    aim.lastTouchMs = now();
    measureEdges();
    if (fresh.size > 0) run();
  }
  /** A click counts unless it ended a drag or hit an inert moment. */
  function counts(event: MouseEvent): boolean {
    const pressed = press;
    press = null;
    if (event.detail === 0) return true;
    if (pressed?.moved) return false;
    return !movedInert && now() >= inertUntil;
  }

  // ---- Focus: which slot a pick goes to (two worktrees) ----
  let chosenSlot = $state<number | null>(null);
  const focusSlot = $derived(
    deck.builds.length < 2
      ? 0
      : (chosenSlot ??
          deck.builds.find((b) => b.item.project?.badge === 'auto-half')?.slot ??
          deck.builds[0]?.slot ??
          0),
  );

  function pick(key: string, index: number) {
    const displaced = deck.builds.find((b) => b.slot === focusSlot)?.item.key;
    if (displaced && displaced !== key) place.set(displaced, index);
    const result = dispatch({
      type: 'selectProject',
      id: key as never,
      ...(deck.builds.length > 1 ? { slot: focusSlot } : {}),
    });
    if (result !== 'applied') place.clear();
    chosenSlot = null;
    onExpanded(false, null);
  }

  function activate(item: DeckItemViewModel, index: number, event: MouseEvent) {
    if (!counts(event)) return;
    fresh.delete(item.key);
    switch (item.kind) {
      case 'upgrade':
        if (item.offer.project) pick(item.key, index);
        else dispatch({ type: 'buyUpgrade', id: item.offer.id });
        return;
      case 'release':
        if (item.release.affordable) onReady('release');
        else pick('release', index);
        return;
      case 'demo':
        if (item.demo.affordable) onReady('demo');
        else pick('demo', index);
        return;
      case 'gig':
      case 'job':
        pick(item.key, index);
        return;
      case 'search':
        dispatch({ type: 'searchJob' });
        return;
      case 'choice':
        onDecide(item.choice);
        return;
    }
  }

  function disabled(item: DeckItemViewModel): boolean {
    if (item.kind === 'upgrade') {
      return item.offer.project
        ? item.offer.internal || !item.offer.project.selectable
        : !item.offer.affordable;
    }
    return false;
  }

  function readyKey(row: BuildRowViewModel): 'release' | 'demo' | null {
    if (row.item.kind === 'release' && row.item.release.affordable) return 'release';
    if (row.item.kind === 'demo' && row.item.demo.affordable) return 'demo';
    return null;
  }

  function tapRow(row: BuildRowViewModel) {
    const ready = readyKey(row);
    if (ready) {
      onReady(ready);
      return;
    }
    // A fallback drifting at half speed: one tap confirms it at full speed (projects P3).
    if (row.item.project?.badge === 'auto-half') {
      dispatch({ type: 'selectProject', id: row.item.key as never });
      onExpanded(false, null);
      return;
    }
    if (deck.builds.length > 1) {
      chosenSlot = row.slot;
      onExpanded(true, null);
      return;
    }
    onExpanded(!expanded, null);
  }

  // ---- Expansion (§6.6) ----
  let inertUntil = $state(0);
  let wasExpanded = false;
  $effect(() => {
    if (expanded && !wasExpanded) {
      inertUntil = now() + APPEAR_INERT_MS;
      const clear = () => {
        if (now() < inertUntil) frame(clear);
        else inertUntil = 0;
      };
      frame(clear);
    }
    wasExpanded = expanded;
  });
  const fallback = $derived(deck.builds.some((b) => b.item.project?.badge === 'auto-half'));
  const inert = $derived(inertUntil > 0);

  // A completion that falls back asks "what next?"; from Manager Agent on, the row says who
  // picked instead.
  let seenMoment = untrack(() => moments.at(-1)?.id ?? 0);
  let managerNote = $state<{ text: string; until: number } | null>(null);
  $effect(() => {
    const news = moments.filter((m) => m.id > seenMoment);
    if (news.length === 0) return;
    seenMoment = news.at(-1)?.id ?? seenMoment;
    untrack(() => {
      const done = news.filter((m) => m.kind === 'built');
      const last = done.at(-1);
      if (!last) return;
      if (deck.managed) {
        const auto = deck.builds.find((b) => b.item.project?.badge === 'auto');
        if (auto) managerNote = { text: `Manager picked ${auto.item.title}`, until: now() + 3000 };
        const fade = () => {
          if (managerNote && now() < managerNote.until) frame(fade);
          else managerNote = null;
        };
        frame(fade);
        return;
      }
      if (fallback) {
        onExpanded(true, titles.get(last.key) ?? null);
        if (laneEl && !wrap) laneEl.scrollTo?.({ left: 0 });
      }
    });
  });

  let swipeY: number | null = null;
  function closeExpanded() {
    onExpanded(false, null);
  }

  // ---- Keyboard (§10): arrows walk the lane ----
  function onKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const buttons = laneButtons();
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const next = buttons[at + (event.key === 'ArrowRight' ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  // ---- Words ----
  const BADGES: Record<NonNullable<ProjectBadge>, string> = {
    building: 'BUILDING',
    auto: 'AUTO',
    'auto-half': 'AUTO · ½',
    paused: 'PAUSED',
    employed: 'EMPLOYED',
  };
  function badgeText(project: ProjectViewModel | null): string | null {
    if (!project?.badge) return null;
    if (project.badge === 'paused') return `PAUSED ${Math.floor(project.progress * 100)}%`;
    return BADGES[project.badge];
  }

  /** The short line under an item's title: what it costs, how far, how long. */
  function detail(item: DeckItemViewModel): string {
    switch (item.kind) {
      case 'upgrade': {
        const p = item.offer.project;
        if (!p) return `$${formatAmount(item.offer.price)}`;
        return `${formatAmount(p.code)}/${formatAmount(item.offer.price)} · ${formatEta(p.etaSeconds)}`;
      }
      case 'release': {
        const r = item.release;
        if (r.affordable) return `READY · retire ${Number((r.retireChance * 100).toFixed(2))}%`;
        if (r.project.ready) return 'polishing';
        return `${formatAmount(r.project.code)}/${formatAmount(r.price)} · ${formatEta(r.project.etaSeconds)}`;
      }
      case 'demo': {
        const d = item.demo;
        if (d.affordable) return 'READY · run it';
        return `${formatAmount(d.project.code)}/${formatAmount(d.price)} · ${formatEta(d.project.etaSeconds)}`;
      }
      case 'gig':
        return `$${item.gig.payMin}–${item.gig.payMax} · ${formatEta(item.gig.project.etaSeconds)}`;
      case 'search':
        return `SEARCH ${item.search.done}/${item.search.needed}`;
      case 'job': {
        const j = item.job;
        if (j.tenure?.permanent) return '📜 PERMANENT ✓ · Permanent. Relax.';
        if (j.tenure) {
          return `TRYOUT PERIOD ${j.tenure.paydays}/${j.tenure.of} · $${formatAmount(j.salary)} a month`;
        }
        return `∞ · $${formatAmount(j.salary)} a month · takes all your code${
          j.expiresInSeconds !== null ? ` · ends in ${formatCountdown(j.expiresInSeconds)}` : ''
        }`;
      }
      case 'choice':
        return 'DECIDE';
    }
  }

  /** The longer text an expanded card shows. */
  function description(item: DeckItemViewModel): string {
    switch (item.kind) {
      case 'upgrade':
        return item.offer.description;
      case 'release':
        return item.release.description;
      case 'demo':
        return 'Code a demo. It does nothing. It looks great.';
      case 'gig':
        return 'A paying client. Money for code.';
      case 'search':
        return 'No gigs right now. Each tap looks for one.';
      case 'job':
        return 'Enterprise Solutions Inc. A salary, and all your code.';
      case 'choice':
        return item.choice.description;
    }
  }

  function effects(item: DeckItemViewModel): readonly string[] {
    if (item.kind === 'upgrade') return item.offer.effects;
    if (item.kind === 'choice') return item.choice.effects;
    if (item.kind === 'release') return item.release.effects;
    return [];
  }

  function ready(item: DeckItemViewModel): boolean {
    return (
      (item.kind === 'release' && item.release.affordable) ||
      (item.kind === 'demo' && item.demo.affordable)
    );
  }
</script>

{#snippet icon(item: DeckItemViewModel, scale: number)}
  <span class="item-icon" aria-hidden="true">
    {#if item.kind === 'upgrade'}
      {@const url = item.offer.illustrationId ? illustrationUrl(item.offer.illustrationId) : null}
      {#if url}
        <img class="pixelated" src={url} alt="" width={16 * scale} height={12 * scale} />
      {:else}
        <PixelIcon map={cardIcon(item.offer.id)} {scale} />
      {/if}
    {:else if item.kind === 'release'}
      <PixelIcon map={RELEASE_ICON} {scale} />
    {:else if item.kind === 'demo'}
      <PixelIcon map={DEMO_ICON} {scale} />
    {:else if item.kind === 'gig'}
      <PixelIcon map={GIG_ICON} {scale} />
    {:else if item.kind === 'search'}
      <PixelIcon map={SEARCH_ICON} {scale} />
    {:else if item.kind === 'job'}
      <PixelIcon map={JOB_ICON} {scale} />
    {:else}
      <PixelIcon map={DECISION_ICON} {scale} />
    {/if}
  </span>
{/snippet}

{#snippet bar(project: ProjectViewModel | null)}
  {#if project}
    <span
      class="bar"
      class:half={project.badge === 'auto-half'}
      class:ready={project.ready}
      aria-hidden="true"
      ><span class="fill" style:width="{Math.min(100, project.progress * 100)}%"></span></span
    >
  {/if}
{/snippet}

{#snippet badge(project: ProjectViewModel | null)}
  {@const text = badgeText(project)}
  {#if text}
    <span class="badge" data-badge={project?.badge} data-testid="project-badge">{text}</span>
  {/if}
{/snippet}

{#snippet face(item: DeckItemViewModel, full: boolean)}
  {@render icon(item, full ? 3 : 2)}
  <span class="item-text">
    <span class="item-title">{item.title}</span>
    <span class="item-detail" data-testid="item-detail"
      >{#if item.kind === 'upgrade' && !item.offer.project}<span class="coin" aria-hidden="true"
          >$</span
        >{:else if item.kind === 'upgrade'}<span class="code-icon" aria-hidden="true"
          ><PixelIcon map={STAT_ICONS.code} scale={1} /></span
        >{/if}{detail(item)}</span
    >
    {#if full}
      <span class="item-desc">{description(item)}</span>
      {#if effects(item).length > 0}
        <span class="item-effects" data-testid="offer-effects">▸ {effects(item).join(' · ')}</span>
      {/if}
    {/if}
  </span>
  {@render badge(item.project)}
  {#if fresh.has(item.key) && !pending.has(item.key)}<span class="new" aria-hidden="true">NEW</span
    >{/if}
  {@render bar(item.project)}
{/snippet}

<div class="deck" class:wrap data-testid="build-deck" bind:this={root}>
  {#if expanded}
    <!-- The lane grown into cards, over the world (§6.6). CODE below never moves. -->
    <div class="expanded" data-testid="deck-expanded" role="dialog" aria-label="What next?">
      <button
        type="button"
        class="expanded-head"
        data-testid="deck-close"
        onclick={closeExpanded}
        onpointerdown={(e) => (swipeY = e.clientY)}
        onpointerup={(e) => {
          if (swipeY !== null && e.clientY - swipeY > 40) closeExpanded();
          swipeY = null;
        }}
      >
        <span>{built ? `✓ ${built.toUpperCase()} BUILT · WHAT NEXT?` : 'WHAT NEXT?'}</span>
        <span aria-hidden="true">▼</span>
      </button>
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <ul class="cards" class:inert aria-label="Build lane" onkeydown={onKey}>
        {#each items as item, index (item.key)}
          <li>
            <button
              type="button"
              class="item card"
              class:landing={landing.has(item.key)}
              class:ready={ready(item)}
              class:money={item.kind === 'upgrade' && !item.offer.project}
              class:choice={item.kind === 'choice'}
              data-testid="lane-card"
              data-lane-card={item.key}
              data-kind={item.kind}
              disabled={disabled(item)}
              onclick={(e) => activate(item, index, e)}
              onanimationend={(e) => {
                if (e.animationName.includes('land')) landing.delete(item.key);
              }}
            >
              {@render face(item, true)}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#each deck.builds as row (row.slot)}
    {@const item = row.item}
    <button
      type="button"
      class="row"
      class:focused={deck.builds.length > 1 && focusSlot === row.slot}
      class:half={item.project?.badge === 'auto-half'}
      class:ready={readyKey(row) !== null}
      class:noted={managerNote !== null && item.project?.badge === 'auto'}
      data-testid="build-row"
      data-build-slot={row.slot}
      data-key={item.key}
      aria-label="Building {item.title}: {detail(item)}{badgeText(item.project)
        ? `, ${badgeText(item.project)?.toLowerCase()}`
        : ''}"
      onclick={() => tapRow(row)}
    >
      <span class="row-play" aria-hidden="true">{readyKey(row) ? '★' : '▶'}</span>
      {@render icon(item, 2)}
      <span class="item-text">
        <span class="item-title"
          >{#if item.kind === 'job' && item.job.employed}💼 At work · all code goes to the employer{:else}{item.title}{/if}</span
        >
        <span class="item-detail"
          >{#if managerNote && item.project?.badge === 'auto'}{managerNote.text}{:else if item.project?.badge === 'auto-half' && !item.project.ready}<span
              class="tax"
              data-testid="deck-tax">at ½ while you decide</span
            >
            · {detail(item)}{:else}{detail(item)}{/if}</span
        >
      </span>
      {@render badge(item.project)}
      {@render bar(item.project)}
    </button>
  {/each}

  <div class="lane-host">
    {#if hiddenLeft > 0}
      <span class="edge left" class:dot={freshLeft} aria-hidden="true">◂{hiddenLeft}</span>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <ul
      class="lane"
      class:inert={movedInert}
      class:placeholder={expanded}
      class:empty={items.length === 0}
      aria-label="Build lane"
      data-testid="build-lane"
      bind:this={laneEl}
      onscroll={onScroll}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={onKey}
    >
      {#if !expanded}
        {#each items as item, index (item.key)}
          <li>
            <button
              type="button"
              class="item chip"
              class:pending={pending.has(item.key)}
              class:landing={landing.has(item.key)}
              class:shine={shining.has(item.key)}
              class:ready={ready(item)}
              class:money={item.kind === 'upgrade' && !item.offer.project}
              class:choice={item.kind === 'choice'}
              data-testid="lane-item"
              data-lane-key={item.key}
              data-kind={item.kind}
              disabled={disabled(item)}
              onclick={(e) => activate(item, index, e)}
              onanimationend={(e) => {
                if (e.animationName.includes('land')) landing.delete(item.key);
                if (e.animationName.includes('shine')) shining.delete(item.key);
              }}
            >
              {@render face(item, false)}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
    {#if hiddenRight > 0}
      <span class="edge right" class:dot={freshRight} data-testid="lane-more" aria-hidden="true"
        >▸{hiddenRight}</span
      >
    {/if}
  </div>
</div>

<style>
  .deck {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    min-height: 44px;
    padding: 4px 8px 9px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font: inherit;
    font-weight: 800;
    text-align: left;
    cursor: pointer;
  }
  .row.focused {
    outline: 3px solid var(--accent);
    outline-offset: -6px;
  }
  .row.half {
    border-style: dashed;
  }
  .row.ready {
    border-color: #c99a1e;
    background: color-mix(in srgb, #f6c945 30%, var(--panel));
  }
  .row.noted {
    animation: noted 1.5s ease-out;
  }
  @keyframes noted {
    0% {
      background: color-mix(in srgb, #59b7ff 50%, var(--panel));
    }
  }
  .row-play {
    flex: none;
    font-size: 12px;
  }
  /* The cost of not choosing, said where the choice is. */
  .tax {
    color: #c0392b;
    font-weight: 900;
  }
  .item-icon {
    flex: none;
    display: grid;
    place-items: center;
  }
  .item-icon img {
    border: 2px solid var(--border);
  }
  .item-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .item-title,
  .item-detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .item-title {
    font-size: 13px;
    font-weight: 900;
  }
  .item-detail {
    font-size: 11px;
    font-weight: 800;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
  .code-icon {
    display: inline-flex;
    vertical-align: middle;
    margin-right: 2px;
  }
  .coin {
    margin-right: 1px;
    color: #3f9d4a;
  }
  .item-desc {
    font-size: 12px;
    color: var(--ink-soft);
    white-space: normal;
  }
  .item-effects {
    font-size: 11px;
    font-weight: 800;
    color: var(--accent-strong);
    white-space: normal;
  }
  .badge {
    position: absolute;
    top: -9px;
    right: 6px;
    padding: 0 4px;
    border: 2px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.05em;
    line-height: 13px;
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
  .bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 5px;
    border-top: 1px solid var(--border);
    background: var(--bar-track);
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--accent);
  }
  .bar.ready .fill {
    background: #f6c945;
  }
  .bar.half .fill {
    opacity: 0.45;
    animation: half 2.4s ease-in-out infinite;
  }
  @keyframes half {
    50% {
      opacity: 0.8;
    }
  }

  /* ---- The lane ---- */
  .lane-host {
    position: relative;
    min-width: 0;
  }
  .lane {
    display: flex;
    gap: 6px;
    min-height: 54px;
    margin: 0;
    padding: 9px 0 2px;
    list-style: none;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }
  .lane::-webkit-scrollbar {
    display: none;
  }
  .lane > li {
    /* Two and a half items show: the cut one says "there is more". */
    flex: 0 0 calc((100% - 12px) / 2.55);
    min-width: 0;
    scroll-snap-align: start;
  }
  .deck.wrap .lane {
    flex-wrap: wrap;
    overflow: visible;
  }
  .deck.wrap .lane > li {
    flex: 1 1 180px;
    max-width: 280px;
  }
  .item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 44px;
    padding: 4px 5px 9px;
    border: 3px solid var(--border);
    background: var(--panel);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .item:disabled {
    cursor: not-allowed;
    border-color: var(--disabled);
  }
  .item:disabled .item-title {
    opacity: 0.6;
  }
  .item.money {
    border-color: #3f9d4a;
  }
  .item.choice {
    border-style: dashed;
  }
  .item.ready {
    border-color: #c99a1e;
    background: color-mix(in srgb, #f6c945 34%, var(--panel));
    box-shadow: 0 0 0 2px #f6c945;
  }
  .new {
    position: absolute;
    top: -9px;
    left: 6px;
    padding: 0 4px;
    border: 2px solid var(--border);
    background: #ff5a4e;
    color: #fff;
    font-size: 9px;
    font-weight: 900;
    line-height: 13px;
  }
  /* On the top edge, over the borders: the items' icons and titles stay readable. */
  .edge {
    position: absolute;
    top: 0;
    z-index: 2;
    padding: 1px 4px;
    border: 2px solid var(--border);
    background: var(--panel-strong);
    font-size: 11px;
    font-weight: 900;
    pointer-events: none;
  }
  .edge.left {
    left: -4px;
  }
  .edge.right {
    right: -4px;
  }
  .edge.dot::after {
    content: '';
    position: absolute;
    top: -5px;
    right: -5px;
    width: 8px;
    height: 8px;
    border: 2px solid var(--border);
    background: #ff5a4e;
  }
  .lane.placeholder {
    visibility: hidden;
  }
  /* Nothing to pick yet (the first seconds): the world keeps the room. */
  .lane.empty {
    min-height: 0;
    padding: 0;
  }

  /* ---- Arrival (§8.2) ---- */
  .item.pending {
    opacity: 0.25;
    transform: scale(0.85);
    pointer-events: none;
  }
  .item.landing {
    animation:
      land 320ms cubic-bezier(0.2, 1.4, 0.4, 1) both,
      spotlight 600ms ease-in-out 320ms 2;
  }
  @keyframes land {
    0% {
      opacity: 0;
      transform: translateX(40px) scale(0.6);
    }
    70% {
      opacity: 1;
      transform: translateX(0) scale(1.08);
    }
    100% {
      transform: none;
    }
  }
  @keyframes spotlight {
    50% {
      box-shadow:
        0 0 0 3px #ffe066,
        0 0 14px 4px color-mix(in srgb, #ffe066 70%, transparent);
    }
  }
  .item.landing::before {
    content: '';
    position: absolute;
    inset: -10px;
    pointer-events: none;
    background:
      radial-gradient(circle, #ffe066 0 2px, transparent 3px) 0 0 / 14px 14px,
      radial-gradient(circle, #fff 0 1.5px, transparent 2.5px) 7px 7px / 14px 14px;
    animation: sparkle 520ms ease-out both;
  }
  @keyframes sparkle {
    0% {
      opacity: 1;
      transform: scale(0.6);
    }
    100% {
      opacity: 0;
      transform: scale(1.4);
    }
  }
  .item.shine::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      100deg,
      transparent 30%,
      rgba(255, 255, 255, 0.75) 50%,
      transparent 70%
    );
    background-size: 250% 100%;
    animation: shine 900ms ease-out both;
  }
  @keyframes shine {
    0% {
      background-position: 120% 0;
    }
    100% {
      background-position: -30% 0;
    }
  }
  .inert {
    pointer-events: none;
  }
  .inert .item {
    opacity: 0.7;
  }

  /* ---- Expanded (§6.6) ---- */
  .expanded {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 6px;
    border: 3px solid var(--border);
    background: var(--panel);
    box-shadow: 0 -6px 0 rgba(0, 0, 0, 0.15);
    animation: grow 220ms ease-out both;
  }
  @keyframes grow {
    0% {
      opacity: 0;
      transform: translateY(24px) scale(0.96);
    }
  }
  .expanded-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    background: var(--panel-strong);
    font: inherit;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.06em;
    cursor: pointer;
    touch-action: none;
  }
  .cards {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 10px 0 4px;
    list-style: none;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    overscroll-behavior-x: contain;
  }
  .cards > li {
    flex: 0 0 calc((100% - 8px) / 1.6);
    min-width: 0;
    scroll-snap-align: start;
  }
  .deck.wrap .cards {
    flex-wrap: wrap;
    overflow: visible;
  }
  .deck.wrap .cards > li {
    flex: 1 1 220px;
    max-width: 340px;
  }
  .card {
    align-items: flex-start;
    min-height: 96px;
    padding: 8px 8px 12px;
  }
  .card .item-title {
    white-space: normal;
  }
  .card.ready {
    animation: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .item.landing,
    .item.landing::before,
    .item.shine::after,
    .expanded,
    .row.noted,
    .bar.half .fill {
      animation: none;
    }
    .item.landing {
      outline: 3px solid #ffe066;
    }
  }
  @media (max-height: 700px) {
    .deck {
      gap: 3px;
    }
    .row {
      min-height: 40px;
      padding: 3px 8px 8px;
    }
  }
  /* Short phones: every pixel goes back to the world; chips stay a thumb tall (44 px). */
  @media (max-height: 640px) {
    .row {
      min-height: 36px;
      padding: 2px 6px 7px;
    }
    .row .item-icon {
      display: none;
    }
    .lane {
      min-height: 0;
      padding-top: 8px;
    }
    .item.chip {
      min-height: 44px;
      padding: 3px 4px 8px;
    }
  }
</style>
