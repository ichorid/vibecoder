<script lang="ts">
  import type { StatViewModel } from '../game/selectors';
  import { formatAmount } from './format';

  const { stats }: { stats: readonly StatViewModel[] } = $props();
</script>

<!-- Kept beside the primary action so the player sees what a press changes without looking up. -->
{#if stats.length > 0}
  <dl class="stats" data-testid="stats" aria-label="Progress">
    {#each stats as stat (stat.id)}
      <div class="stat">
        <dt>{stat.label}</dt>
        <dd>{formatAmount(stat.value)}</dd>
      </div>
    {/each}
  </dl>
{/if}

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 16px;
    margin: 0;
    padding: 4px 6px;
    font-size: 13px;
    border: 2px solid var(--border);
    background: var(--panel-strong);
  }
  .stat {
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  dt {
    color: var(--ink-soft);
  }
  dd {
    margin: 0;
    font-weight: 800;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
</style>
