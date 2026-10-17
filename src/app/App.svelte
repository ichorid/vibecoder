<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CatView from '../ui/CatView.svelte';
  import DemoScreen from '../ui/DemoScreen.svelte';
  import {
    unavailableAudio,
    type AudioControls,
    type PresentationClock,
    type Theme,
    type ThemePreference,
    type UiGameApi,
    type ViewId,
  } from '../ui/contracts';
  import GameView from '../ui/GameView.svelte';
  import Header from '../ui/Header.svelte';
  import HistoryView from '../ui/HistoryView.svelte';
  import SetupView from '../ui/SetupView.svelte';
  import SettingsMenu from '../ui/SettingsMenu.svelte';
  import type { RendererFactory, WorldStatus, WorldTap } from '../world/host';
  import type { UiSnapshot } from '../ui/contracts';
  import { gainText } from '../ui/floatingGains';
  import { formatAmount } from '../ui/format';
  import WorldCanvas from '../world/WorldCanvas.svelte';
  import { describeScene } from '../content/world';
  import { RELEASE_COMMENTS_ATTRIBUTION } from '../content/releaseComments';
  import { atlasUrl, memorialUrls } from './assetUrls';
  import { loadDomSheet } from './domSheet';
  import { APP_VERSION } from './version';
  import type { DomSpriteSheet, WheelSound } from '../ui/contracts';

  interface Props {
    api: UiGameApi;
    illustrationUrl: (illustrationId: string) => string | null;
    navigation?: History;
    /** Injected in component tests; production lazily loads the Pixi renderer. */
    createRenderer?: RendererFactory;
    audio?: AudioControls;
    clock: PresentationClock;
  }

  const {
    api,
    illustrationUrl,
    navigation = window.history,
    createRenderer,
    audio = unavailableAudio,
    clock,
  }: Props = $props();

  let view = $state<ViewId>('game');
  let reducedMotion = $state(false);
  /** Phone-sized viewports (portrait, or a short landscape screen). */
  const SMALL_SCREEN = '(max-width: 699px), (max-height: 599px)';
  let compactOffers = $state(false);
  /** DOM sprites share the world atlas; inline fallbacks show until it loads. */
  let sprites = $state<DomSpriteSheet | null>(null);

  // Depend on the theme alone: reading `$api` here would re-run (and re-fetch the atlas, and
  // hand every DOM sprite a new sheet) on every game snapshot.
  const preference = $derived($api.profile.theme);
  /** The system's colour scheme, followed live while the preference is `auto`. */
  let systemDark = $state(false);
  const theme = $derived<Theme>(
    preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference,
  );
  $effect(() => {
    const themeToLoad = theme;
    let current = true;
    void loadDomSheet(themeToLoad).then((sheet) => {
      if (current && sheet) sprites = sheet;
    });
    return () => {
      current = false;
    };
  });
  /** World graphics: while the context is gone the game is paused (nothing can starve unseen). */
  let worldStatus = $state<WorldStatus>('ok');
  let retryWorld: () => void = () => {};
  function onWorldStatus(status: WorldStatus) {
    worldStatus = status;
    api.dispatch({ type: status === 'ok' ? 'graphicsResume' : 'graphicsPause' });
  }
  /** The snapshot right now (the store publishes synchronously after every command). */
  function current(): UiSnapshot {
    let snapshot: UiSnapshot | undefined;
    api.subscribe((s) => (snapshot = s))();
    if (!snapshot) throw new Error('game store has no snapshot');
    return snapshot;
  }

  const FEED_TEXT: Record<string, string> = {
    nom: 'fed',
    notHungry: 'fed',
    tooMuch: 'too much!',
    spherical: 'spherical!',
  };

  /**
   * Taps on world objects are ordinary commands: the poster is a primary press, the bowl is FEED,
   * the cat is PET (its cooldown applies; a tap during it is only a meow).
   */
  /** Room jokes, said in turn (the first one is the classic). */
  const ROOM_JOKES = {
    poster: [
      '+1 motivation (does nothing)',
      '+1 inspiration (expired)',
      '+1 hustle (unpaid)',
      '+0 code, +1 vibes',
      '+1 grindset (non-refundable)',
      'just one more. again.',
    ],
    shelf: ['no time for that', 'no time for that either', 'later. maybe. no.'],
    window: ['maybe other time', 'maybe some other time', 'the sun can wait'],
  } as const;
  const jokeTurns: Record<keyof typeof ROOM_JOKES, number> = { poster: 0, shelf: 0, window: 0 };
  function joke(target: keyof typeof ROOM_JOKES): string {
    const lines = ROOM_JOKES[target];
    const line = lines[jokeTurns[target] % lines.length] ?? lines[0];
    jokeTurns[target] += 1;
    return line;
  }

  function onWorldTap(tap: WorldTap): string | null {
    switch (tap.target) {
      case 'poster':
      case 'shelf':
      case 'window':
        return joke(tap.target);
      case 'monitor': {
        // The monitor is where the work happens: tapping it is the main action.
        const gain = current().game.primaryAction.gain;
        if (api.dispatch({ type: 'primaryAction' }) !== 'applied' || !gain) return null;
        return gainText(gain, formatAmount);
      }
      case 'plant': {
        if (api.dispatch({ type: 'waterPlant' }) !== 'applied') return 'too late for that';
        const look = current().world.plant;
        return look === 'dead' ? 'oops' : look === 'soggy' ? 'glug (soggy)' : 'glug';
      }
      case 'bowl': {
        if (api.dispatch({ type: 'feedCat' }) !== 'applied') return null;
        return FEED_TEXT[current().cat.careNote ?? 'nom'] ?? 'fed';
      }
      case 'cat':
        return api.dispatch({ type: 'petCat' }) === 'applied' ? 'purr' : 'meow';
    }
  }

  /**
   * The coded demo showing, and whether it was just coded (then the next demo can be designed
   * under it) or is a replay from History (then it is only watched).
   */
  let watching = $state<{ number: number; fresh: boolean } | null>(null);
  const watched = $derived(
    watching === null ? null : ($api.game.demos.find((d) => d.number === watching?.number) ?? null),
  );
  /** Dev server only: the Demo lab (Vite drops the import from production builds). */
  const loadDemoLab = import.meta.env.DEV ? () => import('../ui/DemoLab.svelte') : null;
  let demoLabOpen = $state(false);
  const designDemo = (pick: number | null) => api.dispatch({ type: 'designDemo', pick });

  let settingsOpen = $state(false);
  let settingsButton: HTMLElement | null = null;

  const VIEW_KEY = 'vibeView';

  function stateView(state: unknown): ViewId {
    if (typeof state === 'object' && state !== null && VIEW_KEY in state) {
      const value = (state as Record<string, unknown>)[VIEW_KEY];
      if (value === 'history' || value === 'cat' || value === 'setup') return value;
    }
    return 'game';
  }

  /** Navigating away from Cat ends a PLAY session (no completion bonus). */
  function leavePlay() {
    if ($api.cat.play) api.dispatch({ type: 'leaveCatPlay' });
  }

  function open(next: 'history' | 'cat' | 'setup') {
    settingsOpen = false;
    if (view === next) return;
    if (view === 'cat') leavePlay();
    if (view === 'game') navigation.pushState({ [VIEW_KEY]: next }, '');
    else navigation.replaceState({ [VIEW_KEY]: next }, '');
    view = next;
  }

  function returnToGame() {
    if (view === 'cat') leavePlay();
    if (stateView(navigation.state) !== 'game') navigation.back();
    view = 'game';
  }

  async function closeSettings() {
    settingsOpen = false;
    await tick();
    settingsButton?.focus();
  }

  function toggleSettings(event: MouseEvent) {
    settingsButton = event.currentTarget as HTMLElement;
    settingsOpen = !settingsOpen;
  }

  function setTheme(theme: ThemePreference) {
    api.dispatch({ type: 'setTheme', theme });
  }

  onMount(() => {
    // A reload opens Game, unless a saved PLAY attempt is in progress: it resumes in Cat.
    if (stateView(navigation.state) !== 'game') navigation.replaceState(null, '');
    if ($api.cat.play) {
      navigation.pushState({ [VIEW_KEY]: 'cat' }, '');
      view = 'cat';
    }
    const onPop = (event: PopStateEvent) => {
      const next = stateView(event.state);
      if (view === 'cat' && next !== 'cat') leavePlay();
      view = next;
    };
    window.addEventListener('popstate', onPop);
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      reducedMotion = motion?.matches ?? false;
    };
    onMotion();
    motion?.addEventListener('change', onMotion);
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onScheme = () => {
      systemDark = scheme?.matches ?? false;
    };
    onScheme();
    scheme?.addEventListener('change', onScheme);
    // Phones: the upgrade cards move into a popup so the world is not squeezed.
    const small = window.matchMedia?.(SMALL_SCREEN);
    const onSmall = () => {
      compactOffers = small?.matches ?? false;
    };
    onSmall();
    small?.addEventListener('change', onSmall);
    return () => {
      window.removeEventListener('popstate', onPop);
      motion?.removeEventListener('change', onMotion);
      small?.removeEventListener('change', onSmall);
      scheme?.removeEventListener('change', onScheme);
    };
  });

  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });
