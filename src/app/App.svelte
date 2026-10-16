<script lang="ts">
  import { onMount, tick } from 'svelte';
  import CatView from '../ui/CatView.svelte';
  import {
    unavailableAudio,
    type AudioControls,
    type Theme,
    type UiGameApi,
    type ViewId,
  } from '../ui/contracts';
  import GameView from '../ui/GameView.svelte';
  import Header from '../ui/Header.svelte';
  import HistoryView from '../ui/HistoryView.svelte';
  import SettingsMenu from '../ui/SettingsMenu.svelte';
  import type { RendererFactory } from '../world/host';
  import WorldCanvas from '../world/WorldCanvas.svelte';

  interface Props {
    api: UiGameApi;
    illustrationUrl: (illustrationId: string) => string | null;
    navigation?: History;
    /** Injected in component tests; production lazily loads the Pixi renderer. */
    createRenderer?: RendererFactory;
    audio?: AudioControls;
  }

  const {
    api,
    illustrationUrl,
    navigation = window.history,
    createRenderer,
    audio = unavailableAudio,
  }: Props = $props();

  let view = $state<ViewId>('game');
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

  function open(next: 'history' | 'cat') {
    settingsOpen = false;
    if (view === next) return;
    if (view === 'game') navigation.pushState({ [VIEW_KEY]: next }, '');
    else navigation.replaceState({ [VIEW_KEY]: next }, '');
    view = next;
  }

  function returnToGame() {
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
    // A reload always opens Game.
    if (stateView(navigation.state) !== 'game') navigation.replaceState(null, '');
    const onPop = (event: PopStateEvent) => {
      view = stateView(event.state);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

  $effect(() => {
    document.documentElement.dataset.theme = $api.profile.theme;
  });
</script>

<div class="app" data-view={view}>
  <Header
    stats={$api.game.stats}
    cat={$api.cat}
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
        onTheme={setTheme}
        onClose={closeSettings}
      />
    {/if}
    {#if $api.save.status === 'failed'}
      <p class="save-warning" role="status">
        Progress could not be saved.
        <button type="button" onclick={() => api.dispatch({ type: 'retrySave' })}>RETRY</button>
      </p>
    {/if}
    <div class="view" hidden={view !== 'game'}>
      <GameView game={$api.game} dispatch={api.dispatch} {illustrationUrl}>
        {#snippet world()}
          <WorldCanvas
            world={{ ...$api.world, theme: $api.profile.theme }}
            active={view === 'game'}
            description="A programmer types at a desk in a cozy room. An orange cat keeps them company."
            {...createRenderer ? { createRenderer } : {}}
          />
        {/snippet}
      </GameView>
    </div>
    {#if view === 'history'}
      <div class="view"><HistoryView history={$api.history} onReturn={returnToGame} /></div>
    {:else if view === 'cat'}
      <div class="view"><CatView cat={$api.cat} onReturn={returnToGame} /></div>
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
    border-left: 3px solid var(--border);
    border-right: 3px solid var(--border);
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
    z-index: 20;
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
