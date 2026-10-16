<script lang="ts">
  import type { HistoryViewModel } from '../game/selectors';
  import { formatActiveTime } from './format';

  const { history, onReturn }: { history: HistoryViewModel; onReturn: () => void } = $props();
</script>

<section class="history" aria-labelledby="history-title">
  <div class="bar">
    <button type="button" class="return" onclick={onReturn}>← GAME</button>
    <h2 id="history-title">HISTORY</h2>
  </div>
  {#if history.endings.length > 0}
    <section class="endings" aria-labelledby="endings-title">
      <h3 id="endings-title">Endings discovered</h3>
      <ol>
        {#each history.endings as ending (ending.id)}
          <li><span class="time">#{ending.order}</span> {ending.title}</li>
        {/each}
      </ol>
    </section>
  {/if}
  <h3 class="run-title">This run</h3>
  {#if history.entries.length === 0}
    <p class="empty">Nothing has happened yet.</p>
  {:else}
    <ol class="timeline">
      {#each history.entries as entry, i (i)}
        <li class="entry {entry.kind}">
          <span class="time">{formatActiveTime(entry.activeMs)}</span>
          <span class="title">{entry.title}</span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .history {
    height: 100%;
    overflow-y: auto;
    padding: 10px 12px max(16px, env(safe-area-inset-bottom));
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.1em;
  }
  .return {
    min-height: 44px;
    padding: 0 12px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
    cursor: pointer;
  }
  .empty {
    color: var(--ink-soft);
  }
  .timeline {
    list-style: none;
    margin: 12px 0 0;
    padding: 0 0 0 14px;
    border-left: 3px solid var(--border);
  }
  .entry {
    position: relative;
    display: flex;
    gap: 10px;
    padding: 8px 0;
  }
  .entry::before {
    content: '';
    position: absolute;
    left: -21px;
    top: 13px;
    width: 9px;
    height: 9px;
    background: var(--accent);
    border: 2px solid var(--border);
  }
  .entry.ending::before {
    background: var(--health);
  }
  .entry.achievement::before {
    background: var(--gold, #e7b42f);
  }
  h3 {
    margin: 14px 0 0;
    font-size: 14px;
    letter-spacing: 0.06em;
  }
  .endings ol {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
  }
  .endings li {
    padding: 4px 0;
    font-weight: 700;
  }
  .entry.cat::before {
    background: #e8892f;
  }
  .time {
    color: var(--ink-soft);
    min-width: 4.5ch;
  }
  .title {
    font-weight: 700;
  }
</style>
