<script lang="ts">
  import type { SetupLimit, SetupViewModel } from '../game/setup';
  import { ACTION_ICONS, cardIcon, STAT_ICONS } from './cardIcons';
  import { formatAmount } from './format';
  import * as icons from './icons';
  import PixelIcon from './PixelIcon.svelte';
  import type { PixelMap } from './pixelArt';

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

  const LIMITED_BY = {
    compute: 'compute (agents wait for a slot)',
    agents: 'agents (every one is busy)',
    tasks: 'tasks (the agents wait for prompts)',
    tokens: 'tokens (work waits to be paid for)',
  } as const;

  const LIMIT_ICONS: Record<SetupLimit, PixelMap> = {
    manual: icons.writeCodeIcon,
    compute: icons.computeIcon,
    costs: icons.costIcon,
    tasks: icons.tasksIcon,
    tokens: STAT_ICONS.tokens,
    coordination: icons.delegateIcon,
    debt: STAT_ICONS.debt,
  };

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

{#snippet ico(map: PixelMap)}
  <span class="ico" aria-hidden="true"><PixelIcon {map} scale={2} /></span>
{/snippet}

<section class="setup" aria-labelledby="setup-title" data-testid="setup-view">
  <div class="bar">
    <button type="button" class="return" onclick={onReturn}>← BACK TO CODE</button>
    <h2 id="setup-title">SETUP</h2>
  </div>

  <h3>Right now, per second</h3>
  {#if e.limitedBy}
    <p class="limited" data-testid="setup-limited-by">
      Limited by: <strong>{LIMITED_BY[e.limitedBy]}</strong>
    </p>
  {/if}
  <ol class="flow" data-testid="setup-flow">
    <li>
      <span class="what">{@render ico(ACTION_ICONS[e.actionId])}Your button</span>
      <span class="value">{e.action}</span>
      <span class="note" data-testid="setup-press">One press: {e.pressEffect}</span>
    </li>
    {#if e.agents > 0}
      <li>
        <span class="what">{@render ico(icons.agentIcon)}Agents running</span>
        <span class="value">{n(e.activeAgents)} of {n(e.agents)}</span>
        <span class="note">{n(e.compute)} compute; an agent needs one to run</span>
      </li>
      <li>
        <span class="what">{@render ico(icons.automationIcon)}Work they could do</span>
        <span class="value">{n(e.potentialWorkPerSecond)} work/s</span>
        <span class="note">{n(e.workPerAgentPerSecond)} work/s per agent</span>
      </li>
      <li>
        <span class="what">{@render ico(icons.tasksIcon)}Tasks allow</span>
        <span class="value">{n(e.taskLimitedWorkPerSecond)} work/s</span>
        <span class="note"
          >{n(e.tasksQueued)} queued, +{n(e.tasksPerSecond)}/s on their own, +{n(e.tasksPerPrompt)}
          per press; one task = {n(e.workPerTask)} work</span
        >
      </li>
      <li>
        <span class="what">{@render ico(STAT_ICONS.tokens)}Tokens pay for</span>
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
        <span class="what">{@render ico(icons.delegateIcon)}× Coordination</span>
        <span class="value">{pct(e.coordination)}</span>
        <span class="note"
          >{n(e.managed)} agent{e.managed === 1 ? '' : 's'} can be managed without losses</span
        >
      </li>
      <li class="factor">
        <span class="what">{@render ico(STAT_ICONS.debt)}× Quality</span>
        <span class="value">{pct(e.quality)}</span>
        <span class="note">from {n(e.debt)} technical debt</span>
      </li>
      <li class="factor">
        <span class="what">{@render ico(icons.optimizeIcon)}× Efficiency</span>
        <span class="value">{pct(e.efficiency)}</span>
      </li>
      {#if e.experience > 0}
        <li class="factor">
          <span class="what">{@render ico(icons.trophyIcon)}× Experience</span>
          <span class="value">{pct(1 + e.experience)}</span>
          <span class="note">from lessons learned in earlier runs; your presses get it too</span>
        </li>
      {/if}
      <li>
        <span class="what">{@render ico(STAT_ICONS.code)}= Useful code from agents</span>
        <span class="value">{n(e.usefulCodePerSecond)} code/s</span>
      </li>
    {/if}
    {#if e.passiveCodePerSecond > 0}
      <li>
        <span class="what">{@render ico(STAT_ICONS.automation)}+ Code on its own</span>
        <span class="value">{n(e.passiveCodePerSecond)} code/s</span>
      </li>
    {/if}
    <li class="total">
      <span class="what">{@render ico(STAT_ICONS.code)}Total</span>
      <span class="value" data-testid="setup-total">{n(e.totalCodePerSecond)} code/s</span>
      <span class="note">plus whatever you press</span>
    </li>
  </ol>

  <h3>Builds</h3>
  <ol class="flow" data-testid="setup-builds">
    {#each setup.builds as build, i (i)}
      <li>
        <span class="what"
          >{@render ico(STAT_ICONS.code)}{build.title}{#if build.by !== 'player'}
            ({build.by === 'system' ? 'auto' : 'auto · ½'}){/if}</span
        >
        <span class="value">{pct(build.share)}</span>
        <span class="note"
          >{#if build.price !== null}{n(build.code)} / {n(build.price)} code{:else}takes all your
            code{/if}{#if i === 0}
            · your presses go here{/if}</span
        >
      </li>
    {/each}
  </ol>

  {#if e.uncheckedShare > 0 || e.debt > 0}
    <h3>Technical debt</h3>
    <ol class="flow">
      <li>
        <span class="what">{@render ico(STAT_ICONS.debt)}Added by unchecked work</span>
        <span class="value">+{n(e.debtAddedPerSecond)}/s</span>
        <span class="note">{pct(e.uncheckedShare)} of agent work goes unchecked</span>
      </li>
      <li>
        <span class="what">{@render ico(icons.reviewIcon)}Paid down by review</span>
        <span class="value">−{n(e.debtReviewedPerSecond)}/s</span>
      </li>
      <li class="total">
        <span class="what">{@render ico(STAT_ICONS.debt)}Debt now</span>
        <span class="value">{n(e.debt)}</span>
      </li>
    </ol>
  {/if}

  {#if e.money}
    <h3>Money</h3>
    <ol class="flow">
      <li>
        <span class="what">{@render ico(STAT_ICONS.money)}Revenue</span>
        <span class="value">+${n(e.money.revenuePerSecond)}/s</span>
        <span class="note" data-testid="setup-revenue-why"
          >{n(e.money.usefulCodePerSecond)} useful code/s × ${n(e.money.perCode)} per line of code{#if e.money.basePerCode > 0 && Math.abs(e.money.perCode - e.money.basePerCode) > 1e-9}
            (${n(e.money.basePerCode)} from product management × {n(
              e.money.perCode / e.money.basePerCode,
            )} from marketing, finance and executives){/if}. Your own presses earn nothing; only the
          agents' useful code is sold.</span
        >
      </li>
      <li>
        <span class="what">{@render ico(icons.costIcon)}Operating costs</span>
        <span class="value">−${n(e.money.costPerSecond)}/s</span>
        <span class="note"
          >{n(e.money.runningAgents)} agents × ${n(e.money.costPerAgent)}/s each{#if e.money.overheadPerSecond > 0}
            + ${n(e.money.overheadPerSecond)}/s fixed overhead from expanding{/if}. When the bank
          cannot pay, agents sit idle.</span
        >
      </li>
      {#if e.money.credit}
        <li>
          <span class="what">{@render ico(icons.costIcon)}Borrowed</span>
          <span class="value">${n(e.money.credit.owed)} / ${n(e.money.credit.limit)}</span>
          <span class="note"
            >The bank lends up to {Math.round(
              e.money.credit.limit / Math.max(1, e.money.costPerSecond),
            )} s of costs, at {(e.money.interestPerSecond * 100).toFixed(1)}% interest per second.
            {#if e.money.credit.secondsLeft !== null}At this rate it stops in about {Math.ceil(
                e.money.credit.secondsLeft,
              )} s — then the creditors close the company.{:else}You are paying it back.{/if}</span
          >
        </li>
      {/if}
      <li class="total">
        <span class="what">{@render ico(STAT_ICONS.margin)}Margin</span>
        <span class="value">${n(e.money.marginPerSecond)}/s</span>
        <span class="note">${n(e.money.revenue)} in the bank</span>
      </li>
    </ol>
  {/if}

  {#if setup.limits.length > 0}
    <h3>Holding production back</h3>
    <ul class="limits" data-testid="setup-limits">
      {#each setup.limits as limit (limit)}
        <li data-limit={limit}>{@render ico(LIMIT_ICONS[limit])}<span>{LIMITS[limit]}</span></li>
      {/each}
    </ul>
  {/if}

  {#if setup.stacked.length > 0}
    <h3>Stacked upgrades</h3>
    <ul class="cards" data-testid="setup-stacked">
      {#each setup.stacked as item (item.id)}
        <li class="stacked">
          {@render ico(cardIcon(item.id))}
          <span class="text">
            <span class="title"
              >{item.title}{#if item.maxLevel === null}<span class="level">×{item.level}</span
                >{:else if item.maxLevel > 1}<span class="level">×{item.level}/{item.maxLevel}</span
                >{/if}</span
            >
            <span class="effects">▸ {item.effects.join(' · ')}</span>
          </span>
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
  .limited {
    margin: 0 0 6px;
    padding: 4px 8px;
    border: 2px solid var(--border);
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
    font-size: 14px;
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
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }
  .ico {
    flex: none;
    display: inline-flex;
    width: 18px;
    justify-content: center;
  }
  .note {
    padding-left: 24px;
  }
  .value {
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
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
  .limits li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cards li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--grid, #c7bb9e);
  }
  .cards .stacked {
    flex-direction: row;
    align-items: center;
    gap: 8px;
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
