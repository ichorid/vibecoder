/**
 * Declarative technology → music rules (`music/binding.json`). The game's committed progress is
 * reduced to unlocked technology IDs; the matching rule of the *latest* technology in the
 * progression order wins, so the result depends only on the set of IDs, never on the order of UI
 * notifications. Cat state is not an input.
 */
export interface MusicIntent {
  readonly era: string;
  readonly arrangement: string;
}

export interface BindingRule extends MusicIntent {
  readonly technology: string;
}

export interface MusicBinding {
  readonly schemaVersion: 1;
  readonly initial: MusicIntent;
  readonly rules: readonly BindingRule[];
}

const isId = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v);

function intent(value: unknown, where: string): MusicIntent {
  const v = value as Partial<MusicIntent> | null;
  if (!v || !isId(v.era) || !isId(v.arrangement)) throw new Error(`binding: invalid ${where}`);
  return { era: v.era, arrangement: v.arrangement };
}

export function parseBinding(value: unknown): MusicBinding {
  const v = value as { schemaVersion?: unknown; initial?: unknown; rules?: unknown } | null;
  if (!v || v.schemaVersion !== 1 || !Array.isArray(v.rules)) {
    throw new Error('binding: expected schemaVersion 1 with rules');
  }
  const rules = v.rules.map((rule: unknown, i) => {
    const technology = (rule as { technology?: unknown } | null)?.technology;
    if (!isId(technology)) throw new Error(`binding: invalid rules/${i}/technology`);
    return { technology, ...intent(rule, `rules/${i}`) };
  });
  return { schemaVersion: 1, initial: intent(v.initial, 'initial'), rules };
}

export function resolveBinding(
  binding: MusicBinding,
  unlocked: readonly string[],
  order: readonly string[],
): MusicIntent {
  const have = new Set(unlocked);
  let best: BindingRule | null = null;
  let bestIndex = -1;
  for (const rule of binding.rules) {
    const index = order.indexOf(rule.technology);
    if (have.has(rule.technology) && index > bestIndex) {
      best = rule;
      bestIndex = index;
    }
  }
  return best ? { era: best.era, arrangement: best.arrangement } : binding.initial;
}
