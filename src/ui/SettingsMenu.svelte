<script lang="ts">
  import AudioControlsPanel from './AudioControls.svelte';
  import type { AudioControls, ThemePreference } from './contracts';

  interface Props {
    theme: ThemePreference;
    audio: AudioControls;
    musicLabHref: string;
    /** Attribution lines for third-party content (shown under Credits). */
    credits?: readonly string[];
    onTheme: (theme: ThemePreference) => void;
    onClose: () => void;
  }

  const { theme, audio, musicLabHref, credits = [], onTheme, onClose }: Props = $props();
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
      <!-- Auto (the default) follows the system's light/dark setting. -->
      <div class="segmented" role="radiogroup" aria-labelledby="theme-label">
        {#each [['auto', 'AUTO'], ['light', 'LIGHT'], ['dark', 'DARK']] as const as [value, label] (value)}
          <button
            type="button"
            role="radio"
            aria-checked={theme === value}
            class:on={theme === value}
            onclick={() => onTheme(value)}>{label}</button
          >
        {/each}
      </div>
    </div>
    <div class="row">
      <span id="sound-label">Sound</span>
      <button
        type="button"
        class="toggle"
        role="switch"
        aria-labelledby="sound-label"
        aria-checked={$audio.soundOn}
        aria-describedby="sound-status"
        disabled={!$audio.available}
        aria-disabled={$audio.status === 'loading'}
        onclick={() => {
          // Not `disabled` while loading: that would drop keyboard focus out of the menu.
          if ($audio.status !== 'loading') void audio.setSound(!$audio.soundOn);
        }}
      >
        {$audio.soundOn ? 'ON' : 'OFF'}
      </button>
    </div>
    <p class="note" id="sound-status" role="status" data-testid="sound-status">
      {#if !$audio.available}
        Sound is not available in this build.
      {:else if $audio.status === 'loading'}
        Loading sound…
      {:else if $audio.message}
        {$audio.message}
      {:else if $audio.status === 'playing'}
        Playing.
      {/if}
    </p>
    <button type="button" class="item" onclick={() => (page = 'music')}>Music ›</button>
    {#if credits.length > 0}
      <div class="credits" data-testid="credits">
        <span class="credits-title">Credits</span>
        {#each credits as line (line)}<p class="note">{line}</p>{/each}
      </div>
    {/if}
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
  .segmented {
    display: inline-flex;
    border: 3px solid var(--border);
  }
  .segmented button {
    min-height: 40px;
    padding: 0 8px;
    border: 0;
    border-left: 2px solid var(--border);
    background: var(--panel-strong);
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
  }
  .segmented button:first-child {
    border-left: 0;
  }
  .segmented button.on {
    background: var(--accent);
    color: var(--accent-ink);
  }
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
  .credits {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 2px solid var(--border);
  }
  .credits-title {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.1em;
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
