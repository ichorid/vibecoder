# P00 acceptance handoff (tester → implementer)

Status: **acceptance tests authored**; repository still **docs-only** aside from `tools/acceptance/`. No application bootstrap exists yet.

## Commands

| Command | When | Purpose |
| --- | --- | --- |
| `node tools/acceptance/run.mjs` | **Now** (no `npm install`) | Full P00 acceptance suite |
| `node --test tools/acceptance/bootstrap/*.test.mjs` | After partial scaffold | Bootstrap-gate RED only |
| `node --test tools/acceptance/behavior/*.test.mjs` | After `behaviorRunnerReady()` (see below) | Lint/type/rule **behavior** RED → GREEN |
| `npm run test:acceptance` | Optional later | Implementer may alias `run.mjs` in `package.json` |

`behaviorRunnerReady()` (see `tools/acceptance/lib/bootstrap.mjs`) becomes true when P00.1 scaffold **and** `eslint`, `typescript`, `vitest`, scripts `lint` / `check:types` / `test:rules`, and `eslint.config.js` exist. Until then, behavior suites **skip** (not behavior RED).

## RED evidence (2026-10-15, docs-only tree)

```
ℹ tests 37
ℹ pass 2
ℹ fail 14
ℹ skipped 21
```

### Bootstrap-gate RED (expected now)

All **14 failures** are bootstrap-gate assertions (missing scaffold), not lint/type/rule behavior:

| Req ID | Failure cause |
| --- | --- |
| P00.1-01 … P00.1-08, P00.1-10 | Missing `package.json`, lockfile, `.nvmrc`, Vite/Svelte files, `AGENTS.md`, `.gitignore`, `index.html`, deps |
| P00.1-09 | `npm run build` blocked: bootstrap incomplete |
| P00.2-01 … P00.2-04 | Missing `tsconfig.json`, `tsconfig.game.json`, ESLint/Prettier config, npm scripts, `src/game/types.ts` |

### Skipped (not counted as behavior RED)

**21 skipped** — behavior and post-bootstrap rule checks gated on `bootstrap-gate` / missing rule modules / missing `tsconfig.game.json`.

### Passing (test harness only)

- Fixture catalog present under `tools/acceptance/fixtures/`
- Every requirement ID in `requirements.mjs` is referenced from a test tag

## Requirement coverage map

Registry: `tools/acceptance/requirements.mjs` (32 requirements).

| Area | Bootstrap tests (`bootstrap/`) | Behavior tests (`behavior/`) |
| --- | --- | --- |
| P00.1 | `p00-1-bootstrap.test.mjs` | — |
| P00.2 | `p00-2-tooling-bootstrap.test.mjs` | `p00-2-typescript-behavior.test.mjs` |
| P00.3 | `p00-3-4-rules-bootstrap.test.mjs` (partial) | `p00-3-layer-imports.test.mjs` |
| P00.4 | `p00-3-4-rules-bootstrap.test.mjs` (partial) | `p00-4-time-scheduling.test.mjs` |
| Fixtures | `p00-fixtures-catalog.test.mjs` | — |
| Meta | `meta/requirements-coverage.test.mjs` | — |

## Implementer contract

### 1. Bootstrap (P00.1) — clear bootstrap-gate first

Deliver files and scripts listed in `docs/implementation/phase-00-tooling.md` P00.1. Re-run acceptance until **bootstrap suite is green** before treating behavior skips as failures.

Do **not** add always-green placeholder tests; bootstrap exceptions in the phase doc still apply to **game** TDD, not these acceptance gates.

### 2. TypeScript / ESLint behavior (P00.2)

After minimal configs:

- Wire `tools/type-fixtures/` (or extend `tsconfig.game.json`) so acceptance fixtures compile in isolation:
  - `fixtures/types/invalid-command-union.ts` — needs `GameCommand` + exhaustive `assertNever` in `src/game/types.ts`
  - `fixtures/types/game-uses-document.ts` — must fail without DOM in `tsconfig.game.json`
  - `fixtures/types/valid-game-run-status.ts` — positive case for `RunStatus`
- Point `check:types` / `svelte-check` at `fixtures/svelte/ValidTypedProps.svelte` (Svelte 5 `$props()`).
- ESLint must flag `fixtures/types/lint-*.ts` when run via `npm run lint -- tools/acceptance/fixtures/types/<file>`.
- Enable architecture §11 strict flags; behavior test asserts option names, not internal config shape beyond that.

**Behavior RED** starts when bootstrap is ready and a behavior test **runs** (not skips) but fails on diagnostics.

### 3. Local rules (P00.3–P00.4)

Implement under `tools/eslint-rules/`:

| Rule ID | Acceptance driver |
| --- | --- |
| `vibe/layer-imports` | `behavior/p00-3-layer-imports.test.mjs` + fixtures in `fixtures/eslint/layer-imports/` |
| `vibe/no-ambient-game-time` | `behavior/p00-4-time-scheduling.test.mjs` + `fixtures/eslint/ambient-time/` |
| `vibe/no-raw-content-in-ui` | `fixtures/eslint/raw-content-ui/` |
| `vibe/owned-scheduling` | `fixtures/eslint/owned-scheduling/` |

RuleTester cases use **filename paths** under `tools/acceptance/fixtures/` to simulate `src/` layers. Rules must resolve **aliases**, **re-exports**, and **static `import()`** (see invalid fixtures). Error messages should be a **single actionable line** (phase doc); acceptance only checks message patterns loosely.

`npm run test:rules` should run the same fixtures (implementer-owned); acceptance duplicates critical cases via RuleTester for early RED.

### 4. Positive cases (must stay valid)

- `valid-content-type-only.ts` — type-only import from game contract in `content/`
- `valid-ui-projection.ts`, `valid-ui-read-model.ts` — selectors/read models only
- `valid-game-explicit-args.ts` — elapsed/rng via parameters
- `valid-app-seed.ts` — seeding in `app/` composition
- `valid-runtime-interval.ts` — gameplay timer in `app/runtime.ts`
- `valid-renderer-ticker.ts` — presentation ticker in `world/renderer.ts`

### 5. Explicit non-goals for P00 acceptance

- No browser/Playwright checks
- No game simulation tests
- No production `eslint` disables to greenwash fixtures
- Do not treat **skipped** behavior tests as GREEN

## Unverified behavior (implementer proves after minimal setup)

Until `behaviorRunnerReady()` is true, the following are **not** demonstrated:

- Exhaustive `GameCommand` switching
- Pure-game DOM isolation
- ESLint bans on `any`, `!`, floating promises, `@ts-ignore`
- Full-project `lint` / `check:types` clean
- All four custom rules on valid/invalid fixtures
- `npm run test:rules` integration

Record RED → GREEN per `docs/implementation_plan.md` §2 in `docs/implementation_progress.md` when implementing.

## Suggested implementer loop

1. `node tools/acceptance/run.mjs` → fix bootstrap-gate RED (P00.1–P00.2 bootstrap tests).
2. `npm ci && npm run build` → P00.1-09 green.
3. Re-run acceptance → behavior tests **execute** (no longer skipped).
4. For each failing behavior test, minimal config/rule change → GREEN.
5. `npm run check` (aggregate) before closing P00.
