/**
 * The economy contract as data (docs/economy_redesign.md §4): play one run with a tap rate,
 * a buyer and a care policy, and measure act boundaries, binding constraints, visible decisions,
 * debt/coordination pressure and the money act. Used by tools/tune.ts and economy-shape tests.
 */
import { catalog as defaultCatalog } from '../../src/content/catalog';
import type { Catalog } from '../../src/game/catalog';
import { applyCommand } from '../../src/game/commands';
import { createRun } from '../../src/game/createRun';
import { deriveRates, economyFlows, marketRate, offerPrice } from '../../src/game/economy';
import { isChoiceOffered } from '../../src/game/endings';
import type { TechnologyId } from '../../src/game/ids';
import { isUpgradeOffered } from '../../src/game/progression';
import { selectGame } from '../../src/game/selectors';
import { stepRun } from '../../src/game/simulation';
import type { RunState } from '../../src/game/types';
import {
  acknowledgeReveals,
  baselineCare,
  playEvery,
  projectPlayer,
  tapAt,
  type Policy,
} from './scenario';

export type Buyer = 'baseline' | 'greedy' | 'seer' | 'saver';
export type Binding = 'agents' | 'compute' | 'tasks' | 'tokens' | 'idle';

export interface MeasureOptions {
  /** Presses per second before the Terminal Agent, and after it. */
  readonly cps?: number;
  readonly cpsAfter?: number;
  readonly buyer?: Buyer;
  readonly care?: 'play' | 'none';
  readonly experience?: number;
  readonly limitMin?: number;
  readonly catalog?: Catalog;
  /** Extra policies (e.g. ending choices) run after the standard ones. */
  readonly extra?: readonly Policy[];
  /** Seconds to pick the next build after one completes. */
  readonly react?: number;
  /** Take a gig below this many rents (0: never). */
  readonly freelance?: number;
  /** Accept enterprise job offers and never leave. */
  readonly takeJob?: boolean;
  /** Rent factor (0.9 after the frugal lesson). */
  readonly frugal?: number;
}

export interface WindowMetrics {
  readonly tech: TechnologyId;
  readonly startMin: number;
  readonly endMin: number;
  readonly binding: Readonly<Record<Binding, number>>;
  readonly qualityLow: number;
  readonly coordLow: number;
  readonly twoOffers: number;
  readonly manualShare: number;
  readonly money: number;
  readonly revenue: number;
  readonly cost: number;
}

export interface RunMetrics {
  readonly run: RunState;
  readonly companyMin: number | null;
  readonly techMin: Readonly<Partial<Record<TechnologyId, number>>>;
  /** Unlock minute of the last technology of each of the six acts. */
  readonly acts: readonly (number | null)[];
  /** Gap before the first card of acts 2–6, and the mean gap between cards inside acts. */
  readonly wallsMin: readonly (number | null)[];
  readonly cadenceSec: number;
  readonly windows: readonly WindowMetrics[];
  /** From 4 min: share of time with at least two optional (capacity/tool) cards visible. */
  readonly twoOffersShare: number;
  /** Seconds where X binds while an X card is offered and affordable but not shown. */
  readonly hiddenBindingSec: number;
  readonly qualityLowShare: number;
  readonly coordLowShare: number;
  readonly peakDebt: number;
  readonly pmToCompanyMin: number | null;
  /** Each auto-refill disaster's cost in seconds of output at that moment. */
  readonly disasterSec: readonly number[];
  readonly freezeDelaySec: number | null;
  /** Share of written code lost to the fallback tax and polish, until Manager Agent. */
  readonly taxedShareEarly: number;
  /** Share of written code built into gigs, by act (1–6). */
  readonly gigShareByAct: readonly number[];
  readonly rentMissed: number;
  readonly evictedMin: number | null;
  readonly gigsPaid: number;
}

export const ACT_ENDS: readonly TechnologyId[] = [
  'ai-native-ide',
  'persistent-instructions',
  'manager-agent',
  'local-servers',
  'self-improvement',
  'autonomous-company',
];
const ACT_STARTS: readonly TechnologyId[] = [
  'terminal-agent',
  'ralph-loop',
  'context-management',
  'custom-harness',
  'self-driving-repositories',
];

const CARD_FOR: Partial<Record<Binding, string>> = {
  compute: 'compute-slot',
  agents: 'additional-agent',
  tokens: 'token-supply',
};

