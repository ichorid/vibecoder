/**
 * Deterministic scenario driver: ordinary 100 ms steps plus public commands chosen from the
 * current read models only (never from the future catalog). Not a production autobuyer.
 */
import { applyCommand, type CommandResult } from '../../src/game/commands';
import type { Catalog } from '../../src/game/catalog';
import { playPhase, playPosition } from '../../src/game/catPlaySession';
import { deriveRates, offerPrice, tokenDemandPerSecond } from '../../src/game/economy';
import { selectCat, selectGame } from '../../src/game/selectors';
import { stepRun } from '../../src/game/simulation';
import type { GameCommand, GameFact, ProjectKey, RunState } from '../../src/game/types';
import { CAT_INTENSITY } from '../../src/content/balance';

/**
 * Baseline care cadence (implementation plan: feed every 3 min, pet every minute, PLAY every
 * 4.5 min), divided by the cat's intensity so the same attentive player keeps the same cat.
 */
export const CARE = {
  feedMs: 180_000 / CAT_INTENSITY,
  petMs: 60_000 / CAT_INTENSITY,
  playMs: 270_000 / CAT_INTENSITY,
  firstPlayMs: 120_000 / CAT_INTENSITY,
} as const;

export interface ScenarioContext {
  readonly run: RunState;
  readonly catalog: Catalog;
}

/** Decides commands for the current moment; called every step. */
export type Policy = (context: ScenarioContext) => GameCommand[];

export interface ScenarioResult {
  run: RunState;
  facts: GameFact[];
  rejected: { command: GameCommand; result: CommandResult; activeMs: number }[];
}

export function runScenario(
  start: RunState,
  catalog: Catalog,
  durationMs: number,
  policies: readonly Policy[],
  until?: (run: RunState) => boolean,
): ScenarioResult {
  let run = start;
  const facts: GameFact[] = [];
  const rejected: ScenarioResult['rejected'] = [];
  const end = start.activeMs + durationMs;
  while (run.activeMs < end && run.status === 'playing') {
    for (const policy of policies) {
      for (const command of policy({ run, catalog })) {
        const transition = applyCommand(run, command, run.activeMs, catalog);
        run = transition.run;
        facts.push(...transition.facts);
        if (transition.result !== 'applied') {
          rejected.push({ command, result: transition.result, activeMs: run.activeMs });
        }
      }
    }
    const transition = stepRun(run, 100, catalog);
    run = transition.run;
    facts.push(...transition.facts);
    if (until?.(run)) break;
  }
  return { run, facts, rejected };
}

/** Run `action` once every `intervalMs` of active time, starting at `offsetMs`. */
export function every(intervalMs: number, action: Policy, offsetMs = 0): Policy {
  return (context) => {
    const t = context.run.activeMs - offsetMs;
    return t >= 0 && t % intervalMs === 0 ? action(context) : [];
  };
}

/** Press the primary action. */
export const pressPrimary: Policy = () => [{ type: 'primaryAction' }];

/**
 * Acknowledge any pending discovery (the player watched or skipped the reveal), then market
 * updates, milestones and landlord wheels the same way.
 */
export const acknowledgeReveals: Policy = ({ run }) => {
  const id = run.pendingUnlockIds[0];
  if (id) return [{ type: 'acknowledgeUnlock', id }];
  if (run.notices.length > 0) return [{ type: 'acknowledgeNotice' }];
  if (run.rentWheelsSeen < run.rentWheels.length) return [{ type: 'acknowledgeRentWheel' }];
  return [];
};

/** Build or buy the first card on offer (a project is picked; a money card bought if affordable). */
export const buyFirstAffordable: Policy = ({ run, catalog }) => {
  const offer = selectGame(run, catalog).offers.find(
    (o) => o.kind === 'upgrade' && !o.internal && o.affordable,
  );
  if (offer?.kind !== 'upgrade') return [];
  return offer.currency === 'money'
    ? [{ type: 'buyUpgrade', id: offer.id }]
    : run.slots.some((s) => s.target === offer.id && s.by !== 'fallback')
      ? []
      : [{ type: 'selectProject', id: offer.id }];
};

