# Agent journal (implementation log for handoff)

Purpose: concise notes for any agent continuing this build. Read this first, then
`docs/implementation_progress.md` (per-task RED/GREEN facts), then the phase file
of the next task. Keep entries short; newest progress at the bottom of each section.

## Standing decisions (deviations / interpretations of the plan)

- D1 (P00) Tooling from a previous agent was found complete but uncommitted; verified
  green (check, build, `node tools/acceptance/run.mjs` 37/37) and committed as P00.
- D2 (art) No human pixel artist available. Production art is authored as **text pixel
  maps / small procedural TS drawing scripts** under `art/` and exported by a node
  script to `public/assets/` PNG + atlas JSON (single export path, generated output).
  This satisfies "editable sources + export command, no proprietary editor".
  Visual quality still needs a human check (P11.2) — recorded as not verified.
- D3 (commits) One commit per phase (user instruction), not per task.
- D4 (P02) Progression model: each technology has one progression upgrade (`discovers`);
  buying it lets `resolveDiscoveries` unlock the tech in the same dispatch. Offers are
  declarative `requires` (+ optional `extraCondition`) because content may only type-import
  game code. Autocomplete offer appears at lifetime output ≥5 (not at t=0).
- D6 (P03) Views get typed read models + `dispatch` via `src/ui/contracts.ts`; App passes
  `illustrationUrl` (from content manifest) and an injectable `createRenderer` (jsdom tests use
  `nullRenderer`). Svelte props use `const { … } = $props()` (lint prefer-const).
- D7 (P03) GameView stays mounted (hidden) while History/Cat are open so the single Pixi
  canvas is never recreated; WorldCanvas only toggles ticker activity.
- D8 (P04) Cat state also stores `needsElapsedMs`, `pendingActions`, care timestamps and
  `lastCare` (for contextual messages). Death time is stamped by `stepRun` (`recordDeath`),
  not by `updateCat`, which has no clock.
- D5 (P02) App-level commands (`retrySave`, `setTheme`) go through the same public
  `dispatch` as game commands, so UI still sees only `{subscribe, dispatch}`.

## Unexpected findings

- F1 The `rtk` hook rewrites `npm run lint` into a filtered command that lints the acceptance
  fixtures and reports bogus errors. Run checks as `rtk proxy npm run check` (exit code is truth).
- F2 P00 fixture `tools/acceptance/fixtures/types/invalid-command-union.ts` used
  `case 'primaryAction'` as the *invalid* variant; once P01 added that real command the fixture
  compiled cleanly. Changed the case to `'launchRockets'` (intent unchanged: invalid variant).

- F3 Playwright pinned to **1.61.1**: it matches the cached `~/.cache/ms-playwright/chromium-1228`;
  `npx playwright install` refuses to download on this host (ubuntu26.04 unsupported). CI on
  ubuntu-latest can still run `npx playwright install --with-deps chromium`.

- F4 `pkill -f "vite preview"` kills the calling shell too (its own command line matches) — use
  `pkill -f "[v]ite preview"`. Playwright `reuseExistingServer` silently serves a *stale* build
  if a manual preview is still running; stop it before `npm run test:browser`.

- F5 Browser fixtures: setting localStorage then `reload()` is overwritten by the old page's
  pagehide save (correct game behavior). Use `loadSave()` in `tests/browser/helpers.ts`
  (addInitScript before boot).

## Progress log

- 2026-10-16: P00 verified + committed. Next: P01.
- 2026-10-16: P01 done (RNG, createRun, runtime clock, step/commands, store, lifecycle).
  35 game tests. Snapshot currently `{ run }`; plan: add view models in P02.2 and keep UI
  off the raw run.
- 2026-10-16: P02 done (economy, 3 techs, discoveries, selectors, validator, save/autosave).
  81 tests. Next P03 (Svelte views, Playwright).
- 2026-10-16: P03 done (Svelte shell, header bars, Pixi host, first-loop + settings specs).
  101 unit/component + 9 browser tests. Next P04 (cat needs, FEED/PET, death).
- 2026-10-16: P04 done (needs, FEED/PET, starvation/sickness, death + memorial, independence
  scenario). 143 unit + 11 browser. Next P05 (PLAY minigame, attention overlay).
