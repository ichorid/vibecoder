<script lang="ts">
  import type { AnnouncementViewModel } from '../game/selectors';

  interface Props {
    announcement: Pick<AnnouncementViewModel, 'title' | 'description'>;
    illustrationUrl: string | null;
    onAcknowledge: () => void;
    /** What the panel announces (a discovery by default; market updates and milestones too). */
    kicker?: string;
  }

  const {
    announcement,
    illustrationUrl,
    onAcknowledge,
    kicker = 'NEW TECHNOLOGY',
  }: Props = $props();
  let failed = $state(false);
</script>

<div class="backdrop">
  <div
    class="announcement"
    role="dialog"
    aria-modal="true"
    aria-labelledby="announcement-title"
    data-testid="announcement"
  >
    <p class="kicker">{kicker}</p>
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
  </div>
</div>

<style>
  /* Takes over the whole Game view below the header (navigation stays usable) so even small
     phones show it complete; the world's reveal stays visible behind the translucent backdrop. */
  .backdrop {
    position: absolute;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--log-bg) 45%, transparent);
  }
  .announcement {
    position: relative;
    width: min(420px, 100%);
    max-height: 100%;
    box-sizing: border-box;
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