/** Baseline care: feed below 70 every `CARE.feedMs`, pet every `CARE.petMs`. */
export const baselineCare: Policy[] = [
  every(CARE.feedMs, ({ run, catalog }) =>
    selectCat(run, catalog).alive && run.cat.fullness < 70 ? [{ type: 'feedCat' }] : [],
  ),
  every(CARE.petMs, () => [{ type: 'petCat' }], CARE.petMs / 2),
];

/** A sensible player buys a pack by hand when tokens would last under this many seconds. */
const MANUAL_PACK_BELOW_SECONDS = 20;
const AUTOMATION_CARDS = new Set([
  'auto-refill-v1',
  'auto-refill-v2',
  'auto-reviewer',
  'job-search-bot',
  'auto-freelancing',
]);
const CAPACITY = new Set(['compute-slot', 'additional-agent', 'review-capacity']);

export interface BuyerOptions {
  /** Seconds the player takes to pick the next build after one completes (fallback). */
  readonly reactSeconds?: number;
  /** Take a gig when money falls below this many rents (0: never freelance). */
  readonly freelanceBelowRents?: number;
  /** Capacity: 'cheap' (≤ ¼ of the next technology), 'greedy' (whenever offered), 'none'. */
  readonly capacity?: 'cheap' | 'greedy' | 'none' | 'seer';
  /** Accept enterprise job offers and never leave. */
  readonly takeJob?: boolean;
}

/** Money the player wants in reserve: a few rents plus a minute of token packs. */
function wantsMoney(context: ScenarioContext, rents: number): boolean {
  const { run, catalog } = context;
  // Careless (negative): only once in debt. Zero: never.
  if (rents < 0) return run.economy.money < 0 && !run.job.employed;
  if (rents === 0) return false;
  const game = selectGame(run, catalog);
  if (!game.money || game.money.employed) return false;
  const rent = game.money.rent ?? catalog.balance.rent.base;
  const rates = deriveRates(run, catalog);
  const demand = tokenDemandPerSecond(rates);
  const pack = catalog.upgrades.find((u) => u.pack === 'tokens');
  const packPrice = pack ? offerPrice(run, pack, catalog) : 0;
  const tokenMoney = demand > 0 ? packPrice : 0;
  return run.economy.money < rents * rent + tokenMoney;
}

/**
 * The ordered builds a player wants now: a gig when money runs low, cheap automation, the
 * capacity the cards suggest (by `capacity`), then the next technology; the release last.
 */
function wantedBuilds(context: ScenarioContext, options: BuyerOptions): string[] {
  const { run, catalog } = context;
  const game = selectGame(run, catalog);
  const cards = game.offers.flatMap((o) =>
    o.kind === 'upgrade' && !o.internal && o.currency === 'output' ? [o] : [],
  );
  const progression = cards.find((o) => catalog.upgrades.find((u) => u.id === o.id)?.discovers);
  const wanted: string[] = [];
  if (game.money?.gig && wantsMoney(context, options.freelanceBelowRents ?? 1.5))
    wanted.push('gig');
  const half = progression ? progression.price / 2 : Infinity;
  for (const card of cards) {
    if (AUTOMATION_CARDS.has(card.id) && card.price <= half) wanted.push(card.id);
  }
  const capacity = options.capacity ?? 'cheap';
  const quarter = progression ? progression.price / 4 : Infinity;
  const capacityCards = cards.filter((o) => CAPACITY.has(o.id));
  if (capacity === 'greedy') {
    const first = capacityCards[0];
    if (first) wanted.push(first.id);
  } else if (capacity === 'seer') {
    const want = seerWant(context);
    if (want && capacityCards.some((o) => o.id === want)) wanted.push(want);
  } else if (capacity === 'cheap') {
    const cheap = [...capacityCards].sort((a, b) => a.price - b.price)[0];
    if (cheap && cheap.price <= quarter) wanted.push(cheap.id);
  }
  if (progression) wanted.push(progression.id);
  // With a second slot, the capacity the cards show (they only show what helps) beats the
  // release, unless the player never builds capacity.
  if (run.slots.length > 1 && capacity !== 'none') {
    for (const card of capacityCards) if (!wanted.includes(card.id)) wanted.push(card.id);
  }
  // Fewer builds than slots: both worktrees on the best one (tap it again).
  const first = wanted[0];
  if (first && first !== 'gig' && wanted.length < run.slots.length) wanted.push(first);
  wanted.push('release');
  return wanted;
}

