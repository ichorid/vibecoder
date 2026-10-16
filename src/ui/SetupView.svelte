<script lang="ts">
  import type { SetupLimit, SetupViewModel } from '../game/setup';
  import { formatAmount } from './format';

  interface Props {
    setup: SetupViewModel;
    onReturn: () => void;
    illustrationUrl?: (illustrationId: string) => string | null;
  }

  const { setup, onReturn, illustrationUrl = () => null }: Props = $props();
  const e = $derived(setup.economy);

  /** Small rates keep their decimals (0.36 debt/s is not "0"); large ones use K/M. */
  const n = (value: number) => {
    const size = Math.abs(value);
    if (size >= 10) return formatAmount(value);
    return String(Number(value.toFixed(size < 1 ? 2 : 1)));
  };
  const pct = (value: number) => `${Math.round(value * 100)}%`;

  const LIMITS: Record<SetupLimit, string> = {
    manual: 'No agents yet: every line of code is one of your presses.',
    compute: 'Some agents have no compute to run on. A compute slot lets one more work.',
    costs: 'Operating costs are above what you earn: some agents sit idle.',
    tasks: 'Agents are waiting for tasks. Press the main button, or unlock passive tasks.',
    tokens: 'Tokens run short, so not all work can be paid for. Buy tokens or automate refills.',
    coordination: 'More agents than anyone coordinates: work gets lost. Delegate, or add managers.',
    debt: 'Technical debt slows everything down. Hire reviewers, or supervise.',
  };
</script>

