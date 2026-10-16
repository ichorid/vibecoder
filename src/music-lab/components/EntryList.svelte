<script lang="ts">
  import type { LabEntry } from '../labController';

  interface Props {
    entries: readonly LabEntry[];
    selected: string | null;
    playingKey: string | null;
    onSelect: (key: string) => void;
  }

  const { entries, selected, playingKey, onSelect }: Props = $props();
</script>

{#if entries.length === 0}
  <p>No patterns in this era yet.</p>
{:else}
  <ul class="entries" aria-label="Patterns">
    {#each entries as entry (entry.key)}
      <li class:invalid={!entry.playable}>
        <button
          type="button"
          aria-pressed={selected === entry.key}
          class:selected={selected === entry.key}
          data-key={entry.key}
          onclick={() => onSelect(entry.key)}
        >
          <span class="key">{entry.key}</span>
          <span class="meta">
            {entry.eraId}{entry.bpm ? ` · ${entry.bpm} BPM` : ''}
            {#if entry.demo}<span class="badge warn">demo</span>{/if}
            {#if entry.local}<span class="badge">local</span>{/if}
            {#if entry.review}<span class="badge" data-status={entry.review.status}
                >{entry.review.stale ? 'stale' : entry.review.status}</span
              >{/if}
            {#if playingKey === entry.key}<span class="badge">sounding</span>{/if}
            {#if !entry.playable}<span class="badge">cannot play</span>{/if}
            {#if entry.warnings.length > 0}<span class="badge"
                >{entry.warnings.length} warning{entry.warnings.length === 1 ? '' : 's'}</span
              >{/if}
          </span>
        </button>
        {#if entry.errors.length > 0}
          <ul class="errors">
            {#each entry.errors as error, i (i)}
              <li>{error}</li>
            {/each}
          </ul>
        {/if}
        {#if selected === entry.key && entry.warnings.length > 0}
          <details>
            <summary>Warnings (for a human to judge)</summary>
            <ul>
              {#each entry.warnings as warning, i (i)}
                <li>{warning}</li>
              {/each}
            </ul>
          </details>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  button {
    width: 100%;
    min-height: 48px;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    text-align: left;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font: inherit;
    cursor: pointer;
  }
  button.selected {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .key {
    font-weight: 800;
    overflow-wrap: anywhere;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 12px;
  }
  .invalid button {
    border-style: dashed;
  }
  .errors {
    margin: 4px 0 0;
    color: var(--health);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  details {
    font-size: 12px;
  }
</style>
