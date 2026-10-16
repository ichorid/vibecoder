/**
 * Code a demo (docs/feature_demo.md): a cosmetic code sink. Once the project works, the next
 * demo is always on offer; it costs its price (×`priceGrowth` each time), never all the code.
 * The run stores only a seed per demo, drawn from `rng.demo`, so which demos a run makes never
 * depends on when they are made; pictures and texts are derived from the seeds.
 */
import type { Catalog, CatAwareText, DemoContent } from './catalog';
import { catAware } from './catAware';
import { MAX_DEMOS } from './ids';
import { appendLog } from './log';
import { deriveSeed, nextInt, nextUint32 } from './random';
import type { Transition } from './simulation';
import type { DemoRecord, ReadonlyRun, RunState } from './types';

/** Variants offered for the next demo (0…VARIANT_PICKS−1), and the mystery pick after them. */
export const VARIANT_PICKS = 3;
export const MYSTERY_PICK = 3;

/** Price of demo `n` (1-based), rounded to a tidy number. */
export function demoPrice(content: DemoContent, n: number): number {
  const raw = content.basePrice * content.priceGrowth ** (n - 1);
  const step = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / step) * step;
}

export interface DemoOffer {
  readonly number: number;
  readonly price: number;
  /** The seed the next demo will get (the previews are built from it). */
  readonly seed: number;
}

/** The demo on offer now (null before the project works, after the end, or at the cap). */
export function nextDemo(run: ReadonlyRun, catalog: Catalog): DemoOffer | null {
  if (run.status !== 'playing') return null;
  if (!run.unlockedTechnologyIds.includes(catalog.demos.availableFrom)) return null;
  const number = run.demos.length + 1;
  if (number > MAX_DEMOS) return null;
  return { number, price: demoPrice(catalog.demos, number), seed: nextUint32(run.rng.demo).value };
}

/** `count` distinct entries of `items`, drawn in order from `state`. */
function draw<T>(items: readonly T[], count: number, state: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  let s = state;
  while (out.length < count && pool.length > 0) {
    const d = nextInt(s, 0, pool.length - 1);
    s = d.state;
    const [item] = pool.splice(d.value, 1);
    if (item !== undefined) out.push(item);
  }
  return out;
}

export interface DemoText {
  readonly title: string;
  readonly group: string;
  readonly greetings: readonly string[];
  readonly scroller: readonly string[];
}

/** The demo's texts, fixed by its seed and by whether the cat was there. */
export function demoText(record: DemoRecord, catalog: Catalog): DemoText {
  const content = catalog.demos;
  const text = (t: CatAwareText) => catAware(t, record.catAlive);
  const [first] = draw(content.titleFirst, 1, deriveSeed(record.seed, 'title-1'));
  const [second] = draw(content.titleSecond, 1, deriveSeed(record.seed, 'title-2'));
  const [group] = draw(content.groups, 1, deriveSeed(record.seed, 'group'));
  const howMany = 3 + (deriveSeed(record.seed, 'greetings-count') % 3);
  return {
    title: `${first ?? 'Untitled'} ${second ?? 'Demo'}`,
    group: group ?? 'Anonymous',
    greetings: draw(content.greetings, howMany, deriveSeed(record.seed, 'greetings')).map(text),
    scroller: draw(content.scroller, 3, deriveSeed(record.seed, 'scroller')).map(text),
  };
}

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

/** The log and History line of a demo. */
export function demoLine(record: DemoRecord, catalog: Catalog): string {
  const { title, group } = demoText(record, catalog);
  return fill(catalog.demos.madeText, { n: String(record.number), title, group });
}

type MakeResult =
  | { readonly accepted: true; readonly transition: Transition }
  | { readonly accepted: false; readonly reason: 'unavailable' | 'unaffordable' };

export function makeDemo(run: RunState, catalog: Catalog): MakeResult {
  const offer = nextDemo(run, catalog);
  if (!offer) return { accepted: false, reason: 'unavailable' };
  if (run.economy.output < offer.price) return { accepted: false, reason: 'unaffordable' };
  const seed = nextUint32(run.rng.demo);
  const record: DemoRecord = {
    number: offer.number,
    seed: seed.value,
    pick: run.demoPick,
    catAlive: run.cat.alive,
    activeMs: run.activeMs,
  };
  const next = appendLog(
    {
      ...run,
      rng: { ...run.rng, demo: seed.state },
      economy: { ...run.economy, output: run.economy.output - offer.price },
      demos: [...run.demos, record],
      demoPick: null,
      history: [...run.history, { kind: 'demo', number: record.number, activeMs: run.activeMs }],
    },
    `💾 ${demoLine(record, catalog)}`,
    catalog,
  );
  return {
    accepted: true,
    transition: { run: next, facts: [{ type: 'demoMade', number: record.number }] },
  };
}

/** Design the next demo: one of the previewed variants, the mystery, or null (the judge). */
export function designDemo(
  run: RunState,
  pick: number | null,
  catalog: Catalog,
): { readonly accepted: true; readonly transition: Transition } | { readonly accepted: false } {
  const valid = pick === null || (Number.isInteger(pick) && pick >= 0 && pick <= MYSTERY_PICK);
  if (!valid || !nextDemo(run, catalog)) return { accepted: false };
  return {
    accepted: true,
    transition: { run: { ...run, demoPick: pick }, facts: [{ type: 'demoDesigned' }] },
  };
}

/** One log line the first time a demo is affordable. */
export function demoNotice(run: RunState, catalog: Catalog): RunState {
  const offer = nextDemo(run, catalog);
  if (!offer || run.demos.length > 0 || run.economy.output < offer.price) return run;
  const id = 'demo-open';
  if (run.narrative.fired.includes(id)) return run;
  return appendLog(
    { ...run, narrative: { ...run.narrative, fired: [...run.narrative.fired, id] } },
    `💾 ${catalog.demos.notice}`,
    catalog,
  );
}