<section class="setup" aria-labelledby="setup-title" data-testid="setup-view">
  <div class="bar">
    <button type="button" class="return" onclick={onReturn}>← BACK TO CODE</button>
    <h2 id="setup-title">SETUP</h2>
  </div>

  <h3>Right now, per second</h3>
  <ol class="flow" data-testid="setup-flow">
    <li>
      <span class="what">Your button: <strong>{e.action}</strong></span>
      <span class="value press">{e.pressEffect}</span>
    </li>
    {#if e.agents > 0}
      <li>
        <span class="what">Agents running</span>
        <span class="value">{n(e.activeAgents)} of {n(e.agents)}</span>
        <span class="note">{n(e.compute)} compute; an agent needs one to run</span>
      </li>
      <li>
        <span class="what">Work they could do</span>
        <span class="value">{n(e.potentialWorkPerSecond)} work/s</span>
        <span class="note">{n(e.workPerAgentPerSecond)} work/s per agent</span>
      </li>
      <li>
        <span class="what">Tasks allow</span>
        <span class="value">{n(e.taskLimitedWorkPerSecond)} work/s</span>
        <span class="note"
          >{n(e.tasksQueued)} queued, +{n(e.tasksPerSecond)}/s on their own, +{n(e.tasksPerPrompt)}
          per press; one task = {n(e.workPerTask)} work</span
        >
      </li>
      <li>
        <span class="what">Tokens pay for</span>
        <span class="value">{n(e.fundedWorkPerSecond)} work/s</span>
        <span class="note"
          >{n(e.tokens)} tokens, +{n(e.tokenSupplyPerSecond)}/s supply, −{n(e.tokenUsePerSecond)}/s
          used ({n(e.tokenCostPerWork)} per work){#if e.tokensLastSeconds !== null}; last about {Math.round(
              e.tokensLastSeconds,
            )} s{/if}. A pack gives {n(e.tokensPerCode)} tokens per code{#if e.autoRefill > 0};
            auto-refill v{e.autoRefill}{/if}.</span
        >
      </li>
      <li class="factor">
        <span class="what">× Coordination</span>
        <span class="value">{pct(e.coordination)}</span>
        <span class="note"
          >{n(e.managed)} agent{e.managed === 1 ? '' : 's'} can be managed without losses</span
        >
      </li>
      <li class="factor">
        <span class="what">× Quality</span>
        <span class="value">{pct(e.quality)}</span>
        <span class="note">from {n(e.debt)} technical debt</span>
      </li>
      <li class="factor">
        <span class="what">× Efficiency</span>
        <span class="value">{pct(e.efficiency)}</span>
      </li>
      <li>
        <span class="what">= Useful code from agents</span>
        <span class="value">{n(e.usefulCodePerSecond)} code/s</span>
      </li>
    {/if}
    {#if e.passiveCodePerSecond > 0}
      <li>
        <span class="what">+ Code on its own</span>
        <span class="value">{n(e.passiveCodePerSecond)} code/s</span>
      </li>
    {/if}
    <li class="total">
      <span class="what">Total</span>
      <span class="value" data-testid="setup-total">{n(e.totalCodePerSecond)} code/s</span>
      <span class="note">plus whatever you press</span>
    </li>
  </ol>

  {#if e.uncheckedShare > 0 || e.debt > 0}
    <h3>Technical debt</h3>
    <ol class="flow">
      <li>
        <span class="what">Added by unchecked work</span>
        <span class="value">+{n(e.debtAddedPerSecond)}/s</span>
        <span class="note">{pct(e.uncheckedShare)} of agent work goes unchecked</span>
      </li>
      <li>
        <span class="what">Paid down by review</span>
        <span class="value">−{n(e.debtReviewedPerSecond)}/s</span>
      </li>
      <li class="total">
        <span class="what">Debt now</span>
        <span class="value">{n(e.debt)}</span>
      </li>
    </ol>
  {/if}

  {#if e.money}
    <h3>Money</h3>
    <ol class="flow">
      <li>
        <span class="what">Revenue</span>
        <span class="value">+${n(e.money.revenuePerSecond)}/s</span>
      </li>
      <li>
        <span class="what">Operating costs</span>
        <span class="value">−${n(e.money.costPerSecond)}/s</span>
      </li>
      <li class="total">
        <span class="what">Margin</span>
        <span class="value">${n(e.money.marginPerSecond)}/s</span>
        <span class="note">${n(e.money.revenue)} in the bank</span>
      </li>
    </ol>
  {/if}

  {#if setup.limits.length > 0}
    <h3>Holding production back</h3>
    <ul class="limits" data-testid="setup-limits">
      {#each setup.limits as limit (limit)}
        <li data-limit={limit}>{LIMITS[limit]}</li>
      {/each}
    </ul>
  {/if}

  {#if setup.stacked.length > 0}
    <h3>Stacked upgrades</h3>
    <ul class="cards" data-testid="setup-stacked">
      {#each setup.stacked as item (item.id)}
        <li>
          <span class="title"
            >{item.title}{#if item.maxLevel > 1}<span class="level"
                >×{item.level}/{item.maxLevel}</span
              >{/if}</span
          >
          <span class="effects">▸ {item.effects.join(' · ')}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <h3>Technologies applied ({setup.technologies.length})</h3>
  {#if setup.technologies.length === 0}
    <p class="empty">None yet. Write some code.</p>
  {:else}
    <ul class="cards" data-testid="setup-technologies">
      {#each setup.technologies as tech (tech.id)}
        <li class="tech">
          {#if illustrationUrl(tech.illustrationId)}
            <img
              class="pixelated"
              src={illustrationUrl(tech.illustrationId)}
              alt=""
              width="40"
              height="30"
            />
          {/if}
          <span class="text">
            <span class="title">{tech.title}</span>
            {#if tech.effects.length > 0}<span class="effects">▸ {tech.effects.join(' · ')}</span
              >{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .setup {
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
  h3 {
    margin: 16px 0 6px;
    font-size: 14px;
    letter-spacing: 0.06em;
  }
  .return {
    min-height: 44px;
    padding: 0 12px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
    cursor: pointer;
  }
  .flow,
  .cards,
  .limits {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 2px solid var(--border);
    background: var(--panel-strong);
  }
  .flow li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0 8px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--grid, #c7bb9e);
  }
  .flow li:last-child,
  .cards li:last-child {
    border-bottom: 0;
  }
  .what {
    font-weight: 700;
  }
  .value {
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  .press {
    white-space: normal;
  }
  .note {
    grid-column: 1 / -1;
    font-size: 12px;
    color: var(--ink-soft);
  }
  .factor .what {
    padding-left: 10px;
  }
  .total {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }
  .limits li {
    padding: 6px 8px;
    font-size: 14px;
    border-bottom: 1px solid var(--grid, #c7bb9e);
  }
  .limits li::before {
    content: '⚠ ';
  }
  .cards li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--grid, #c7bb9e);
  }
  .cards .tech {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  .tech img {
    flex: none;
    border: 1px solid var(--border);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    font-weight: 800;
  }
  .level {
    margin-left: 6px;
    font-variant-numeric: tabular-nums;
    color: var(--ink-soft);
  }
  .effects {
    font-size: 12px;
    font-weight: 800;
    color: var(--accent-strong);
  }
  .empty {
    color: var(--ink-soft);
  }
</style>
