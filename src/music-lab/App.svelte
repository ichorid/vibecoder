<script lang="ts">
  import { untrack } from 'svelte';
  import type { LabController, LabMode, LabState } from './labController';
  import EntryList from './components/EntryList.svelte';
  import NowPlaying from './components/NowPlaying.svelte';

  interface Props {
    lab: LabController;
    subscribe: (listener: (state: LabState) => void) => void;
  }

  const { lab, subscribe }: Props = $props();
  let view = $state<LabState>(untrack(() => lab.state()));
  $effect(() => subscribe((next) => (view = next)));

  const MODES: readonly { id: LabMode; label: string }[] = [
    { id: 'single', label: 'Single' },
    { id: 'random', label: 'Random' },
    { id: 'transition', label: 'Transition' },
    { id: 'evolution', label: 'Evolution' },
  ];

  let eraFilter = $state('all');
  const playable = $derived(view.entries.filter((e) => e.playable));
  const visible = $derived(
    view.entries.filter((e) => eraFilter === 'all' || e.eraId === eraFilter),
  );
  const eraTitle = (id: string | null) =>
    id === null ? 'silence' : (view.eras.find((e) => e.id === id)?.title ?? id);
  const playing = $derived(view.status === 'playing' || view.status === 'paused');

  function onTempo(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    lab.setTempoOverride(value === '' ? null : Number(value));
  }
</script>

