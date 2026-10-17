<script lang="ts">
  import type { StatViewModel } from '../game/selectors';
  import { STAT_ICONS } from './cardIcons';
  import { formatAmount } from './format';
  import PixelIcon from './PixelIcon.svelte';

  interface Props {
    stats: readonly StatViewModel[];
    /** When set, the panel is a button that opens the Setup view. */
    onOpen?: (() => void) | undefined;
  }

  const { stats, onOpen }: Props = $props();
  /** Shares of 100 (progress and efficiencies) read as percentages. */
  const PERCENT: ReadonlySet<string> = new Set(['automation', 'quality', 'team']);
  /** Up to four in a row; more numbers wrap into a second row (two rows at most). */
  const columns = $derived(stats.length <= 4 ? stats.length : Math.ceil(stats.length / 2));
</script>

<!-- Kept beside the primary action so the player sees what a press changes without looking up. -->
{#snippet panel()}
  <!-- Equal columns sized by the screen, never by the numbers: the panel never re-wraps. -->
  <dl
    class="stats"
    data-testid="stats"
    aria-label="Progress"
    style:grid-template-columns="repeat({columns}, minmax(0, 1fr))"
  >
    {#each stats as stat (stat.id)}
      <div class="stat">
        <dt>
          <PixelIcon map={STAT_ICONS[stat.id]} scale={2} /><span class="label">{stat.label}</span>
        </dt>
        <dd>{formatAmount(stat.value)}{PERCENT.has(stat.id) ? '%' : ''}</dd>
      </div>
    {/each}
  </dl>
{/snippet}

{#if stats.length > 0}
  <div class="wrap" class:openable={!!onOpen}>
    {@render panel()}
    {#if onOpen}
      <button
        type="button"
        class="open"
        data-testid="open-setup"
        aria-label="Setup and economy"
        onclick={onOpen}><span class="chevron" aria-hidden="true">›</span></button
      >
    {/if}
  </div>
{/if}

<style>
  .wrap {
    position: relative;
  }
  .openable .stats {
    padding-right: 20px;
  }
  /* The whole panel is the button (layered over it): tap the numbers to see where they come from. */
  .open {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .chevron {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 20px;
    font-weight: 900;
    color: var(--ink-soft);
  }
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
