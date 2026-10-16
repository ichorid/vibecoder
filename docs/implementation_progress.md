# Implementation progress

## Task: P00 (tooling)

Status: **done**

## P00.1 bootstrap

RED: `node tools/acceptance/run.mjs` — 14 fail / 21 skip / 2 pass (bootstrap-gate missing scaffold).

GREEN: `npm ci` OK; `npm run build` OK (dist ~48K, JS gzip ~11.1K); acceptance bootstrap 10/10 pass.

## P00.2 strict TS / ESLint

RED (post-bootstrap): `typecheckFixture('invalid-command-union.ts')` failed until `tools/tsconfig.game.json` bridge; lint fixtures required dedicated `tsconfig.lint-eslint.json`.

GREEN:

- `npm run check:types` — svelte-check 0 errors; `tsc -p tsconfig.game.json`; positive fixture `valid-game-run-status.ts` clean.
- `npm run lint` — 0 warnings on `src/` + `vite.config.ts`.
- `npm run lint -- tools/acceptance/fixtures/types/lint-*.ts` — non-zero exit (any, `!`, floating promise, `@ts-ignore`).
- Behavior: `invalid-command-union.ts` TS2678; `game-uses-document.ts` TS2584 (no DOM in game config).

## P00.3 layer imports

RED: RuleTester parse errors on `import type` until `@typescript-eslint/parser` in acceptance `rule-tester.mjs`; layer paths without leading `/` missed `src/game/`.

GREEN: `npm run test:rules` pass; acceptance P00.3 behavior 6/6.

## P00.4 time / scheduling

RED: `invalid-content-set-timeout.ts` double diagnostic; `performance` / `crypto` member access not reported.

GREEN: acceptance P00.4 behavior 6/6.

## Final verification (2026-10-15)

| Command | Result |
| --- | --- |
| `npm ci` | OK |
| `npm run check` | OK (types, lint, format, test:rules) |
| `npm run test:rules` | 1 file, 1 test pass |
| `npm run build` | OK |
| `node tools/acceptance/run.mjs` | 37/37 pass |

## Notes

- Harness / fixture caveats: `/tmp/vibecoder-tdd/P00/implementation-test-issues.md`
- `GameCommand` union minimal for acceptance; `RunStatus` is the only P00 domain surface besides that fixture hook.
- CI: `.github/workflows/ci.yml` runs `npm ci`, `npm run check`, `npm run build`.

Next task for another agent: **P01** (not started here).

## Task: P01 (core and active time)

Status: **done**

### P01.1 new run + seeded RNG

Files: `src/game/{ids,types,random,createRun}.ts`, tests beside them, `vitest.config.ts`, `test:game` script.

RED: `random.test.ts` 3/5 failed against a constant stub (same/different seeds, inclusive bounds, stream derivation); `createRun.test.ts` 4/4 failed against a throwing stub.
GREEN: mulberry32 (uint32 state) + FNV-1a stream derivation; `createRun(seed, runId)` with economy/cat/narrative streams and a separate constant `visualSeed`. `npm run test:game` 9/9.

### P01.2 runtime clock on fake clock

Files: `src/app/runtime.ts`, `runtime.test.ts`, `tests/helpers/fakeClock.ts`.

RED: 9/10 failed against a no-op stub. GREEN: fixed 100 ms steps with carried remainder, independent pause reasons, gaps >1000 ms discarded (exactly 1000 allowed), negative/NaN deltas rebaseline without rewinding, single owned interval, idempotent dispose.

### P01.3 step + sequential command

Files: `src/game/{catalog,simulation,commands}.ts`, `simulation.test.ts`, `tests/helpers/catalog.ts`.

RED: 3/6 failed against identity stubs (active time, queued work → output once, command sees previous). GREEN: `stepRun` (activeMs, queued manual work → output/lifetime once), `applyCommand` with typed result, unknown command → `unavailable` (exhaustive `never` check + runtime-safe default).

### P01.4 store + browser adapter

Files: `src/app/{gameStore,createGame,lifecycle}.ts` + tests.

RED caveat: modules were written in the same pass as their tests (no behavioral RED observed first). Compensated by mutation checks: moving `settle()` after `applyCommand` fails the ordering test; disabling freeze fails the read-only test.
GREEN: immediate subscriber snapshot, unsubscribe, deep-frozen snapshots, public API exactly `{subscribe, dispatch}`, dispatch settles → applies → publishes once, dispose idempotent; lifecycle adapter maps visibility/blur/pagehide/freeze to pause reasons, settles before pausing, detaches listeners.

### Exit gate

`npm run check` OK; `npm run test:game` 35/35; `npm run build` OK; acceptance 37/37.
Not yet verified: real mobile lifecycle (fake lifecycle only).
Next: P02.1.

## Task: P02 (first loop and saving)

Status: **done**

### P02.1 WRITE CODE and first prices

Files: `src/game/{ids,catalog,economy,progression}.ts`, `src/content/{balance,upgrades,technologies,catalog}.ts`, `economy.test.ts`, `tests/helpers/run.ts`.
RED: 3/5 failed with `buyUpgrade` stubbed to `unavailable` (unaffordable result, exact price, double purchase).
GREEN: prices 10/30/90 output, one-time `maxLevel: 1`, visibility re-checked in the handler, lifetime output untouched by spending, `roundAmount` to avoid float drift.

### P02.2 discoveries and visibility

Files: `progression.ts`, `selectors.ts`, `progression.test.ts`.
RED: 5/7 failed against stub selectors/resolver (offer visible before price, once-only effect + history + announcement, ack gating, IDE passive/PROMPT).
GREEN: progression upgrade → `resolveDiscoveries` commits unlock + History + pending announcement once; progression offers hidden while an announcement is pending; `acknowledgeUnlock` idempotent (`unavailable` on repeat); derived rates from definitions; `selectGame` ≤3 offers by priority; no future titles in Game/History models.

### P02.3 content checks

Files: `tools/validateContent.ts`, `tools/checkContent.ts`, `tools/validateContent.test.ts`, `src/content/{assets,world}.ts`, `check:content` (in `check`).
RED: 7/8 failed against an always-empty validator. GREEN: duplicates, unknown prerequisites/technologies, cycles, invalid price/growth/maxLevel, unknown effect kinds, missing illustration/world addition. Manifest entries are flagged `placeholder: true` — release debt reported by the CLI.

### P02.4 envelope and safe loading

Files: `src/persistence/{save,decode,migrations}.ts`, `save.test.ts`, `tests/helpers/memoryStorage.ts`.
RED: 15/18 failed against stub decode/adapter. GREEN: one versioned envelope (schema 1, content 1, revision, profile, run); strict structural+range decoding; future schema → `unsupported`; corrupt saves preserved untouched; dead/alive death-fact consistency; wall-clock metadata ignored; identity migration only.

### P02.5 autosave

Files: `src/app/createGame.ts`, `autosave.test.ts`.
RED: 5/7 failed before persistence wiring. GREEN: periodic save every 5 active s while dirty, immediate save on purchase/discovery, clicks coalesced, typed `save.status` with `retrySave`, suspension writes settled time, reload does not reapply effects. Snapshot now carries `game`/`history` view models and `profile`.

### Exit gate

`npm run check` OK (incl. `check:content`); `npm run test:game` 81/81; build OK; acceptance 37/37.
Next: P03.1.
