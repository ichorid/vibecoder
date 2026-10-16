/**
 * Deterministic scenario driver: ordinary 100 ms steps plus public commands chosen from the
 * current read models only (never from the future catalog). Not a production autobuyer.
 */
import { applyCommand, type CommandResult } from '../../src/game/commands';
import type { Catalog } from '../../src/game/catalog';
import { playPhase, playPosition } from '../../src/game/catPlaySession';
import { deriveRates, tokenDemandPerSecond } from '../../src/game/economy';
import { selectCat, selectGame } from '../../src/game/selectors';
import { stepRun } from '../../src/game/simulation';
import type { GameCommand, GameFact, RunState } from '../../src/game/types';
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

/** Acknowledge any pending discovery (the player watched or skipped the reveal). */
export const acknowledgeReveals: Policy = ({ run }) =>
  run.pendingUnlockIds.slice(0, 1).map((id) => ({ type: 'acknowledgeUnlock', id }));

/** Buy the first currently offered, affordable card. */
export const buyFirstAffordable: Policy = ({ run, catalog }) => {
  const offer = selectGame(run, catalog).offers.find((o) => o.kind === 'upgrade' && o.affordable);
  return offer?.kind === 'upgrade' ? [{ type: 'buyUpgrade', id: offer.id }] : [];
};

/** Baseline care: feed below 70 every `CARE.feedMs`, pet every `CARE.petMs`. */
export const baselineCare: Policy[] = [
  every(CARE.feedMs, ({ run, catalog }) =>
    selectCat(run, catalog).alive && run.cat.fullness < 70 ? [{ type: 'feedCat' }] : [],
  ),
  every(CARE.petMs, () => [{ type: 'petCat' }], CARE.petMs / 2),
];

/**
 * Baseline purchasing, as a sensible player: buy the current progression card when affordable;
 * buy a token pack when tokens would last less than the refill window; buy token automation
 * (auto-refill, auto-reviewer) when it costs at most half the visible progression price;
 * otherwise the cheapest affordable optional card under a quarter of that price. Current offers
 * only.
 */
const AUTOMATION_CARDS = new Set(['auto-refill-v1', 'auto-refill-v2', 'auto-reviewer']);
export const baselineBuyer: Policy = ({ run, catalog }) => {
  const offers = selectGame(run, catalog).offers.flatMap((o) => (o.kind === 'upgrade' ? [o] : []));
  const progression = offers.find((o) => catalog.upgrades.find((u) => u.id === o.id)?.discovers);
  if (progression?.affordable) return [{ type: 'buyUpgrade', id: progression.id }];
  const pack = offers.find((o) => o.id === 'token-supply');
  const rates = deriveRates(run, catalog);
  const demand = tokenDemandPerSecond(rates);
  if (
    pack?.affordable &&
    demand > 0 &&
    run.economy.tokens < demand * catalog.balance.tokens.refillBelowSeconds
  ) {
    return [{ type: 'buyUpgrade', id: pack.id }];
  }
  const half = progression ? progression.price / 2 : Infinity;
  const automation = offers.find(
    (o) => AUTOMATION_CARDS.has(o.id) && o.affordable && o.price <= half,
  );
  if (automation) return [{ type: 'buyUpgrade', id: automation.id }];
  const limit = progression ? progression.price / 4 : Infinity;
  const optional = offers
    .filter((o) => o !== progression && o !== pack && o.affordable && o.price <= limit)
    .sort((a, b) => a.price - b.price)[0];
  return optional ? [{ type: 'buyUpgrade', id: optional.id }] : [];
};

/** Manual pacing from the plan: once per second before agents, then once per 5 seconds. */
export const baselinePrimary: Policy = (context) => {
  const agents = (context.run.unlockedTechnologyIds as readonly string[]).includes(
    'terminal-agent',
  );
  const interval = agents ? 5000 : 1000;
  return context.run.activeMs % interval === 0 ? pressPrimary(context) : [];
};

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
