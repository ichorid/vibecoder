<script lang="ts">
  import type { StatViewModel } from '../game/selectors';
  import { STAT_ICONS } from './cardIcons';
  import { formatAmount, formatCountdown } from './format';
  import PixelIcon from './PixelIcon.svelte';

  interface Props {
    stats: readonly StatViewModel[];
    /** When set, the panel is a button that opens the Setup view. */
    onOpen?: (() => void) | undefined;
  }

  const { stats, onOpen }: Props = $props();
  /** Shares of 100 (progress and efficiencies) read as percentages. */
  const PERCENT: ReadonlySet<string> = new Set(['automation', 'quality', 'team']);
  /** The next rent, under the balance: "(rent: −$101 in 1:00)". */
  function rentText(rent: NonNullable<StatViewModel['rent']>): string {
    return `(rent: −$${formatAmount(rent.amount)} in ${formatCountdown(rent.dueInSeconds)})`;
  }

  /** Money in dollars. */
  function valueText(stat: StatViewModel): string {
    if (stat.id === 'money')
      return `${stat.value < 0 ? '−' : ''}$${formatAmount(Math.abs(stat.value))}`;
    return `${formatAmount(stat.value)}${PERCENT.has(stat.id) ? '%' : ''}`;
  }

  /** Up to four in a row; five or six take a second row (only then). */
  const columns = $derived(stats.length <= 4 ? stats.length : Math.ceil(stats.length / 2));
</script>

<!-- Heads the game screen, under the navbar: what the run has, at a glance. -->
{#snippet panel()}
  <!-- Equal columns sized by the screen, never by the numbers: the panel never re-wraps. -->
  <dl
    class="stats"
    data-testid="stats"
    aria-label="Progress"
    style:grid-template-columns="repeat({columns}, minmax(0, 1fr))"
  >
    {#each stats as stat (stat.id)}
      <div
        class="stat"
        class:alarm={stat.alarm}
        data-testid="stat-{stat.id}"
        data-alarm={stat.alarm ? 'true' : 'false'}
      >
        <dt>
          <PixelIcon map={STAT_ICONS[stat.id]} scale={2} /><span class="label">{stat.label}</span>
        </dt>
        <dd>{valueText(stat)}</dd>
        {#if stat.rent}
          <!-- Money going out: blue like a bill, red when it cannot be paid. -->
          <dd
            class="rent"
            class:alarm={stat.rent.alarm}
            data-testid="rent-due"
            data-alarm={stat.rent.alarm ? 'true' : 'false'}
          >
            {rentText(stat.rent)}
          </dd>
        {/if}
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
  .alarm dd {
    color: var(--alarm);
  }
  /* It may wrap under a narrow money column rather than being cut. */
  dd.rent {
    max-width: 100%;
    white-space: normal;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.2;
    color: var(--rent);
  }
  dd.rent.alarm {
    color: var(--alarm);
  }
  dd {
    margin: 0;
    font-weight: 800;
    font-size: 18px;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }
</style>