<main class="lab">
  <header>
    <h1>Music Lab</h1>
    <a class="back" href="../">← Back to the game</a>
  </header>

  <div class="modes" role="tablist" aria-label="Lab mode">
    {#each MODES as mode (mode.id)}
      <button
        type="button"
        role="tab"
        aria-selected={view.mode === mode.id}
        class:active={view.mode === mode.id}
        onclick={() => lab.setMode(mode.id)}>{mode.label}</button
      >
    {/each}
  </div>

  <section class="transport" aria-label="Playback">
    {#if playing}
      <button type="button" class="play" onclick={() => lab.stop()}>STOP</button>
    {:else}
      <button
        type="button"
        class="play"
        disabled={view.status === 'loading'}
        onclick={() => void lab.play()}>{view.status === 'loading' ? 'LOADING…' : 'PLAY'}</button
      >
    {/if}
    <label class="volume">
      Volume
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={view.volume}
        oninput={(event) => lab.setVolume(Number(event.currentTarget.value))}
      />
    </label>
    <label class="check">
      <input
        type="checkbox"
        checked={view.muted}
        onchange={(event) => lab.setMuted(event.currentTarget.checked)}
      />
      Mute
    </label>
    <span class="status" data-testid="lab-status">{view.status}</span>
  </section>

  {#if view.message}
    <p class="message" role="status" data-testid="lab-message">{view.message}</p>
  {/if}

  <NowPlaying now={view.now} demo={view.demoPlayback} {eraTitle} />

  {#if view.mode === 'single'}
    <section class="panel" aria-label="Single pattern">
      <div class="row">
        <label>
          Era
          <select bind:value={eraFilter}>
            <option value="all">All eras</option>
            {#each view.eras as era (era.id)}
              <option value={era.id}>{era.title}</option>
            {/each}
          </select>
        </label>
        <label>
          Tempo override (BPM)
          <input
            type="number"
            min="40"
            max="240"
            placeholder="pattern"
            value={view.single.tempoOverride ?? ''}
            onchange={onTempo}
          />
        </label>
        {#if view.single.tempoOverride !== null}
          <span class="badge warn">audition only — the file keeps its own tempo</span>
        {/if}
      </div>
      <EntryList
        entries={visible}
        selected={view.single.selected}
        playingKey={view.now?.key ?? null}
        onSelect={(key: string) => lab.select(key)}
      />
    </section>
  {:else if view.mode === 'random'}
    <section class="panel" aria-label="Random sequence">
      <div class="row">
        <label>
          Era
          <select
            value={view.random.era}
            onchange={(event) => lab.setRandom({ era: event.currentTarget.value })}
          >
            {#each view.eras as era (era.id)}
              <option value={era.id}>{era.title}</option>
            {/each}
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            checked={view.random.includeDemo}
            onchange={(event) => lab.setRandom({ includeDemo: event.currentTarget.checked })}
          />
          Include temporary demo material
        </label>
      </div>
      <p data-testid="random-candidates">
        {view.random.candidates}
        {view.random.includeDemo ? 'demo' : 'approved'} pattern{view.random.candidates === 1
          ? ''
          : 's'} in this bank.
        {#if !view.random.includeDemo && view.random.candidates === 0}
          Nothing is approved yet: approvals come from human review.
        {/if}
      </p>
    </section>
  {:else if view.mode === 'transition'}
    <section class="panel" aria-label="Transition test">
      <div class="row">
        {#each ['a', 'b'] as const as side (side)}
          <label>
            {side.toUpperCase()}
            <select
              aria-label="Pattern {side.toUpperCase()}"
              value={view.transition[side] ?? ''}
              onchange={(event) => {
                const value = event.currentTarget.value || null;
                if (side === 'a') lab.setTransition(value, view.transition.b);
                else lab.setTransition(view.transition.a, value);
              }}
            >
              <option value="">—</option>
              {#each playable as entry (entry.key)}
                <option value={entry.key}>{entry.key} ({eraTitle(entry.eraId)})</option>
              {/each}
            </select>
          </label>
        {/each}
      </div>
      {#if view.transition.warning}
        <p class="badge warn" role="note" data-testid="transition-warning">
          {view.transition.warning}
        </p>
      {/if}
      <p class="hint">A and B alternate at every phrase boundary.</p>
    </section>
  {:else}
    <section class="panel" aria-label="Evolution preview">
      <p>
        Six eras, two phrases each — {Math.round(view.evolution.durationSeconds)} s. Stages without their
        own material borrow a demo bank and say so.
      </p>
      <ol class="stages">
        {#each view.evolution.stages as stage, i (stage.era)}
          <li class:current={Math.floor(view.evolution.position / 2) === i}>
            <strong>{eraTitle(stage.era)}</strong>
            {#if stage.demoFallback}
              <span class="badge warn">demo fallback: {eraTitle(stage.sourceEra)} bank</span>
            {:else if stage.sourceEra === null}
              <span class="badge">silent (no material)</span>
            {:else}
              <span class="badge">own bank</span>
            {/if}
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if view.catalogErrors.length > 0}
    <details class="panel">
      <summary>{view.catalogErrors.length} catalog problem(s)</summary>
      <ul>
        {#each view.catalogErrors as problem, i (i)}
          <li>{problem}</li>
        {/each}
      </ul>
    </details>
  {/if}
</main>

<style>
  .lab {
    max-width: 960px;
    margin: 0 auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: var(--ink);
  }
  :global(body) {
    background: var(--bg);
    margin: 0;
    font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  h1 {
    margin: 0;
    font-size: 22px;
  }
  .back {
    color: var(--ink);
  }
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button,
  select,
  input[type='number'] {
    min-height: 44px;
    font: inherit;
  }
  .modes button,
  .play {
    padding: 0 14px;
    border: 3px solid var(--border);
    background: var(--panel);
    font-weight: 800;
    cursor: pointer;
  }
  .modes button.active {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .play {
    background: var(--accent);
    color: var(--accent-ink);
    min-width: 110px;
  }
  .play:disabled {
    background: var(--disabled);
  }
  .transport,
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  label {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  label.check {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }
  .status {
    font-size: 12px;
    padding: 2px 6px;
    border: 2px solid var(--border);
  }
  .panel {
    border: 3px solid var(--border);
    background: var(--panel);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .message {
    margin: 0;
    padding: 8px;
    border: 2px dashed var(--border);
    background: var(--panel-strong);
  }
  :global(.badge) {
    display: inline-block;
    padding: 2px 6px;
    font-size: 12px;
    border: 2px solid var(--border);
    background: var(--panel-strong);
    color: var(--ink);
  }
  :global(.badge.warn) {
    background: #f6d77a;
    color: #2a2017;
  }
  .stages {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stages li.current {
    font-weight: 900;
    text-decoration: underline;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft);
  }
</style>