function seerWant(context: ScenarioContext): string | null {
  const { run, catalog } = context;
  const rates = deriveRates(run, catalog);
  return rates.compute < rates.agents
    ? 'compute-slot'
    : run.economy.debt > 20
      ? 'review-capacity'
      : rates.managed >= rates.agents
        ? 'additional-agent'
        : null;
}

/**
 * A sensible player with projects and money: searches when the gig board is empty, takes a gig
 * when money runs low, buys token packs, compute and the company's cards with money, and keeps
 * the slots on what it wants (reacting `reactSeconds` after a build falls back). Current
 * offers only.
 */
export function projectPlayer(options: BuyerOptions = {}): Policy {
  const react = (options.reactSeconds ?? 1) * 1000;
  return (context) => {
    const { run, catalog } = context;
    const game = selectGame(run, catalog);
    const commands: GameCommand[] = [];
    if (options.takeJob && game.job && !game.job.employed) {
      return [{ type: 'selectProject', id: 'job' }];
    }
    if (run.job.employed) return [];
    if (
      game.money?.search &&
      (options.freelanceBelowRents ?? 1.5) !== 0 &&
      wantsMoney(
        context,
        (options.freelanceBelowRents ?? 1.5) < 0 ? -1 : (options.freelanceBelowRents ?? 1.5) + 1,
      )
    ) {
      commands.push({ type: 'searchJob' });
    }
    // Money cards: token packs when low, compute when it is what binds, the company's cards.
    const money = game.offers.flatMap((o) =>
      o.kind === 'upgrade' && o.currency === 'money' && o.affordable ? [o] : [],
    );
    const rates = deriveRates(run, catalog);
    const demand = tokenDemandPerSecond(rates);
    const pack = money.find((o) => o.id === 'token-supply');
    if (pack && demand > 0 && run.economy.tokens < demand * MANUAL_PACK_BELOW_SECONDS) {
      commands.push({ type: 'buyUpgrade', id: pack.id });
    } else {
      const company = money.find((o) => catalog.upgrades.find((u) => u.id === o.id)?.discovers);
      const compute = money.find((o) => o.id === 'compute-slot');
      const capacity = options.capacity ?? 'cheap';
      const rent = game.money?.rent ?? 0;
      // Keep two rents and a token pack in reserve before buying compute.
      const packPrice = catalog.upgrades.find((u) => u.pack === 'tokens');
      const reserve =
        2 * rent + (demand > 0 && packPrice ? offerPrice(run, packPrice, catalog) : 0);
      const spare = run.economy.money - reserve;
      if (company) commands.push({ type: 'buyUpgrade', id: company.id });
      else if (
        compute &&
        capacity !== 'none' &&
        compute.price <= spare &&
        (capacity === 'greedy' || rates.compute < rates.agents)
      ) {
        commands.push({ type: 'buyUpgrade', id: compute.id });
      }
    }
    // Builds: keep every slot on something wanted (one tap per step, like a player).
    const wanted = wantedBuilds(context, options);
    const slots = run.slots;
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      if (!slot || slot.target === 'job') continue;
      if (slot.by === 'fallback' && run.activeMs - slot.sinceMs < react) continue;
      const others = slots
        .filter((s, j) => j !== i && s.by !== 'fallback')
        .map((s) => s.target as string);
      const count = (list: readonly string[], id: string) => list.filter((x) => x === id).length;
      // The first wanted build that has fewer worktrees than wanted (duplicates double up).
      const want = wanted.find((id) => count(others, id) < count(wanted, id));
      if (!want) continue;
      const current = slot.by === 'fallback' ? null : (slot.target as string);
      if (current === want) continue;
      const keep =
        current !== null && current !== 'release' && wanted.includes(current) && want !== 'gig';
      if (keep) continue;
      commands.push({ type: 'selectProject', id: want as ProjectKey });
      break;
    }
    return commands;
  };
}

