<script lang="ts">
  import type { CatViewModel } from '../game/selectors';
  import CatPlay from './CatPlay.svelte';
  import type { Dispatch, PresentationClock } from './contracts';
  import Memorial from './Memorial.svelte';
  import MissingPoster from './MissingPoster.svelte';
  import AtlasSprite from './AtlasSprite.svelte';
  import type { DomSpriteSheet } from './contracts';
  import PixelIcon from './PixelIcon.svelte';
  import { catRound, catSitting } from './pixelArt';
  import FloatingGains from './FloatingGains.svelte';
  import { MAX_FLOATING, type FloatingGain } from './floatingGains';

  interface Props {
    cat: CatViewModel;
    dispatch: Dispatch;
    clock: PresentationClock;
    sprites?: DomSpriteSheet | null;
    memorialUrls?: readonly string[];
    onReturn: () => void;
  }

  const { cat, dispatch, clock, sprites = null, memorialUrls = [], onReturn }: Props = $props();

  const POSES = {
    normal: 'idle',
    lonely: 'lonely',
    attentionSeeking: 'attention',
    hungry: 'idle',
    sick: 'sick',
    critical: 'sleep',
    dead: 'sleep',
  } as const;
  const REACTIONS = { eat: 'eat', purr: 'pet', wiggle: 'attention' } as const;

  const tag = $derived.by(() => {
    const pose = reaction === 'none' ? POSES[cat.presentation] : REACTIONS[reaction];
    return `cat-${cat.overfed ? 'round-' : ''}${cat.play ? 'play' : pose}`;
  });

  /** Cosmetic reaction only (e.g. PET during cooldown); never a gameplay reward. */
  let reaction = $state<'none' | 'eat' | 'purr' | 'wiggle'>('none');
  let reactionKey = $state(0);

  const meters = $derived([
    { id: 'health', label: 'Health', value: cat.health },
    { id: 'mood', label: 'Mood', value: cat.mood },
    { id: 'fullness', label: 'Fullness', value: cat.fullness },
  ]);

  function react(kind: typeof reaction) {
    reaction = kind;
    reactionKey += 1;
  }

  function feed() {
    if (dispatch({ type: 'feedCat' }) === 'applied') react('eat');
  }

  function pet() {
    react(dispatch({ type: 'petCat' }) === 'applied' ? 'purr' : 'wiggle');
  }

  /** Tapping the cat itself is PET (same cooldown); it always answers with a meow. */
  let meows = $state<FloatingGain[]>([]);
  let nextMeow = 0;
  function tapCat(event: MouseEvent) {
    pet();
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = event.detail > 0 && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
    nextMeow += 1;
    meows = [...meows.slice(-(MAX_FLOATING - 1)), { id: nextMeow, text: 'meow', x, y: 0.15 }];
  }
</script>

