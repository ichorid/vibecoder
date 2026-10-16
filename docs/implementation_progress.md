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

## Task: P05 (PLAY, honest input, intrusive cat)

Status: **done** (desktop-emulated; real touch fairness not verified)

### P05.1 attempt geometry

Files: `src/game/catPlay.ts`, `catPlay.test.ts`, `catPlayBalance`.
RED: 9/12 failed against stubs. GREEN: triangle wave 0→1→0, `mousePosition(speed, elapsedMs)`, inclusive-edge `scoreAttempt` with near ≤0.03 (epsilon for float edges), targets 15–30 % inside the track, speed 0.40–0.75 clamped so one target crossing ≥200 ms.

### P05.2 three attempts and rewards

Files: `src/game/catPlaySession.ts`, `catPlaySession.test.ts`, commands/types/decoder.
RED: 9/9 failed against stubs. GREEN: ready 300 / movement 4 000 / result 300 ms per attempt (13.8 s session); early hit fixes the result but the next attempt waits for the slot; stale/duplicate attempt IDs rejected; timeout → miss; hit seeded 8–12, near +1, cap 100; no completion bonus; leave cancels; second session/dead cat rejected; session state persisted and validated.

### P05.3 DOM track and input

Files: `src/ui/CatPlay.svelte`, `src/app/frameLoop.ts` (disposable rAF helper), runtime `pendingMs`/`inputLagMs`, `dispatch(command, { timeStamp })`, `tests/browser/cat-play.spec.ts`.
GREEN: track inside Cat view (no route); mouse transform from the shared active clock each frame using the same `playPosition`; catch judged at the normalized event timestamp (clamped to the active interval); pointerdown + following click scores once; Space works, auto-repeat ignored, Enter works; track fits 320/390 px. Runtime additions tested (written alongside, no separate RED run).

### P05.4 pause, resume, leave, death

Files: `src/app/catPlayLifecycle.test.ts`, `createGame.resume`, `lifecycle.ts` (now drives the composed game), bootstrap resume after reload.
GREEN: background freezes the attempt (no active time), resume inserts a 500 ms cue and shifts the movement origin so position is continuous; needs/economy get no extra pause; reload restores the same attempt (App reopens Cat for a live session — decision D9); leave cancels; death cancels and later input is rejected. Mutation check: removing the resume dispatch fails the cue test.

### P05.5 foreground attention

Files: `cat.ts` (`updateAttention`, `visibleAttention`), `attentionBalance`, `ui/CatOverlay.svelte`, `tests/browser/attention.spec.ts`, fixtures `lonelyRun()`.
RED: 4/5 failed against a null schedule. GREEN: mood 20–39 → small for 4 s every 45 s; <20 → large for 6 s every 25 s; first after one interval from first observation; never queued; hidden when mood recovers, dead, ended, or outside Game. Browser: large intrusion is the element under the primary button's centre, tapping it opens Cat, HISTORY/CAT stay usable; small one smaller than the button. Placement only on present surfaces (visual review found the card spot off-screen without cards).

### Exit gate

`npm run check` OK; `test:game` 177/177; `test:browser` 17/17; build OK (initial JS 36 KiB gzip).
Not verified: real touch timing on iOS/Android (P11.3).
Next: P06.1.

## Task: P06 (persistent world, art, recursive zoom-out)

Status: **done** for the current three technologies (device performance not measured)

### P06.1 manifest and atlas import

Files: `art/` (canvas, shapes, font, PNG encoder, packer, palettes, sprites, illustrations), `tools/art/{build,export,preview}.ts`, `src/content/{atlas,assets}.ts`, `tools/{validateAssets,assetFiles}.ts`, `art/README.md`.
RED: PNG/canvas 7/8 failed against stubs; atlas contract 6/7; asset validator 4/5. (Shape/font/packer helpers were tested alongside their implementation.)
GREEN: one documented `vibe-atlas/1` PNG+JSON contract produced only by `npm run art:export` (deterministic bytes); `art:check` (in `check:content`) fails on stale/hand-edited output; validator rejects wrong format, unknown frames, non-positive durations, out-of-bounds rects, PNG size mismatch, missing files and missing required tags. The same cat tag feeds Pixi (`toPixiSheet`) and DOM (`domAnimation` → `AtlasSprite.svelte`). Cat tags idle/sleep/walk/eat/play/pet/lonely/sick/attention plus `cat-round-*`.

### P06.2 scene and camera math

Files: `src/content/world.ts`, `src/world/camera.ts`, `camera.test.ts`.
RED: 6/7 failed against stubs. GREEN: room fixed at (0,0); unique addition IDs and valid links; strictly growing portrait envelopes; fit contains the envelope, zoom decreases with unlocks, resize refits without unlocking; `screen = (world − center) × zoom + viewportCenter`; one easing, log-space zoom, 1.6 s transitions.

### P06.3 LOD and the world cat's fate

Files: `src/world/lod.ts`, `lod.test.ts`.
RED: 5/6 failed. GREEN: CSS-pixel bands detail ≥96 / compact ≥16 / dots with 10 % hysteresis; cat sprite ≥12 px → cluster ≥3 → pixel ≥0.5 → hidden; always hidden when dead or at final framing. Late framing is still only proven by the explicit numeric fixture (no final technology yet).

### P06.4 reveal and kit

