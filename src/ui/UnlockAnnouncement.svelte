<script lang="ts">
  import type { AnnouncementViewModel } from '../game/selectors';

  interface Props {
    announcement: AnnouncementViewModel;
    illustrationUrl: string | null;
    onAcknowledge: () => void;
  }

  const { announcement, illustrationUrl, onAcknowledge }: Props = $props();
  let failed = $state(false);
</script>

<section class="announcement" aria-labelledby="announcement-title" data-testid="announcement">
  <p class="kicker">NEW TECHNOLOGY</p>
  <div class="frame">
    {#if illustrationUrl && !failed}
      <img
        class="pixelated"
        src={illustrationUrl}
        alt=""
        width="128"
        height="96"
        onerror={() => (failed = true)}
      />
    {:else}
      <div class="fallback" aria-hidden="true"></div>
    {/if}
  </div>
  <h2 id="announcement-title">{announcement.title}</h2>
  <p class="description">{announcement.description}</p>
  <button type="button" class="continue" onclick={onAcknowledge}>CONTINUE</button>
</section>

<style>
  .announcement {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    max-height: calc(100% - 16px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    text-align: center;
    background: color-mix(in srgb, var(--panel) 94%, transparent);
    border: 3px solid var(--border);
    box-shadow: 0 4px 0 var(--shadow);
    animation: reveal 0.35s steps(4) both;
    overflow: auto;
  }
  @keyframes reveal {
    from {
      transform: scale(0.85);
      opacity: 0;
    }
  }
  .kicker {
    margin: 0;
    font-weight: 900;
    letter-spacing: 0.18em;
    font-size: 12px;
    color: var(--accent-strong);
  }
  .frame {
    width: min(256px, 62vw);
    aspect-ratio: 4 / 3;
    border: 3px solid var(--border);
    background: var(--panel-strong);
  }
  .frame img {
    width: 100%;
    height: 100%;
    display: block;
  }
  .fallback {
    width: 100%;
    height: 100%;
    background:
      linear-gradient(var(--border) 0 0) 50% 40% / 30% 6% no-repeat,
      linear-gradient(var(--accent) 0 0) 50% 60% / 50% 6% no-repeat,
      repeating-linear-gradient(0deg, var(--panel-strong) 0 6px, var(--panel) 6px 12px);
  }
  h2 {
    margin: 2px 0 0;
    font-size: 18px;
  }
  .description {
    margin: 0;
    max-width: 32ch;
    font-size: 13px;
    color: var(--ink-soft);
  }
  .continue {
    min-height: 44px;
    padding: 0 18px;
    border: 3px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 900;
    cursor: pointer;
  }
</style>
