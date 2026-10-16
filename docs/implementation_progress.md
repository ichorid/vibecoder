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

## Task: P03 (three mobile views and first canvas)

Status: **done** (temporary art; device checks pending)

### P03.1 DOM shell and navigation

Files: `src/app/App.svelte`, `src/ui/{Header,GameView,HistoryView,CatView,SettingsMenu,PixelIcon,RecoveryPanel}.svelte`, `src/ui/{contracts,format,pixelArt,styles.css}`, `src/app/bootstrap.ts`, `src/main.ts`, `src/app/App.test.ts`.
RED caveat: components were written before their tests; RED shown by mutation (pushState→replaceState breaks the Back test; removing the theme dispatch breaks the theme test; empty History list breaks the History test).
GREEN: one `view` enum + same-page history entries, Back/return to Game, reload opens Game, same run/economy across views, theme in Settings saved in profile. Corrupt/unsupported save → RecoveryPanel (retry / explicit confirmed new run), never auto-overwritten.

### P03.2 primary input and announcement

Files: `GameView.svelte`, `UnlockAnnouncement.svelte`, `src/ui/GameView.test.ts`, bounded run log (`src/game/log.ts`, `log.test.ts`).
GREEN (tests written after components; verified failing paths by inspection): one command per press, disabled unaffordable card, ≤3 cards, bought card disappears with focus moved to next card/primary, no future title in text/labels/hidden DOM, announcement keeps CAT/HISTORY usable and waits while Cat is open, CONTINUE acknowledges. Missing illustration → pixel fallback frame.

### P03.3 header geometry and layout

Files: `Header.svelte` CSS, `playwright.config.ts`, `tests/browser/layout.spec.ts`, `test:browser`.
RED: at 320×568 the header overflowed horizontally by 8 px. GREEN: narrow-width header tightening. Verified in Chromium: primary visible, no horizontal scroll at 320/390; CAT hit area ≥44×44; both bars ≤ icon width, 3 px tall, 2 px gaps, below the icon; no %/fullness/labels; keyboard reaches Cat/HISTORY/Settings/WRITE CODE; theme does not change progress.

### P03.4 Pixi host

Files: `src/world/{host,renderer}.ts`, `WorldCanvas.svelte`, `host.test.ts`, `tests/browser/world.spec.ts`.
RED: 5/5 host lifecycle tests failed against a no-op host. GREEN: renderer created once, requests before readiness applied later, destroy exactly once (also when disposed before ready), activity toggles ticker only, failure reported. Real Pixi 8 app (lazy chunk), 30 fps ticker, nearest sampling, DPR≤2; browser: one canvas, same element after Game→Cat→Game, resize keeps progress.

### P03.5 first vertical flow

`tests/browser/first-loop.spec.ts`: write → buy → NEW TECHNOLOGY → Cat → Game → CONTINUE → next offer → reload → same code/offer/history; no future title before prerequisites. Initial RED was a test timing bug (read before the 100 ms step) fixed with polling.

### P03.6 settings, sound, music submenu

Files: `SettingsMenu.svelte`, `AudioControls.svelte`, `unavailableAudio` contract, `tests/browser/settings.spec.ts`.
GREEN: Settings → theme, Sound switch (disabled, honestly labeled unavailable until S07), Music › volume slider + Music Lab link to `/music-lab/` (entry created in S04; currently 404), Back returns to Settings, Escape closes and refocuses the opener; no route/view change.

### Temporary visuals

Room/programmer/cat are Pixi Graphics rectangles; header cat icon and Cat portrait are inline pixel maps; technology illustrations are missing (fallback frame). All replaced in P06.

### Exit gate

`npm run check` OK; `test:game` 101/101; `test:browser` 9/9 (mobile Chromium emulation only); build OK (initial JS ≈29 KiB gzip + lazy Pixi ≈76 KiB + renderer backend chunk).
Not verified: real iOS/Android devices.
Next: P04.1.

## Task: P04 (cat life and irreversible death)

Status: **done** (temporary cat/memorial art)

### P04.1 needs and overlapping conditions

Files: `src/game/cat.ts`, `cat.test.ts`, `content/balance.ts` (`catBalance`), `simulation.ts`, `src/app/catRuntime.test.ts`.
RED: 11/14 failed against identity stubs. GREEN: 5 000 ms needs tick (−0.65 fullness, −0.45 mood), capped action modifier 1%/action ≤10% reset per tick, overlapping derived flags (hungry/lonely/attention/overfed/sick/critical/dead) with boundary tests both sides; primary/purchase count as meaningful, care/ack do not (RED: 1 failed before wiring); five hidden minutes leave the cat untouched via runtime.

### P04.2 FEED and PET

Files: `cat.ts` (`feedCat`, `petCat`), `commands.ts`, `care.test.ts`, `content/catText.ts`, `ui/CatView.svelte`, `tests/browser/cat.spec.ts`.
RED: 8/9 failed with stubbed commands. GREEN: seeded integer 18–32 via the cat stream, cap 100, 1 000 ms eating lock without RNG use, PET +3 then 60 000 ms cooldown (`cooldown` result, cosmetic wiggle in UI), cooldown timestamps persisted, care messages from content, immediate save on care. PLAY shown disabled with an honest note.

### P04.3 starvation, recovery, overfeeding

RED: 6/10 new cases failed with decay-only tick. GREEN: explicit tick order (decay → pressure decay → sickness w/ floor 10 → starvation 8/min (<20) or 14/min (≤5) → recovery 4/min (>35 & not sick) → death). One excessive meal (+25) stays below 40; repeated meals reach overfed then sick; sickness costs +1 mood/min; zero mood never kills; sickness floor does not protect a starving cat. Total neglect kills between 8 and 30 active minutes (headless run). One test input corrected (35.5 decays below the recovery threshold; added explicit boundary case).

### P04.4 death, record, memorial

Files: `simulation.ts` (`recordDeath`), types/decoder (`kind: 'cat'` history), `createGame.ts` (immediate save from step facts), `ui/Memorial.svelte`, `pixelArt.ts`, `src/persistence/catSave.test.ts`.
RED: 3/5 failed (no death record/time/history). GREEN: atomic death (alive=false, health 0, diedAtActiveMs, one History entry, one "The cat is gone." line, one `catDied` fact → immediate save), never repeated; economy continues; care rejected without RNG; decoder rejects dead cat with health≠0; reload keeps death and `catAlive=false` world projection. Browser: deceased header icon + empty gray bars, memorial with exactly two photos and no status/care, survives reload, History entry.
Temporary: memorial photos and cat portraits are inline pixel maps (P06 replaces).

### P04.5 independence from productivity

`tests/scenarios/cat-independence.test.ts`, `tests/helpers/scenario.ts` (policy-based driver using read models only). Green from the start; mutation check (adding +0.001 output while the cat lives) makes it fail.

### Exit gate

`npm run check` OK; `test:game` 143/143; `test:browser` 11/11; build OK.
Next: P05.1.
