<script lang="ts">
  interface Props {
    reason: string;
    unsupported: boolean;
    /** The old profile validated on its own: a new run keeps its discovered endings. */
    keepsEndings?: boolean;
    onRetry: () => void;
    onStartNew: () => void;
  }

  const { reason, unsupported, keepsEndings = false, onRetry, onStartNew }: Props = $props();
  let confirming = $state(false);
</script>

<main class="recovery">
  <h1>VIBE CODER</h1>
  <p>
    {unsupported
      ? 'This save was made by a newer version of the game.'
      : 'Your saved progress could not be read.'}
    It has been left untouched.
  </p>
  <p class="reason">{reason}</p>
  <p class="note" data-testid="recovery-endings">
    {keepsEndings
      ? 'A new run keeps the endings you have already discovered.'
      : 'A new run starts with no discovered endings.'}
  </p>
  <div class="actions">
    <button type="button" onclick={onRetry}>RETRY</button>
    {#if confirming}
      <button type="button" class="danger" onclick={onStartNew}>REPLACE IT WITH A NEW RUN</button>
      <button type="button" onclick={() => (confirming = false)}>CANCEL</button>
    {:else}
      <button type="button" onclick={() => (confirming = true)}>START A NEW RUN…</button>
    {/if}
  </div>
</main>

<style>
  .recovery {
    max-width: 420px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  .reason {
    font-size: 12px;
    color: var(--ink-soft);
    word-break: break-word;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  button {
    min-height: 48px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
  }
  .danger {
    background: var(--health);
    color: #fff;
  }
</style>