/** Baseline purchasing: the sensible project player (react 1 s, freelance below 1.5 rents). */
export const baselineBuyer: Policy = projectPlayer();

/**
 * Presses due in this 100 ms step at `rate` per second, counted from `since` (stateless, so one
 * policy can be shared by many runs).
 */
function pressesDue(activeMs: number, since: number, rate: number): number {
  const t = activeMs - since;
  if (t < 0) return 0;
  if (t === 0) return 0;
  return Math.floor((t * rate) / 1000) - Math.floor(((t - 100) * rate) / 1000);
}

function agentSince(run: ScenarioContext['run']): number | null {
  const entry = run.history.find((e) => e.kind === 'technology' && e.id === 'terminal-agent');
  return entry ? entry.activeMs : null;
}

/**
 * Press the main button at `before` presses per second until the Terminal Agent exists, then
 * at `after` per second (e.g. 3 then 1/3: realistic mobile tapping, docs/economy_redesign.md §7).
 */
export function tapAt(before: number, after: number = before): Policy {
  return ({ run }) => {
    const since = agentSince(run);
    const count =
      since === null ? pressesDue(run.activeMs, 0, before) : pressesDue(run.activeMs, since, after);
    return Array.from({ length: count }, () => ({ type: 'primaryAction' }));
  };
}

/** The design baseline (economy redesign §7): 3 presses per second before agents, then 1 per 3 s. */
export const baselinePrimary: Policy = tapAt(3, 1 / 3);

/**
 * PLAY every `intervalMs` (plan: 270 s): start a session, then catch when the mouse is well
 * inside the target, as an attentive player would. Sessions consume real active time.
 */
export function playEvery(
  intervalMs: number = CARE.playMs,
  offsetMs: number = CARE.firstPlayMs,
): Policy {
  return ({ run, catalog }) => {
    const cat = selectCat(run, catalog);
    if (!cat.alive) return [];
    const play = cat.play;
    if (!play) {
      const t = run.activeMs - offsetMs;
      return t >= 0 && t % intervalMs === 0 ? [{ type: 'startCatPlay' }] : [];
    }
    if (playPhase(play, run.activeMs) !== 'moving') return [];
    const position = playPosition(play, run.activeMs);
    const { start, width } = play.target;
    const inside = position > start + width * 0.25 && position < start + width * 0.75;
    return inside ? [{ type: 'catchMouse', attemptId: play.attemptId }] : [];
  };
}

/** Ship a release whenever the next one is built. */
export const shipWhenAffordable: Policy = ({ run, catalog }) =>
  selectGame(run, catalog).release?.affordable ? [{ type: 'shipRelease' }] : [];

/**
 * A player who ships every release: keeps building the release when nothing else is wanted
 * and ships as soon as it is ready; otherwise `buyer` decides.
 */
export function savingForReleases(buyer: Policy): Policy {
  return (context) => [...buyer(context), ...shipWhenAffordable(context)];
}

/** Progression first; capacity the cards put first whenever offered. */
export const greedyCapacityBuyer: Policy = projectPlayer({ capacity: 'greedy' });

/** Progression and money only: never builds or buys capacity. */
export const progressionOnlyBuyer: Policy = projectPlayer({ capacity: 'none' });

/** The "seer": capacity that relieves the hidden binding constraint. */
export const seerBuyer: Policy = projectPlayer({ capacity: 'seer' });
