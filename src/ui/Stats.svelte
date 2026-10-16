<script lang="ts">
  import type { StatViewModel } from '../game/selectors';
  import { STAT_ICONS } from './cardIcons';
  import { formatAmount } from './format';
  import PixelIcon from './PixelIcon.svelte';

  const { stats }: { stats: readonly StatViewModel[] } = $props();
</script>

<!-- Kept beside the primary action so the player sees what a press changes without looking up. -->
{#if stats.length > 0}
  <!-- Equal columns sized by the screen, never by the numbers: the panel never re-wraps. -->
  <dl
    class="stats"
    data-testid="stats"
    aria-label="Progress"
    style:grid-template-columns="repeat({stats.length}, minmax(0, 1fr))"
  >
    {#each stats as stat (stat.id)}
      <div class="stat">
        <dt>
          <PixelIcon map={STAT_ICONS[stat.id]} scale={2} /><span class="label">{stat.label}</span>
        </dt>
        <dd>{formatAmount(stat.value)}</dd>
      </div>
    {/each}
  </dl>
{/if}

<style>
  .stats {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 3px 6px;
    border: 2px solid var(--border);
    background: var(--panel-strong);
  }
  /* Every cell is two lines (icon + label, then the value) in an equal column: the panel's shape
     depends on the screen only, so a growing number never re-wraps it. */
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    white-space: nowrap;
  }
  dt {
    display: flex;
    align-items: center;
    gap: 3px;
    max-width: 100%;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.2;
    color: var(--ink-soft);
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  dd {
    margin: 0;
    font-weight: 800;
    font-size: 18px;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }
</style>
