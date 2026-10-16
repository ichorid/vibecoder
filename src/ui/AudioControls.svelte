<script lang="ts">
  import type { AudioControls } from './contracts';

  const { audio }: { audio: AudioControls } = $props();
</script>

<div class="audio-controls">
  <label class="row">
    <span>Volume</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={$audio.volume}
      disabled={!$audio.available}
      aria-label="Music volume"
      oninput={(event) => audio.setVolume(Number(event.currentTarget.value))}
    />
  </label>
  {#if !$audio.available}
    <p class="note">Music playback is not available in this build.</p>
  {/if}
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 44px;
  }
  input {
    flex: 1;
    max-width: 160px;
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft);
  }
</style>
