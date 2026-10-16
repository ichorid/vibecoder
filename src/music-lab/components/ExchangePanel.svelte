<script lang="ts">
  import type { ReviewConflict } from '../reviews';

  interface Props {
    conflicts: readonly ReviewConflict[];
    reviewError: string | null;
    onExportReviews: () => void;
    onImportReviews: (text: string) => void;
    onImportPatterns: (text: string, fileName: string) => void;
    onResolve: (key: string, choice: 'keep-local' | 'use-import') => void;
    onResetReviews: () => void;
  }

  const {
    conflicts,
    reviewError,
    onExportReviews,
    onImportReviews,
    onImportPatterns,
    onResolve,
    onResetReviews,
  }: Props = $props();

  async function read(
    event: Event & { currentTarget: HTMLInputElement },
    use: (text: string, name: string) => void,
  ) {
    const input = event.currentTarget;
    for (const file of input.files ?? []) use(await file.text(), file.name);
    input.value = '';
  }

  const describe = (r: ReviewConflict['local']) =>
    `${r.status}${r.rating ? `, ${r.rating}★` : ''}${r.feedback ? ` — “${r.feedback}”` : ''}`;
</script>

<section class="exchange" aria-label="Import and export">
  <h2>Import / export</h2>
  {#if reviewError}
    <p class="problem" role="alert">
      {reviewError}
      {#if /unreadable/.test(reviewError)}
        <button type="button" onclick={onResetReviews}>Reset stored reviews</button>
      {/if}
    </p>
  {/if}
  <div class="row">
    <button type="button" onclick={onExportReviews}>Export reviews</button>
    <label class="file">
      Import reviews
      <input
        type="file"
        accept="application/json,.json"
        onchange={(event) => void read(event, (text) => onImportReviews(text))}
      />
    </label>
    <label class="file">
      Import pattern JSON
      <input
        type="file"
        accept="application/json,.json"
        multiple
        onchange={(event) => void read(event, onImportPatterns)}
      />
    </label>
  </div>
  <p class="hint">
    Everything stays in this browser. Export reviews and candidates and give them to the composer;
    the published game soundtrack is built from the repository, never from this page.
  </p>
  {#if conflicts.length > 0}
    <h3>Conflicting decisions</h3>
    <ul class="conflicts" data-testid="review-conflicts">
      {#each conflicts as conflict (conflict.key)}
        <li>
          <span class="key">{conflict.local.patternId}@{conflict.local.revision}</span>
          <span>here: {describe(conflict.local)}</span>
          <span>imported: {describe(conflict.incoming)}</span>
          <span class="row">
            <button type="button" onclick={() => onResolve(conflict.key, 'keep-local')}
              >Keep mine</button
            >
            <button type="button" onclick={() => onResolve(conflict.key, 'use-import')}
              >Use imported</button
            >
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .exchange {
    border: 3px solid var(--border);
    background: var(--panel);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .exchange h2,
  .exchange h3 {
    margin: 0;
    font-size: 16px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  button {
    min-height: 44px;
    padding: 0 10px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  .file {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    max-width: 100%;
  }
  .file input {
    max-width: 100%;
    font: inherit;
    font-size: 12px;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft);
  }
  .problem {
    margin: 0;
    padding: 6px;
    border: 2px solid var(--health);
    overflow-wrap: anywhere;
  }
  .conflicts {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .conflicts li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-wrap: anywhere;
  }
  .key {
    font-weight: 800;
  }
</style>