Files: `src/world/{renderer,scenePlan}.ts`, `scenePlan.test.ts`, `selectWorld.test.ts`, `src/app/{assetUrls,domSheet}.ts`, `ui/{AtlasSprite,Memorial,CatView,CatOverlay,UnlockAnnouncement}.svelte`, `tests/browser/world-reveal.spec.ts`.
GREEN: renderer rebuilt on the atlas (clusters, connectors, moving packets, per-cluster LOD, wandering cat with presentation-only RNG, palette swap on theme, cosmetic slow-down during announcements, reduced-motion jump). Pure planner: static rebuild from unlocked IDs, pending reveal only while Game is visible (replayed after reload), never rebuilds existing clusters. Browser: reveal + zoom-out during the announcement, real 128×96 illustration, rebuilt scene after theme switch with cat present, dead cat absent, memorial = exported PNGs, Cat view uses `cat-idle` from the atlas. Announcement moved to the lower world area so the reveal is visible (visual review). Three unique illustrations, room/programmer/cat/kit and memorial art are generated (procedural pixel art; artistic quality still needs human review).

### P06.5 budgets

Files: `tools/reportSize.ts` (runs in `npm run build`), `tests/browser/world-budget.spec.ts`.
Measured (production build, this commit): entry JS 37.9 KiB gzip; all JS incl. lazy Pixi 214.5 KiB gzip (budget 350); first assets (light atlas + CSS) 37 KiB (budget 1 MiB); all PNG art 18 KiB; atlas 512×256 (≈0.5 MiB RGBA each theme). Browser: ticker stops while Game is hidden, updates never rebuild sprites, failed illustration → fallback frame without blocking.
Not measured: frame time / GPU memory on a real phone; late-game composition (exists only after P08).

### Exit gate

`npm run check` OK; `test:game` 225/225; `test:browser` 25/25; build within budgets.
Next: P07.1.

## Task: P07 (agents, review, coordination)

Status: **done** (12 technologies; manual playtest pending)

### P07.1 tokens, agent, compute

Files: `src/game/{economy,commands,progression,catalog,types,ids}.ts`, `agents.test.ts`, `tests/helpers/unlock.ts`, content for `terminal-agent`, `token-supply`, `compute-slot`.
RED: tests written before the economy step (missing functions/IDs). GREEN: one potential→funded→useful calculation (`stepEconomy`): active agents = min(agents, compute), agents need queued tasks (PROMPT queues, capped), funded by tokens (unfunded capacity idles), stocks never negative, token reserve cap; manual work is free; discovery grant once in the transaction; shared primary-action budget (10 presses/s, burst 10) so clicking cannot bypass bottlenecks.

### P07.2 review and technical debt

Files: economy (`qualityEfficiency`), `debt.test.ts`, content 05–09.
RED: 6/6 failed (missing IDs/effects). GREEN: debt from funded unchecked work only, quality `max(0.2, 1/(1+debt/100))`, review removes debt without creating tokens, never below 0, review still works when token-starved.

### P07.3 parallel agents and coordination

Files: economy (`coordinationEfficiency`), `coordination.test.ts`, content 10–12 + `review-capacity`, `additional-agent`.
RED: 6/6 failed. GREEN: coordination `max(0.2, min(1, managed/agents))`; extra compute without management gives no extra useful output while burning 3× tokens; DELEGATE (+1 temporary managed, cap 3, decays 0.1/s); SUPERVISE (−2 debt per press, bounded by the action budget); worktrees +1 managed, manager +4; repeatables base × growth^level, max 8; progression card first, recovery card (token supply when tokens < 10) before optional cards, max three. One test expectation corrected: it assumed extra compute always helps — the intended bottleneck says it does not.

### P07.4 early catalog

Files: `src/persistence/transitions.test.ts` (27 table-driven checks for 04–12: offer only after prerequisite and before price, exact price, once-only effect + one History entry, action label PROMPT/DELEGATE/SUPERVISE, authored world addition, save roundtrip), nine unique illustrations, world additions, `tests/browser/agents.spec.ts` (empty room → working agent with real presses; reviewer purchase with Debt in header).

### P07.5 no dead ends, early narrative

Files: `src/game/narrative.ts`, `narrative.test.ts`, `src/content/events.ts`, `tests/scenarios/early-automation.test.ts`, `tests/helpers/scenario.ts` (baseline buyer/primary), `tools/tune.ts`.
RED: the first scenario run stalled after autonomous edits (debt-limited ~19 min, no recovery before the reviewer, manager unreachable in 25 min). GREEN after tuning (reasons below): manager at 14.2 active min (seed 101), 164 s token-limited and 66 s debt/coordination-limited, recovery from zero tokens + debt 120 without purchases, cat alive with baseline care, no duplicate history. Narrative: once/cooldown events, one line per step, quiet on discovery/death steps, significant events in History.

Balance changes vs plan starting values (reason: the plan's numbers produced a flat ~6/s economy for 20 min): terminal agent 6 work/s, supply 4/s, 150 tokens, 12 task·s per PROMPT (cap 60); debt rate 0.01 (+0.01 Ralph) with a 0.05/s test review from autonomous edits; larger work/agent steps; token-supply +6/level at ×1.6; parallel agents bring +12 supply; prices 04–12 = 450…4 200 (≈60–90 s of current production). Table updated in `docs/content_catalog.md`.

### Exit gate

`npm run check` OK; `test:game` 283/283; `test:browser` 27/27; build within budgets (entry 42 KiB gzip).
Next: P08.2 (P08.1 table exists in `docs/content_catalog.md`).
