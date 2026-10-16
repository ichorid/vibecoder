<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CatView from '../ui/CatView.svelte';
  import {
    unavailableAudio,
    type AudioControls,
    type PresentationClock,
    type Theme,
    type UiGameApi,
    type ViewId,
  } from '../ui/contracts';
  import GameView from '../ui/GameView.svelte';
  import Header from '../ui/Header.svelte';
  import HistoryView from '../ui/HistoryView.svelte';
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
  /** DOM sprites share the world atlas; inline fallbacks show until it loads. */
  let sprites = $state<DomSpriteSheet | null>(null);

  $effect(() => {
    const theme = $api.profile.theme;
    let current = true;
    void loadDomSheet(theme).then((sheet) => {
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
  function onWorldTap(tap: WorldTap): string | null {
    switch (tap.target) {
      case 'poster': {
        const gain = current().game.primaryAction.gain;
        if (api.dispatch({ type: 'primaryAction' }) !== 'applied' || !gain) return null;
        return gainText(gain, formatAmount);
      }
      case 'bowl': {
        if (api.dispatch({ type: 'feedCat' }) !== 'applied') return null;
        return FEED_TEXT[current().cat.careNote ?? 'nom'] ?? 'fed';
      }
      case 'cat':
        return api.dispatch({ type: 'petCat' }) === 'applied' ? 'purr' : 'meow';
    }
  }

  let settingsOpen = $state(false);
  let settingsButton: HTMLElement | null = null;

  const VIEW_KEY = 'vibeView';

  function stateView(state: unknown): ViewId {
    if (typeof state === 'object' && state !== null && VIEW_KEY in state) {
      const value = (state as Record<string, unknown>)[VIEW_KEY];
      if (value === 'history' || value === 'cat') return value;
    }
    return 'game';
  }

  /** Navigating away from Cat ends a PLAY session (no completion bonus). */
  function leavePlay() {
    if ($api.cat.play) api.dispatch({ type: 'leaveCatPlay' });
  }

  function open(next: 'history' | 'cat') {
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

  function setTheme(theme: Theme) {
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
    return () => {
      window.removeEventListener('popstate', onPop);
      motion?.removeEventListener('change', onMotion);
    };
  });

  $effect(() => {
    document.documentElement.dataset.theme = $api.profile.theme;
  });
</script>

<div class="app" data-view={view}>
  <Header
    cat={$api.cat}
    {sprites}
    {settingsOpen}
    onCat={() => open('cat')}
    onHistory={() => open('history')}
    onSettings={toggleSettings}
  />
  <main class="main">
    {#if settingsOpen}
      <SettingsMenu
        theme={$api.profile.theme}
        {audio}
        musicLabHref={`${import.meta.env.BASE_URL}music-lab/`}
        credits={[RELEASE_COMMENTS_ATTRIBUTION]}
        onTheme={setTheme}
        onClose={closeSettings}
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
    <div class="view" hidden={view !== 'game'}>
      <GameView
        game={$api.game}
        dispatch={api.dispatch}
        {illustrationUrl}
        attention={view === 'game' ? $api.cat.attention : undefined}
        onCatOverlay={() => open('cat')}
        {sprites}
        {reducedMotion}
        onSound={(id: WheelSound) => audio.effect?.(id)}
      >
        {#snippet world()}
          <WorldCanvas
            world={{ ...$api.world, theme: $api.profile.theme, reducedMotion }}
            active={view === 'game'}
            description={describeScene($api.world.technologyIds, $api.world.cat.alive)}
            {atlasUrl}
            {...createRenderer ? { createRenderer } : {}}
            onStatus={onWorldStatus}
            onRetryReady={(retry: () => void) => (retryWorld = retry)}
            {onWorldTap}
          />
        {/snippet}
      </GameView>
    </div>
    {#if view === 'history'}
      <div class="view"><HistoryView history={$api.history} onReturn={returnToGame} /></div>
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
</div>

<style>
  .app {
    display: grid;
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
