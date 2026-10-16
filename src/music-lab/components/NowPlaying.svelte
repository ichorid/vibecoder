<script lang="ts">
  import type { PhraseInfo } from '../../music/director';

  interface Props {
    now: PhraseInfo | null;
    demo: boolean;
    eraTitle: (id: string | null) => string;
  }

  const { now, demo, eraTitle }: Props = $props();
</script>

<section class="now" aria-label="Now playing" aria-live="polite" data-testid="now-playing">
  {#if now}
    <span class="key" data-testid="now-key">{now.key}</span>
    <span>era: {eraTitle(now.eraId)}</span>
    {#if now.sourceEraId !== now.eraId}
      <span class="badge warn">from the {eraTitle(now.sourceEraId)} bank</span>
    {/if}
    <span class="badge">{now.arrangementId}</span>
    <span class="badge">{now.status}</span>
  {:else}
    <span class="idle">Nothing is sounding.</span>
  {/if}
  {#if demo}
    <span class="badge warn" data-testid="demo-label">TEMPORARY DEMO MATERIAL — not approved</span>
  {/if}
</section>

<style>
  .now {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 6px 10px;
    background: var(--log-bg);
    color: var(--log-ink);
  }
  .key {
    font-weight: 900;
  }
  .idle {
    opacity: 0.7;
  }
</style>
