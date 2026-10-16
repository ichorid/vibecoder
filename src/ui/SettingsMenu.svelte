<script lang="ts">
  import AudioControlsPanel from './AudioControls.svelte';
  import type { AudioControls, Theme } from './contracts';

  interface Props {
    theme: Theme;
    audio: AudioControls;
    musicLabHref: string;
    onTheme: (theme: Theme) => void;
    onClose: () => void;
  }

  const { theme, audio, musicLabHref, onTheme, onClose }: Props = $props();
  let panel: HTMLElement | undefined = $state();
  let page = $state<'main' | 'music'>('main');

  $effect(() => {
    void page;
    panel?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (page === 'music') page = 'main';
      else onClose();
    }
  }
</script>

<div
  class="settings"
  role="dialog"
  aria-modal="false"
  aria-labelledby="settings-title"
  tabindex="-1"
  bind:this={panel}
  onkeydown={onKeydown}
>
  {#if page === 'main'}
    <div class="head">
      <h2 id="settings-title">Settings</h2>
      <button
        type="button"
        class="close"
        aria-label="Close settings"
        onclick={onClose}
        data-autofocus>✕</button
      >
    </div>
    <div class="row">
      <span id="theme-label">Theme</span>
      <button
        type="button"
        class="toggle"
        aria-labelledby="theme-label"
        aria-pressed={theme === 'dark'}
        onclick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? 'DARK' : 'LIGHT'}
      </button>
    </div>
    <div class="row">
      <span id="sound-label">Sound</span>
      <button
        type="button"
        class="toggle"
        role="switch"
        aria-labelledby="sound-label"
        aria-checked={audio.soundOn}
        disabled={!audio.available}
        onclick={() => audio.setSound(!audio.soundOn)}
      >
        {audio.soundOn ? 'ON' : 'OFF'}
      </button>
    </div>
    {#if !audio.available}
      <p class="note">Sound is not available in this build yet.</p>
    {/if}
    <button type="button" class="item" onclick={() => (page = 'music')}>Music ›</button>
  {:else}
    <div class="head">
      <button type="button" class="back" onclick={() => (page = 'main')} data-autofocus
        >‹ Back</button
      >
      <h2 id="settings-title">Music</h2>
      <button type="button" class="close" aria-label="Close settings" onclick={onClose}>✕</button>
    </div>
    <AudioControlsPanel {audio} />
    <a class="item" href={musicLabHref}>Music Lab</a>
  {/if}
</div>

<style>
  .settings {
    position: absolute;
    top: 4px;
    right: 8px;
    z-index: 30;
    width: min(300px, calc(100vw - 16px));
    padding: 10px 12px 12px;
    background: var(--panel);
    border: 3px solid var(--border);
    box-shadow: 0 4px 0 var(--shadow);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    letter-spacing: 0.08em;
  }
  .close,
  .back {
    min-width: 44px;
    min-height: 44px;
    border: 0;
    background: transparent;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 48px;
  }
  .toggle {
    min-width: 88px;
    min-height: 44px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
    cursor: pointer;
  }
  .toggle:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .item {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 48px;
    margin-top: 6px;
    padding: 0 10px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    color: var(--ink);
    font-weight: 800;
    text-decoration: none;
    cursor: pointer;
  }
  .note {
    margin: 0 0 4px;
    font-size: 12px;
    color: var(--ink-soft);
  }
</style>