<section class="cat-view" aria-labelledby="cat-title">
  <div class="bar">
    <button type="button" class="return" onclick={onReturn}>← BACK TO CODE</button>
    <h2 id="cat-title">
      CAT{#if cat.fate === 'dead'}<span class="fate">(died of starvation)</span
        >{:else if cat.fate === 'stray'}<span class="fate">(missing)</span>{/if}
    </h2>
  </div>
  {#if cat.alive}
    <div class="portrait {cat.presentation}" class:sick={cat.sick}>
      {#key reactionKey}
        <div
          class="sprite {reaction}"
          data-testid="cat-portrait"
          data-sprite={tag}
          onanimationend={() => (reaction = 'none')}
        >
          {#if sprites}
            <AtlasSprite sheet={sprites} {tag} scale={6} />
          {:else}
            <PixelIcon map={cat.overfed ? catRound : catSitting} scale={8} />
          {/if}
        </div>
      {/key}
      {#if !cat.play}
        <button type="button" class="tap" aria-label="Tap the cat" onclick={tapCat}></button>
      {/if}
      <FloatingGains gains={meows} onDone={(id) => (meows = meows.filter((m) => m.id !== id))} />
    </div>
    <p class="condition" data-testid="cat-condition">
      {cat.conditionText}{#if cat.overfedText}{' '}{cat.overfedText}{/if}
    </p>
    {#if cat.play}
      <CatPlay play={cat.play} attempts={cat.playAttempts} {clock} {dispatch} />
    {:else}
      {#if cat.careMessage}
        <p class="care-message">{cat.careMessage}</p>
      {/if}
      <dl class="status">
        {#each meters as meter (meter.id)}
          <div class="meter">
            <dt>{meter.label}</dt>
            <dd>
              <span class="track"
                ><span class="fill {meter.id}" style:width="{meter.value}%"></span></span
              >
              <span class="value">{Math.round(meter.value)}</span>
            </dd>
          </div>
        {/each}
      </dl>
      <div class="care">
        <button type="button" onclick={feed}
          >FEED{#if cat.foodCost > 0}<span class="cost"> ${cat.foodCost}</span>{/if}</button
        >
        <button type="button" onclick={() => dispatch({ type: 'startCatPlay' })}>PLAY</button>
        <button type="button" onclick={pet}>PET</button>
      </div>
    {/if}
  {:else if cat.fate === 'stray'}
    <MissingPoster />
  {:else}
    <Memorial urls={memorialUrls} />
  {/if}
</section>

<style>
  .cat-view {
    height: 100%;
    overflow-y: auto;
    padding: 10px 12px max(16px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  /* The fate goes on its own line under CAT: it does not fit beside the back button. */
  .fate {
    display: block;
    font-size: 13px;
    letter-spacing: 0.04em;
    font-weight: 700;
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
  .tap {
    position: absolute;
    inset: 0;
    z-index: 2;
    border: 0;
    background: transparent;
    cursor: pointer;
    touch-action: manipulation;
  }
  .portrait {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 120px;
    padding: 12px;
    border: 3px solid var(--border);
    background: var(--panel-strong);
  }
  .portrait.sick :global(svg) {
    filter: saturate(0.5) hue-rotate(40deg);
  }
  .sprite {
    animation: idle 2.4s steps(2) infinite;
  }
  .sprite.eat,
  .sprite.purr,
  .sprite.wiggle {
    animation-name: hold;
  }
  @keyframes hold {
    to {
      opacity: 1;
    }
  }
  .sprite.eat {
    animation: eat 0.5s steps(2) 3;
  }
  .sprite.purr {
    animation: purr 0.25s steps(2) 6;
  }
  .sprite.wiggle {
    animation: wiggle 0.2s steps(2) 3;
  }
  .critical .sprite,
  .sick .sprite {
    animation-duration: 5s;
  }
  @keyframes idle {
    50% {
      transform: translateY(2px);
    }
  }
  @keyframes eat {
    50% {
      transform: translateY(6px);
    }
  }
  @keyframes purr {
    50% {
      transform: translateX(2px);
    }
  }
  @keyframes wiggle {
    50% {
      transform: rotate(3deg);
    }
  }
  .condition {
    margin: 0;
    font-weight: 700;
  }
  .care-message {
    margin: 0;
    font-style: italic;
    color: var(--ink-soft);
  }
  .status {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .meter {
    display: grid;
    grid-template-columns: 9ch 1fr;
    align-items: center;
  }
  dt {
    font-weight: 700;
  }
  dd {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .track {
    position: relative;
    flex: 1;
    height: 10px;
    border: 2px solid var(--border);
    background: var(--bar-track);
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    transition: width 0.6s linear;
  }
  .fill.health {
    background: var(--health);
  }
  .fill.mood {
    background: var(--mood);
  }
  .fill.fullness {
    background: #d9a13b;
  }
  .value {
    min-width: 3ch;
    text-align: right;
  }
  .care {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .care button {
    min-height: 52px;
    border: 3px solid var(--border);
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 900;
    letter-spacing: 0.06em;
    cursor: pointer;
  }
  .care button:disabled {
    background: var(--disabled);
    cursor: not-allowed;
  }
  .dev-note {
    margin: 0;
    color: var(--ink-soft);
    font-size: 12px;
  }
</style>
