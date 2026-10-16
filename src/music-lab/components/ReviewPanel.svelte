<script lang="ts">
  import type { LabEntry } from '../labController';
  import type { ReviewStatus } from '../reviews';

  interface Props {
    entry: LabEntry;
    ready: boolean;
    onRate: (rating: number | null) => void;
    onDraft: (text: string) => void;
    onDecide: (status: ReviewStatus) => void;
    onExport: () => void;
    onRemove: (() => void) | null;
  }

  const { entry, ready, onRate, onDraft, onDecide, onExport, onRemove }: Props = $props();
  const review = $derived(entry.review);
</script>

<section class="review" aria-label="Review {entry.key}" data-testid="review-panel">
  <h2>Review {entry.key}</h2>
  <p class="hash" title="SHA-256 of the canonical payload">
    {#if entry.hash}hash {entry.hash.slice(0, 16)}…{:else}hash pending…{/if}
    {#if entry.local}<span class="badge">local candidate</span>{/if}
    {#if entry.demo}<span class="badge warn">temporary demo</span>{/if}
  </p>
  {#if review}
    <p data-testid="review-status">
      Status: <strong>{review.status}</strong>
      {#if review.stale}
        <span class="badge warn"
          >stale: an earlier payload of this revision was {review.staleStatus}</span
        >
      {/if}
    </p>
    <div class="rating" role="group" aria-label="Rating">
      {#each [1, 2, 3, 4, 5] as n (n)}
        <button
          type="button"
          aria-pressed={review.rating === n}
          class:on={review.rating !== null && n <= review.rating}
          onclick={() => onRate(review.rating === n ? null : n)}>{n}★</button
        >
      {/each}
    </div>
    <label class="feedback">
      Feedback (plain text)
      <textarea
        rows="3"
        maxlength="8192"
        value={entry.draft}
        oninput={(event) => onDraft(event.currentTarget.value)}
      ></textarea>
    </label>
    <div class="actions">
      <button
        type="button"
        class="approve"
        disabled={!ready || !entry.playable}
        onclick={() => onDecide('approved')}>APPROVE</button
      >
      <button type="button" disabled={!ready} onclick={() => onDecide('revise')}>REVISE</button>
      <button type="button" disabled={!ready} onclick={() => onDecide('rejected')}>REJECT</button>
      <button type="button" class="quiet" onclick={onExport}>Export JSON</button>
      {#if onRemove}
        <button type="button" class="quiet" onclick={onRemove}>Remove candidate</button>
      {/if}
    </div>
    {#if !entry.playable}
      <p class="note">Versions with validation errors can be rejected or revised, not approved.</p>
    {/if}
    {#if entry.warnings.length > 0}
      <p class="note">
        {entry.warnings.length} validator warning(s) — they inform, the decision is yours.
      </p>
    {/if}
  {:else}
    <p>Computing the content hash…</p>
  {/if}
</section>

<style>
  .review {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 2px dashed var(--border);
    padding-top: 8px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    overflow-wrap: anywhere;
  }
  .hash,
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft);
    overflow-wrap: anywhere;
  }
  p {
    margin: 0;
  }
  .rating,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0 10px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .rating button.on {
    background: #f6d77a;
  }
  .approve {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .quiet {
    font-weight: 400;
  }
  .feedback {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    font: inherit;
  }
</style>
