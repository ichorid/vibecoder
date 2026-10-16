<script lang="ts">
  import type { HistoryIconViewModel, HistoryViewModel } from '../game/selectors';
  import { RELEASE_ICON } from './cardIcons';
  import { formatActiveTime } from './format';
  import { flagIcon, palmIcon, trophyIcon } from './icons';
  import PixelIcon from './PixelIcon.svelte';
  import { catCandle, catSunset, type PixelMap } from './pixelArt';

  interface Props {
    history: HistoryViewModel;
    onReturn: () => void;
    illustrationUrl?: (illustrationId: string) => string | null;
  }

  const { history, onReturn, illustrationUrl = () => null }: Props = $props();

  const SYMBOLS: Record<Extract<HistoryIconViewModel, { kind: 'symbol' }>['id'], PixelMap> = {
    'cat-died': catCandle,
    'cat-left': catSunset,
    achievement: trophyIcon,
    ending: flagIcon,
    release: RELEASE_ICON,
    jackpot: palmIcon,
  };
</script>

{#snippet icon(value: HistoryIconViewModel)}
  <span class="icon" aria-hidden="true" data-icon={value.kind === 'symbol' ? value.id : value.kind}>
    {#if value.kind === 'illustration' && illustrationUrl(value.id)}
      <img class="pixelated" src={illustrationUrl(value.id)} alt="" width="32" height="24" />
    {:else if value.kind === 'emoji'}
      <span class="emoji">{value.text}</span>
    {:else if value.kind === 'symbol'}
      <PixelIcon map={SYMBOLS[value.id]} scale={2} />
    {:else}
      <span class="emoji">🔓</span>
    {/if}
  </span>
{/snippet}

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
          <li>
            {@render icon({ kind: 'symbol', id: 'ending' })}<span class="time">#{ending.order}</span
            >
            {ending.title}
          </li>
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
          {@render icon(entry.icon)}
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
  .icon {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 26px;
  }
  .icon img {
    width: 32px;
    height: 24px;
    border: 1px solid var(--border);
  }
  .emoji {
    font-size: 17px;
    line-height: 1;
  }
  .endings li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .entry {
    align-items: center;
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
  .entry.release::before {
    background: #59b7ff;
  }
  .time {
    color: var(--ink-soft);
    min-width: 5.5ch;
  }
  .title {
    font-weight: 700;
  }
</style>