function buyerPolicy(buyer: Buyer, options: MeasureOptions): Policy {
  const player = {
    reactSeconds: options.react ?? 1,
    freelanceBelowRents: options.freelance ?? 1.5,
    takeJob: options.takeJob ?? false,
  };
  switch (buyer) {
    case 'greedy':
      return projectPlayer({ ...player, capacity: 'greedy' });
    case 'seer':
      return projectPlayer({ ...player, capacity: 'seer' });
    case 'saver':
      return projectPlayer({ ...player, capacity: 'none' });
    default:
      return projectPlayer(player);
  }
}

export function measureRun(seed: number, options: MeasureOptions = {}): RunMetrics {
  const catalog = options.catalog ?? defaultCatalog;
  const cps = options.cps ?? 3;
  const policies: Policy[] = [
    buyerPolicy(options.buyer ?? 'baseline', options),
    acknowledgeReveals,
    ...(options.care === 'none' ? [] : [...baselineCare, playEvery()]),
    tapAt(cps, options.cpsAfter ?? 1 / 3),
    ...(options.extra ?? []),
  ];
  let run = createRun(seed, `measure-${seed}`, options.experience ?? 0, options.frugal ?? 1);
  const limitMs = (options.limitMin ?? 60) * 60_000;
  const techMin: Partial<Record<TechnologyId, number>> = {};
  const windows: WindowMetrics[] = [];
  let current: {
    tech: TechnologyId;
    start: number;
    steps: number;
    binding: Record<Binding, number>;
    qualityLow: number;
    coordLow: number;
    twoOffers: number;
    manual: number;
    total: number;
  } | null = null;
  const close = (end: number) => {
    if (!current) return;
    const n = Math.max(1, current.steps);
    const share = (x: number) => x / n;
    windows.push({
      tech: current.tech,
      startMin: current.start / 60_000,
      endMin: end / 60_000,
      binding: {
        agents: share(current.binding.agents),
        compute: share(current.binding.compute),
        tasks: share(current.binding.tasks),
        tokens: share(current.binding.tokens),
        idle: share(current.binding.idle),
      },
      qualityLow: share(current.qualityLow),
      coordLow: share(current.coordLow),
      twoOffers: share(current.twoOffers),
      manualShare: current.total > 0 ? current.manual / current.total : 1,
      money: run.economy.money,
      revenue: run.economy.revenuePerSecond,
      cost: run.economy.costPerSecond,
    });
  };

  let after4 = 0;
  let twoAfter4 = 0;
  let late = 0;
  let qualityLate = 0;
  let coordLate = 0;
  let hidden = 0;
  let peakDebt = 0;
  const disasterSec: number[] = [];
  let freezeAt: number | null = null;
  const gigByAct: number[] = [0, 0, 0, 0, 0, 0];
  const writtenByAct: number[] = [0, 0, 0, 0, 0, 0];
  let managerAt: number | null = null;
  let taxedEarly = 0;
  let writtenEarly = 0;
  const actOf = (r: RunState) => {
    const i = ACT_ENDS.findIndex((id) => !r.unlockedTechnologyIds.includes(id));
    return i < 0 ? 5 : i;
  };

  while (run.activeMs < limitMs && run.status === 'playing') {
    for (const policy of policies) {
      for (const command of policy({ run, catalog })) {
        run = applyCommand(run, command, run.activeMs, catalog).run;
      }
    }
    const rates = deriveRates(run, catalog);
    const flows = economyFlows(run.economy, rates, 0.1, catalog.balance);
    const binding: Binding =
      rates.agents === 0
        ? 'idle'
        : flows.funded < flows.taskLimited - 1e-9
          ? 'tokens'
          : flows.taskLimited < flows.demand - 1e-9
            ? 'tasks'
            : rates.compute < rates.agents
              ? 'compute'
              : 'agents';
    const game = selectGame(run, catalog);
    const optional = game.offers.filter(
      (o) => o.kind === 'upgrade' && !catalog.upgrades.find((u) => u.id === o.id)?.discovers,
    ).length;
    const minute = run.activeMs / 60_000;
    if (minute >= 4) {
      after4 += 1;
      if (optional >= 2) twoAfter4 += 1;
    }
    if (minute >= 16 && minute <= 31) {
      late += 1;
      if (flows.quality < 0.9) qualityLate += 1;
      if (flows.coordination < 0.95) coordLate += 1;
    }
    const card = CARD_FOR[binding];
    if (card) {
      const definition = catalog.upgrades.find((u) => u.id === card);
      const shown = game.offers.some((o) => o.id === card);
      if (
        definition &&
        !shown &&
        isUpgradeOffered(run, definition) &&
        (definition.currency === 'output' ||
          offerPrice(run, definition, catalog) <= run.economy.money)
      ) {
        hidden += 0.1;
      }
    }
    if (
      freezeAt === null &&
      techMin.evaluations !== undefined &&
      catalog.choices.some((c) => c.id === 'freeze-features' && isChoiceOffered(run, c))
    ) {
      freezeAt = run.activeMs;
    }
    if (current) {
      current.steps += 1;
      current.binding[binding] += 1;
      if (flows.quality < 0.9) current.qualityLow += 1;
      if (flows.coordination < 0.95) current.coordLow += 1;
      if (optional >= 2) current.twoOffers += 1;
      const manual = run.economy.pendingManualWork;
      current.manual += manual;
      current.total += manual + flows.useful + rates.passiveOutputPerSecond * 0.1;
    }
    const disastersBefore = run.stats.refillDisasters;
    const moneyBefore = run.economy.money;
    const perSecond = run.economy.codeRate * marketRate(run, catalog);
    const actBefore = actOf(run);
    const gigBefore = run.stats.gigCode;
    const writtenBefore = run.stats.lifetimeOutput;
    run = stepRun(run, 100, catalog).run;
    gigByAct[actBefore] = (gigByAct[actBefore] ?? 0) + run.stats.gigCode - gigBefore;
    writtenByAct[actBefore] =
      (writtenByAct[actBefore] ?? 0) + run.stats.lifetimeOutput - writtenBefore;
    if (managerAt === null && run.unlockedTechnologyIds.includes('manager-agent')) {
      managerAt = run.activeMs;
      taxedEarly = run.stats.taxedCode;
      writtenEarly = run.stats.lifetimeOutput;
    }
    if (run.stats.refillDisasters > disastersBefore) {
      disasterSec.push((moneyBefore - run.economy.money) / Math.max(1e-9, perSecond));
    }
    peakDebt = Math.max(peakDebt, run.economy.debt);
    for (const id of run.unlockedTechnologyIds) {
      if (techMin[id] !== undefined) continue;
      techMin[id] = run.activeMs / 60_000;
      close(run.activeMs);
      current = {
        tech: id,
        start: run.activeMs,
        steps: 0,
        binding: { agents: 0, compute: 0, tasks: 0, tokens: 0, idle: 0 },
        qualityLow: 0,
        coordLow: 0,
        twoOffers: 0,
        manual: 0,
        total: 0,
      };
    }
    if (techMin['autonomous-company'] !== undefined && !options.extra) break;
  }
  close(run.activeMs);

  const at = (id: TechnologyId) => techMin[id] ?? null;
  const acts = ACT_ENDS.map(at);
  const wallsMin = ACT_STARTS.map((start, i) => {
    const before = at(ACT_ENDS[i] as TechnologyId);
    const first = at(start);
    return before === null || first === null ? null : first - before;
  });
  const order = catalog.technologies.map((t) => t.id);
  const gaps: number[] = [];
  for (let i = 1; i < order.length; i += 1) {
    const id = order[i] as TechnologyId;
    if (ACT_STARTS.includes(id)) continue;
    const a = at(order[i - 1] as TechnologyId);
    const b = at(id);
    if (a !== null && b !== null) gaps.push((b - a) * 60);
  }
  const pm = at('product-management');
  const company = at('autonomous-company');
  return {
    run,
    companyMin: company,
    techMin,
    acts,
    wallsMin,
    cadenceSec: gaps.length ? gaps.reduce((s, g) => s + g, 0) / gaps.length : 0,
    windows,
    twoOffersShare: after4 ? twoAfter4 / after4 : 0,
    hiddenBindingSec: hidden,
    qualityLowShare: late ? qualityLate / late : 0,
    coordLowShare: late ? coordLate / late : 0,
    peakDebt,
    pmToCompanyMin: pm !== null && company !== null ? company - pm : null,
    disasterSec,
    freezeDelaySec:
      freezeAt !== null && techMin.evaluations !== undefined
        ? (freezeAt - techMin.evaluations * 60_000) / 1000
        : null,
    taxedShareEarly:
      managerAt === null
        ? run.stats.taxedCode / Math.max(1, run.stats.lifetimeOutput)
        : taxedEarly / Math.max(1, writtenEarly),
    gigShareByAct: gigByAct.map((g, i) => g / Math.max(1, writtenByAct[i] ?? 0)),
    rentMissed: run.rent.missedTotal,
    evictedMin: run.ending?.id === 'ai-got-my-job' ? run.ending.activeMs / 60_000 : null,
    gigsPaid: run.gigs.paid,
  };
}
