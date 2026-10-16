<script lang="ts">
  import type { Result } from '../reviews';

  interface Props {
    eras: readonly { id: string; title: string }[];
    build: (eraId: string) => Result<string>;
    download: (name: string, text: string, type: string) => void;
  }

  const { eras, build, download }: Props = $props();
  let eraId = $state('');
  let note = $state<string | null>(null);
  const current = $derived(eraId || eras[0]?.id || '');

  async function copy() {
    const result = build(current);
    if (!result.ok) {
      note = result.error;
      return;
    }
    try {
      await navigator.clipboard.writeText(result.value);
      note = 'Prompt copied. Paste it to the composer agent.';
    } catch {
      download(`feedback-${current}.md`, result.value, 'text/markdown');
      note = 'Clipboard access was refused, so the prompt was downloaded as Markdown instead.';
    }
  }

  function save() {
    const result = build(current);
    if (!result.ok) note = result.error;
    else {
      download(`feedback-${current}.md`, result.value, 'text/markdown');
      note = null;
    }
  }
</script>

<section class="prompt" aria-label="Feedback prompt">
  <h2>Feedback prompt</h2>
  <p class="hint">
    A self-contained task for a composer: the era's rules, approved metadata, and every version you
    marked REVISE or REJECT with your rating and feedback.
  </p>
  <div class="row">
    <label>
      Era
      <select value={current} onchange={(event) => (eraId = event.currentTarget.value)}>
        {#each eras as era (era.id)}
          <option value={era.id}>{era.title}</option>
        {/each}
      </select>
    </label>
    <button type="button" onclick={() => void copy()}>COPY FEEDBACK PROMPT</button>
    <button type="button" onclick={save}>Download .md</button>
  </div>
  {#if note}<p class="note" role="status" data-testid="prompt-note">{note}</p>{/if}
</section>

<style>
  .prompt {
    border: 3px solid var(--border);
    background: var(--panel);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: flex-end;
  }
  label {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  select,
  button {
    min-height: 44px;
    font: inherit;
  }
  button {
    padding: 0 10px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font-weight: 800;
    cursor: pointer;
  }
  .hint,
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft);
  }
</style>
