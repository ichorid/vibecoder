<script lang="ts">
  import type { EndingViewModel } from '../game/selectors';

  const { ending }: { ending: EndingViewModel } = $props();
</script>

<section class="ending" aria-labelledby="ending-title" data-testid="ending-panel">
  <p class="kicker">ENDING</p>
  <h2 id="ending-title">{ending.title}</h2>
  {#each ending.paragraphs as paragraph, i (i)}
    <p class="line">{paragraph}</p>
  {/each}
</section>

<style>
  .ending {
    position: absolute;
    inset: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    padding: 16px;
    background: color-mix(in srgb, var(--panel) 92%, transparent);
    border: 3px solid var(--border);
    box-shadow: 0 4px 0 var(--shadow);
    overflow: auto;
  }
  .kicker {
    margin: 0;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.2em;
    color: var(--ink-soft);
  }
  h2 {
    margin: 0 0 8px;
    font-size: 20px;
  }
  .line {
    margin: 0;
    line-height: 1.5;
  }
</style>
