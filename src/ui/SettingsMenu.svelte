<script lang="ts">
  import AudioControlsPanel from './AudioControls.svelte';
  import type { AudioControls, CheckpointInfo, ThemePreference } from './contracts';
  import { formatActiveTime } from './format';

  const SOURCE_URL = 'https://github.com/ichorid/vibecoder';

  interface Props {
    theme: ThemePreference;
    audio: AudioControls;
    musicLabHref: string;
    /** Attribution lines for third-party content (shown under Credits). */
    credits?: readonly string[];
    /** The checkpoint slot: save the run here, load it back later (e.g. to try every ending). */
    checkpoint?: CheckpointInfo | null;
    onSaveCheckpoint?: () => void;
    onLoadCheckpoint?: () => void;
    onTheme: (theme: ThemePreference) => void;
    onClose: () => void;
    /** Dev server only: opens the Demo lab. */
    onDemoLab?: () => void;
  }

  const {
    theme,
    audio,
    musicLabHref,
    credits = [],
    checkpoint = null,
    onSaveCheckpoint,
    onLoadCheckpoint,
    onTheme,
    onClose,
    onDemoLab,
  }: Props = $props();
  let confirmLoad = $state(false);
  let savedNote = $state(false);
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
    {#if onDemoLab}
      <button type="button" class="item" data-testid="demo-lab-open" onclick={onDemoLab}
        >Demo lab › <span class="dev">DEV</span></button
      >
    {/if}
    {#if onSaveCheckpoint}
      <div class="checkpoint" data-testid="checkpoint">
        <span class="credits-title">Checkpoint</span>
        <button
          type="button"
          class="item"
          onclick={() => {
            onSaveCheckpoint?.();
            savedNote = true;
            confirmLoad = false;
          }}>SAVE CHECKPOINT</button
        >
        {#if checkpoint}
          {#if confirmLoad}
            <p class="note">Replace the current run with the checkpoint? Endings you found stay.</p>
            <div class="confirm-row">
              <button
                type="button"
                class="item"
                onclick={() => {
                  confirmLoad = false;
                  onLoadCheckpoint?.();
                  onClose();
                }}>LOAD IT</button
              >
              <button type="button" class="item" onclick={() => (confirmLoad = false)}
                >CANCEL</button
              >
            </div>
          {:else}
            <button type="button" class="item" onclick={() => (confirmLoad = true)}
              >LOAD CHECKPOINT</button
            >
          {/if}
          <p class="note" data-testid="checkpoint-info">
            {savedNote ? 'Saved. ' : ''}Run at {formatActiveTime(checkpoint.activeMs)}, {checkpoint.technologies}
            technologies{checkpoint.ended ? ', ended' : ''}.
          </p>
        {:else}
          <p class="note">Save here before a big decision, then load it to try another.</p>
        {/if}
      </div>
    {/if}
    <div class="credits" data-testid="credits">
      <span class="credits-title">Credits</span>
      <p class="note">
        © GPLv3 Vadim Bulavintsev 2026. Contribute and source at:
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer"
          >github.com/ichorid/vibecoder</a
        >
      </p>
      {#each credits as line (line)}<p class="note">{line}</p>{/each}
    </div>
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
  .checkpoint {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 8px;
    padding-top: 6px;
    border-top: 2px solid var(--border);
  }
  .confirm-row {
    display: flex;
    gap: 6px;
  }
  .credits {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 2px solid var(--border);
  }
  .credits a {
    color: var(--ink);
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
  .dev {
    padding: 0 4px;
    border: 1px solid var(--focus);
    font-size: 10px;
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
