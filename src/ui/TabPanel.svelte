<script lang="ts">
  interface Props {
    /** waiting: another tab owns the save; elsewhere: another tab saved newer progress. */
    mode: 'waiting' | 'elsewhere';
    onReload: () => void;
  }

  const { mode, onReload }: Props = $props();
</script>

<main class="tab-panel" data-testid="tab-panel">
  <h1>VIBE CODER</h1>
  {#if mode === 'waiting'}
    <p>The game is open in another tab. Only one tab can play and save at a time.</p>
    <p class="note">
      Close the other tab and this one continues automatically from the latest save.
    </p>
  {:else}
    <p>This game continued in another tab, so this tab stopped to keep your save safe.</p>
    <button type="button" onclick={onReload}>CONTINUE HERE</button>
  {/if}
</main>

<style>
  .tab-panel {
    max-width: 420px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  .note {
    font-size: 13px;
    color: var(--ink-soft);
  }
  button {
    min-height: 48px;
    padding: 0 16px;
    border: 3px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 800;
  }
</style>
