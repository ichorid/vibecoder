/**
 * Deterministic scenario driver: ordinary 100 ms steps plus public commands chosen from the
 * current read models only (never from the future catalog). Not a production autobuyer.
 */
import { applyCommand, type CommandResult } from '../../src/game/commands';
import type { Catalog } from '../../src/game/catalog';
import { playPhase, playPosition } from '../../src/game/catPlaySession';
import { selectCat, selectGame } from '../../src/game/selectors';
import { stepRun } from '../../src/game/simulation';
import type { GameCommand, GameFact, RunState } from '../../src/game/types';

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
  const offer = selectGame(run, catalog).offers.find((o) => o.affordable);
  return offer ? [{ type: 'buyUpgrade', id: offer.id }] : [];
};

/** Baseline care from the implementation plan: feed every 180 s below 70, pet every 60 s. */
export const baselineCare: Policy[] = [
  every(180_000, ({ run, catalog }) =>
    selectCat(run, catalog).alive && run.cat.fullness < 70 ? [{ type: 'feedCat' }] : [],
  ),
  every(60_000, () => [{ type: 'petCat' }], 30_000),
];

/**
 * Baseline purchasing: buy the current progression card when affordable; otherwise buy the
 * cheapest affordable optional card if it costs under a quarter of the visible progression
 * price (so repeatables never delay the next discovery much). Uses current offers only.
 */
export const baselineBuyer: Policy = ({ run, catalog }) => {
  const offers = selectGame(run, catalog).offers;
  const progression = offers.find((o) => catalog.upgrades.find((u) => u.id === o.id)?.discovers);
  if (progression?.affordable) return [{ type: 'buyUpgrade', id: progression.id }];
  const limit = progression ? progression.price / 4 : Infinity;
  const optional = offers
    .filter((o) => o !== progression && o.affordable && o.price <= limit)
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
export function playEvery(intervalMs: number, offsetMs = 120_000): Policy {
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