</script>

<div class="app" data-view={view}>
  <Header
    cat={$api.cat}
    {sprites}
    {settingsOpen}
    version={APP_VERSION}
    onCat={() => open('cat')}
    onHistory={() => open('history')}
    onSettings={toggleSettings}
  />
  <main class="main">
    {#if settingsOpen}
      <SettingsMenu
        theme={preference}
        {audio}
        musicLabHref={`${import.meta.env.BASE_URL}music-lab/`}
        credits={[RELEASE_COMMENTS_ATTRIBUTION]}
        checkpoint={$api.checkpoint}
        onSaveCheckpoint={() => api.dispatch({ type: 'saveCheckpoint' })}
        onLoadCheckpoint={() => {
          api.dispatch({ type: 'loadCheckpoint' });
          returnToGame();
        }}
        onTheme={setTheme}
        onClose={closeSettings}
        {...loadDemoLab
          ? {
              onDemoLab: () => {
                settingsOpen = false;
                demoLabOpen = true;
              },
            }
          : {}}
      />
    {/if}
    {#if $api.save.status === 'failed'}
      <p class="save-warning" role="status" data-testid="save-warning">
        Progress could not be saved. It is kept while this page stays open.
        <button type="button" onclick={() => api.dispatch({ type: 'retrySave' })}>RETRY</button>
      </p>
    {:else if worldStatus !== 'ok'}
      <p class="save-warning" role="status" data-testid="graphics-warning">
        The picture was lost, so the game is paused.
        {#if worldStatus === 'failed'}
          <button type="button" onclick={() => retryWorld()}>RETRY</button>
        {:else}
          Waiting for the browser to restore it…
          <button type="button" onclick={() => retryWorld()}>RETRY NOW</button>
        {/if}
      </p>
    {:else if $api.save.status === 'disabled'}
      <p class="save-warning" role="status" data-testid="save-warning">
        This browser does not allow saving here: progress lasts only for this visit.
      </p>
    {/if}
    <!-- A warning banner sits over the top of the screen: the cards popup starts below it. -->
    <div
      class="view"
      class:warned={$api.save.status !== 'ok' || worldStatus !== 'ok'}
      hidden={view !== 'game'}
    >
      <GameView
        game={$api.game}
        dispatch={api.dispatch}
        {illustrationUrl}
        attention={view === 'game' ? $api.cat.attention : undefined}
        onCatOverlay={() => open('cat')}
        {sprites}
        {reducedMotion}
        {compactOffers}
        onSetup={() => open('setup')}
        onSound={(id: WheelSound) => audio.effect?.(id)}
        onDemo={(number: number) => (watching = { number, fresh: true })}
      >
        {#snippet world()}
          <WorldCanvas
            world={{ ...$api.world, theme, reducedMotion }}
            active={view === 'game'}
            description={describeScene(
              $api.world.technologyIds,
              $api.world.cat.alive,
              $api.world.sites,
            )}
            {atlasUrl}
            {...createRenderer ? { createRenderer } : {}}
            onStatus={onWorldStatus}
            onRetryReady={(retry: () => void) => (retryWorld = retry)}
            {onWorldTap}
          />
        {/snippet}
      </GameView>
    </div>
    {#if view === 'setup'}
      <div class="view">
        <SetupView setup={$api.setup} onReturn={returnToGame} {illustrationUrl} />
      </div>
    {:else if view === 'history'}
      <div class="view">
        <HistoryView
          history={$api.history}
          onReturn={returnToGame}
          {illustrationUrl}
          onWatch={(number: number) => (watching = { number, fresh: false })}
        />
      </div>
    {:else if view === 'cat'}
      <div class="view">
        <CatView
          cat={$api.cat}
          dispatch={api.dispatch}
          {clock}
          {sprites}
          {memorialUrls}
          onReturn={returnToGame}
        />
      </div>
    {/if}
  </main>
  {#if watched}
    {#key watched.number}
      <DemoScreen
        demo={watched}
        {reducedMotion}
        onClose={() => (watching = null)}
        next={watching?.fresh ? $api.game.demo : null}
        onDesign={designDemo}
      />
    {/key}
  {/if}
  {#if demoLabOpen && loadDemoLab}
    {#await loadDemoLab() then lab}
      <lab.default demos={$api.game.demos} onClose={() => (demoLabOpen = false)} />
    {/await}
  {/if}
</div>

<style>
  .app {
    display: grid;
    /* One column that never grows past the screen: wide content wraps instead of pushing the
       right border off-screen. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    height: 100vh;
    height: 100dvh;
    max-width: 560px;
    margin: 0 auto;
    background: var(--bg);
    border: 3px solid var(--border);
    box-sizing: border-box;
  }
  .main {
    position: relative;
    min-height: 0;
  }
  .view {
    height: 100%;
    min-height: 0;
  }
  .view[hidden] {
    display: none;
  }
  .warned :global(.offers-sheet) {
    padding-top: 72px;
  }
  .save-warning {
    position: absolute;
    z-index: 45; /* above the discovery overlay (40): status and RETRY stay reachable */
    left: 8px;
    right: 8px;
    top: 4px;
    margin: 0;
    padding: 6px 8px;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    background: var(--panel);
    border: 2px solid var(--border);
    font-size: 13px;
  }
  .save-warning button {
    min-height: 36px;
    border: 2px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
  }
</style>
