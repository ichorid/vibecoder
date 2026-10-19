<script lang="ts">
  import type { TokenGaugeViewModel } from '../game/deck';
  import { formatAmount, formatCountdown } from './format';
  import PixelIcon from './PixelIcon.svelte';
  import { STAT_ICONS } from './cardIcons';

  interface Props {
    gauge: TokenGaugeViewModel;
    /** Buy one pack now. */
    onReload: () => void;
    /** No money: go earn some (pick the gig, or search for one). Null: nothing to take. */
    onEarn: (() => void) | null;
  }

  const { gauge, onReload, onEarn }: Props = $props();

  /** "~1:40", "STALLED", or "∞" while the supply covers the demand. */
  const left = $derived(
    gauge.state === 'empty' || gauge.state === 'noMoney'
      ? 'STALLED'
      : gauge.secondsLeft === null
        ? '∞'
        : `~${formatCountdown(Math.ceil(gauge.secondsLeft))}`,
  );
  const label = $derived(
    `Tokens: ${formatAmount(gauge.tokens)}, ${
      gauge.secondsLeft === null ? 'enough' : `${Math.ceil(gauge.secondsLeft)} s left`
    }. Reload ${formatAmount(gauge.packTokens)} tokens for $${formatAmount(gauge.price)}`,
  );
</script>

<!-- The tower on cooldown (docs/feature_build_deck.md §7): always here, one tap to reload. -->
<div
  class="gauge"
  data-testid="token-gauge"
  data-state={gauge.state}
  role="group"
  aria-label="Tokens"
>
  <span class="icon" aria-hidden="true"><PixelIcon map={STAT_ICONS.tokens} scale={2} /></span>
  <span class="meter" aria-hidden="true"
    ><span class="fill" style:width="{Math.min(100, gauge.fraction * 100)}%"></span></span
  >
  <span class="left" data-testid="token-left"
    >{left}{#if gauge.state === 'noMoney' || gauge.state === 'empty'}
      💤{/if}</span
  >
  {#if gauge.auto}
    <span class="auto" class:buggy={gauge.auto === 1} data-testid="token-auto"
      >AUTO v{gauge.auto}{gauge.auto === 1 ? ' ⚠' : ''}</span
    >
  {/if}
  {#if gauge.state === 'noMoney'}
    <button
      type="button"
      class="reload earn"
      data-testid="token-earn"
      disabled={onEarn === null}
      onclick={() => onEarn?.()}>need ${formatAmount(gauge.price)} · gig ▸</button
    >
  {:else}
    <button
      type="button"
      class="reload"
      class:risk={gauge.rentRisk !== null}
      data-testid="token-reload"
      aria-label={label}
      disabled={!gauge.affordable}
      onclick={onReload}
      >⟳ ${formatAmount(gauge.price)}{#if gauge.rentRisk}<span class="risk-note"
          >→ ${formatAmount(gauge.moneyAfter)} ⚠ rent {formatCountdown(
            gauge.rentRisk.dueInSeconds,
          )}</span
        >{/if}</button
    >
  {/if}
</div>

<style>
  .gauge {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    min-height: 36px;
    padding: 2px 4px 2px 6px;
    border: 2px solid var(--border);
    background: var(--panel);
    font-size: 12px;
    font-weight: 900;
  }
  .icon {
    flex: none;
  }
  .meter {
    position: relative;
    flex: 1 1 60px;
    min-width: 40px;
    height: 10px;
    border: 2px solid var(--border);
    background: var(--bar-track);
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: #59b7ff;
    transition: width 0.3s;
  }
  .left {
    flex: none;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .auto {
    flex: none;
    padding: 0 4px;
    border: 2px solid var(--border);
    background: #59b7ff;
    color: #10202e;
    font-size: 10px;
  }
  .auto.buggy {
    background: #f6c945;
  }
  .reload {
    flex: none;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-height: 32px;
    padding: 0 8px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    cursor: pointer;
  }
  .reload:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .risk-note {
    font-size: 9px;
    color: #c0392b;
  }
  .gauge[data-state='low'] {
    border-color: #c99a1e;
    background: color-mix(in srgb, #f6c945 18%, var(--panel));
    animation: low 1.2s ease-in-out infinite;
  }
  .gauge[data-state='low'] .fill {
    background: #f6c945;
  }
  .gauge[data-state='low'] .reload {
    border-color: #c99a1e;
    background: #f6c945;
    color: #2a2017;
  }
  .gauge[data-state='empty'],
  .gauge[data-state='noMoney'] {
    border-color: #c0392b;
    background: color-mix(in srgb, #e8483c 16%, var(--panel));
    animation: low 0.8s ease-in-out infinite;
  }
  .gauge[data-state='empty'] .reload {
    border-color: #c0392b;
    background: #e8483c;
    color: #fff;
  }
  .reload.earn {
    background: #4caf50;
    color: #fff;
    font-size: 11px;
  }
  @keyframes low {
    50% {
      box-shadow: 0 0 0 3px color-mix(in srgb, #f6c945 50%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .gauge[data-state] {
      animation: none;
    }
  }
</style>
