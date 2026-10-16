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
- D9 (P05) Reload normally opens Game, **except** when a PLAY attempt is saved in progress:
  App reopens Cat and bootstrap dispatches `resumeCatPlay` (500 ms cue). Rationale: P05.4 needs
  reload to restore the session, while navigating away cancels it.
- D10 (P05) Input timing: `dispatch(cmd, { timeStamp })`; createGame maps event time into the
  active clock via `runtime.inputLagMs` (clamped to the current active interval).
- D11 (P06) Art pipeline realised as planned in D2: `art/` TS sources → `npm run art:export`
  → `public/assets/` (committed, generated, checked by `art:check`). Kit motifs `kit-<id>` and
  `lod-<id>` live in `art/sprites/kit.ts`; illustrations register in `art/illustrations/index.ts`
  and the manifest `src/content/assets.ts`. New technology = illustration fn + manifest entry +
  world addition in `src/content/world.ts`.
- D12 (P06) Renderer mirrors presentation state on the canvas (`data-built`, `data-zoom`,
  `data-cat-lod`, `data-ticker`, `data-sprites`) for browser specs; never read by gameplay.
- D13 (P07) Economy model is documented at the top of `docs/content_catalog.md` (tasks →
  tokens → compute → coordination → quality). Agents need queued tasks (PROMPT, then passive
  task effects); a shared action budget caps every primary action. Retuned starting values are
  listed in progress P07.5. Tune with `npx vite-node tools/tune.ts -- <seed> <minutes>`.
- D14 (P08) LOD thresholds 32/8 px (plan start 96/16) after visual review. Release content
  check is part of `npm run check`. Revenue-priced upgrades use `currency: 'revenue'`.
- D15 (P09) Decision cards share the ≤3 card surface (priority: progression 10, recovery 20,
  choices 30, repeatables 50+); max two choices while a progression card shows. Choices have
  windows (see content_catalog "Endings"). `restart` is an app command (createGame `newRun`).
  P09.6 extension endings skipped for now (optional per plan).
- D16 (S00) Music: data in `music/` (schemas, eras, presets, arrangements, motif, patterns);
  pure core `src/music/core/` (Ajv + Tonal, no DOM); generated types
  `src/music/data/patterns.generated.ts` (`npm run music:types`). Music tests run with
  `npm run test:music` (excluded from `test:game`). Progress log: `docs/sound_implementation_progress.md`.
- D17 (S03) Era transitions: tempo is a phrase property (backend applies `plan.bpm` at its start
  tick, never a transport reset). Optional stinger = director option
  `transitions: [{from,to,stinger:'id@rev'}]` naming a validated library pattern; it occupies its
  own compiled ticks; missing → skipped. No separate fade stage: instrument releases are bounded.
  No transition JSON schema yet (none needed until a stinger is authored).
- D18 (S04) Music Lab = second Vite page (`music-lab/index.html`), no router. Production Lab bundles
  only `music/patterns/**/*-demo-*.json` (file-name convention) until S06 publishes an approved
  pack; dev serves everything. `reportSize.ts` walks `dist/.vite/manifest.json` and fails if the
  game page reaches Lab modules. One director per Lab document (`setLibrary` per mode).
- D19 (S05) Review hash payload = pattern minus `metadata` + era + motif + era *default*
  arrangement + presets of the roles with events (see `src/music/core/canonical.ts`). Other
  arrangements of the era are not in the hash (they are mixes, chosen by the game). Local
  candidates with semantic errors are accepted (shown "cannot play", can't be approved);
  structural/catalog errors are rejected at import.
- D20 (S06) Packs are generated JSON in `src/music/data/pack.{approved,demo}.json` (Prettier-
  ignored; `music:check-pack` byte-compares). Exact duplicates under different IDs are validator
  errors. Third-party notices come from the lockfile (`npm run notices`), not from node_modules
  scans. vite-node strips the script path from `process.argv`: keep CLI and library in separate files.
- D21 (S07) `AudioControls` UI contract became a readable store (`AudioView`). Game audio is
  one lazy module `src/app/gameAudio.ts`; demo pack only with `VITE_MUSIC_PACK=demo` on the dev
  server. Browser playback proof = routed test-pack fixture + `AudioScheduledSourceNode.start`
  counting (test-only). Remembered "Sound on" resumes on the first gesture of a visit.
- D22 (P10) Tab ownership: Web Lock claimed before boot (waiting tab never loads the save);
  fallback = storage-event revision check (best effort). Graphics context loss = app commands
  `graphicsPause/graphicsResume` → runtime pause reason `graphics`. Save fixtures = real v1 saves.
- D23 (user request, after S09) Cat intensity ×3: `CAT_INTENSITY` in `src/content/balance.ts`
  multiplies every time-based cat rate and divides the PET cooldown; per-action gains unchanged.
  Baseline care cadence in `tests/helpers/scenario.ts` `CARE` is derived from it (feed 60 s, pet
  20 s, PLAY 90 s). Neglected cat dies at ~4.8 min; a meal is needed about every minute. Rule
  tests now read numbers from the balance. Supersedes the plan's "feed every 3–4 min".
- D24 (user request) Tokens bought with code: see docs/content_catalog.md "Tokens are bought
  with code". Save schema 2 + real v1→v2 migration (v1 fixtures kept, v2 added). Baseline buyer
  in tests/helpers/scenario.ts buys packs/automation like a sensible player. The early-route
  token acceptance now asserts "tokens short > 20 s and ≥ 3 packs" (agents no longer idle at 0
  because a pack is bought first). Merge-conflict route excludes review capacity from its first
  phase (its premise is "no extra review").
- D25 (user request) Weak cat goes quiet; ignored cat leaves as a stray. Health below
  `criticalBelow` (20) → no intrusions (`attentionBalance.quietBelowHealth`); the world cat
  already sleeps in place when critical. "Ignored" = mood below `attentionBelow` (40, the
  begging band), not `lonelyBelow`: at ×3 intensity mood falls ~16/min, so it sits under 70
  even with PET every 20 s. After `strayAfterIgnoredMs` (24 min / intensity = 8 min) of
  continuous begging while not critical, the cat leaves: `alive=false`, `leftAtActiveMs`,
  history `cat-left`, fact `catLeft`, NO log line (narrative quiet that step). Feed-only cat
  leaves ≈ 10.75 min; a starving cat dies first (critical cats don't count). Fate texts
  `text.stray` for all ten endings; `EndingRecord.catLeft`. Cat view shows a MISSING poster.
  Save schema 3 (2→3 adds `leftAtActiveMs: null`, `ignoredMs: 0`, `ending.catLeft: false`);
  v1/v2 fixtures kept, v3 + `v3-stray-cat` added. Feed+pet-only scenarios (early-automation,
  cat-independence, `progressedRun`) now also PLAY, as the plan's baseline care does.
- D26 (user request) Ship It implemented per docs/feature_ship_it.md, with these deviations:
  (1) save schema 4 (3 was taken by the stray cat); 3→4 adds `releases: []`, a release RNG
  stream derived from the run ID, and drops `choices['ship-original']`; v3 fixtures kept, v4
  (+ `v4-shipped`) added. (2) "No cat" = dead OR stray (`catAlive` false); the jackpot ending's
  stray text equals its no-cat text. (3) Card order: choices first, release card after them
  (before optional repeatables), not before choices — with three slots, release-first hid The
  Perfect SaaS (window 4 overlaps product-management/finance) and Expand (window 5 never
  closes). Mid-game ≤ 1 choice overlaps a window, so the release still shows; in the end game
  (no progression card) the release is an extra 4th card so the 12 % window stays reachable.
  (4) Wheel ticks, result sting and jackpot fanfare are driven by the wheel through
  `AudioControls.effect` (new SFX ids tick/release/jackpot) so they match the animation, not by
  facts. (5) The wheel overlays the whole Game view (like the discovery announcement).
  (6) Window open/closed log lines use `narrative.fired` keys `release-open-k`/`release-closed-k`.
  (7) Frames hang in a column left of the poster (5 slots); the renderer rebuilds the room
  cluster when the release count changes (`data-release-frames`). (8) The wheel lands in the
  middle 40 % of a slice (no near-miss staging). Measured: always-ship (seed 1) reaches the
  company at 43.3 min vs ~31.5 baseline and ships all five (v3.0 at 47.9); 5000-seed draw
  check gives 18–22 % jackpots. Jackpot route: seed 1868 wins at v0.1. Comments verified
  verbatim against pyjokes `jokes_en.py` (downloaded 2026-10-16).
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

- F6 Prettier reflows code, so exact-string scripted edits break. A formatter-tolerant helper
  lives in the session scratchpad (`wedit.py`); if unavailable, re-read files and use Edit.

- F7 Killing the preview: any shell whose command line contains the preview command text is
  matched by `pkill -f`. Use scratchpad scripts `preview-start.sh` / `preview-stop.sh` and run
  them by path only (recreate them if the scratchpad is gone).

- F8 Tone 15.1.22 creates its global AudioContext at *import time* (Chrome logs "AudioContext
  was not allowed to start"). Never import `tone` from the game entry before a user gesture;
  the backend module is loaded lazily. Verified in the S02 spike: `transport.schedule(cb, '192i')`
  (ticks), audio-time callback args, `transport.clear(id)` and `Tone.Offline` work.

- F9 (S03) Tone `Draw` callbacks never fire inside `Tone.Offline` and are rAF-driven live
  (hidden tab → none). A director that plans the next phrase from the *audible* callback stalls
  after one phrase. Port now has `schedulePhrase(plan, onAudible, onCommit?)`: `onCommit` runs on
  the audio clock (transport callback, lookahead) and drives scheduling; `onAudible` is UI only.
  Consequence: phrase N+1 exists (uncommitted) for nearly all of N, so a late request replaces
  N+1 — the director test now asserts "only the uncommitted phrase after the boundary is
  replaced" instead of "nothing cancelled".
- F10 (S03) Offline probes must use the audio clock (`context.setTimeout`); transport-time
  offsets are converted to ticks at the tempo current when scheduled, so they lie after a BPM change.
- F11 (P10) CDP `Page.setWebLifecycleState: frozen` does not freeze a visible headless page (no
  `freeze` event). Lifecycle browser tests dispatch synthetic events; real freezes need devices.
- F12 (P10) A `disabled` button that has focus drops focus to `<body>`, so a dialog's Escape
  handler stops working — use `aria-disabled` for transient "busy" states.
- F13 (P11) vite preview's SPA fallback serves the *game* for `/music-lab` (no slash); the game
  entry redirects to `/music-lab/` before claiming the save lock.
- F14 (P11) npm (this version) skips esbuild's postinstall under its install-script allowlist;
  builds still work via `@esbuild/linux-x64`.
- F15 (S08) `Tone.Offline` runs every transport callback before rendering; disposing nodes in a
  callback erases their earlier notes. Backend releases idle voice banks only in realtime contexts.
- F16 (S08) Opening Settings with a real click is a gesture that resumes interrupted audio; tests
  that need to *see* the interrupted state open Settings with a programmatic `click()`.

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
- 2026-10-16: P05 done (PLAY minigame, input timing, resume cue, attention overlay).
  177 unit + 17 browser. `tools/screens.ts` (vite-node) screenshots fixture scenes for review.
  Next P06 (atlas/art pipeline, camera, LOD, reveal).
- 2026-10-16: P06 done (art pipeline, atlas, camera, LOD, renderer, reveal, budgets).
  225 unit + 25 browser. Next P07 (tokens/agents/compute, debt/review, coordination, techs 04–12).
- 2026-10-16: P07 done (agents/tokens/tasks, debt/review, coordination, techs 04–12, early
  narrative, early-automation scenario: manager at ~14 min). 283 unit + 27 browser.
  Next P08.2 (infrastructure techs 13–17).
- 2026-10-16: P08 done (28 techs, revenue/costs, OPTIMIZE/OBSERVE, release validator, main route
  31.7 active min). 305 unit + 28 browser. Next P09 (narrative/achievements, 10 endings).
- 2026-10-16: P09 done (achievements, resolver, 10 endings with command-driven routes, ending
  panel, restart, profile discoveries). 330 unit + 30 browser. Next: sound plan S00→S07, then
  P10 (P10.6 needs S04+S07).
- 2026-10-16: S00 done (schemas, catalog/semantic validation, music:validate CLI, audio lints).
  Next S01 (timing, shuffle-bag, phrase planner).
- 2026-10-16: S01, S02 done (see sound progress). S03.1–S03.2 director + library green
  (commit-driven scheduling, stinger, cross-era tempo verified in real Tone offline render).
- 2026-10-16: S03 done (director, library, transitions/tempo, 4 demo patterns, evolution
  timeline; real-Tone renders). test:music 84, test:music-browser 12. Next S04 (Music Lab).
- 2026-10-16: S04 done (Lab entry, 4 modes over one director, size/dependency guard, 390 px).
  test:music 95, test:music-browser 13, test:browser 36. Next S05 (reviews).
- 2026-10-16: S05 done (SHA-256 review identity, review store/import/export/conflicts, approved
  Random bank, local candidates). test:music 124, music-browser 14, browser 38. Next S06.
- 2026-10-16: S06 done (similarity, approved/demo packs, prompt formatter + CLI templates,
  licenses/notices, music docs). test:music 149, browser 40. Next S07 (game integration);
  S07 must add `music/binding.json` (README already documents it).
- 2026-10-16: S07 done (Settings sound/music live, tech→era binding JSON, lifecycle/ending/
  restart, care SFX without cat-driven music, Lab round trip). game 347, music 159,
  music-browser 15, browser 43. Next: main P10 (P10.6 can now pass), then P11, then S08/S09.
- 2026-10-16: P10 done headless (save fixtures/recovery, tab lock, lifecycle, context loss,
  mobile DOM, settings gate). game 363, browser 58. Device items unverified. Next P11.
- 2026-10-16: P11 done headless (strategies, validation report, measurements, clean npm ci +
  all gates, Lab path redirect). Device/human items blocked. Next: S08 (hardening), S09.
- 2026-10-16: S08 done headless (long session bounds, voice-bank release, context interruption,
  import limits, voice budget, audio size budgets). Listening/devices blocked. Next S09.
- 2026-10-16: S09 done headless (production walkthrough, author cycle, full-run binding, docs
  guard, clean npm ci + all gates). ALL PLANNED PHASES DONE. Remaining = human/device blocks
  only (see validation_report.md and sound_validation_report.md matrices).
- 2026-10-16: user requests after S09: (1) cat ×3 intensity — done; queued: floating "+x" on
  meaningful clicks, stats moved to the lower panel (cat stays in header), coder sprite scale/place.
- 2026-10-16: user requests done & committed: cat ×3, floating gains, stats under the button,
  BACK TO CODE, PLAY skip, coder sprite, fat sleeping cat, world taps + cat icon, token economy.
  Queued: icons on counters/cards/primary button, log emoji, fat attention-cat variants, cat
  jump on/off table, card description font, screen top/bottom borders + log bottom padding,
  full-screen tech announcement, Cat-view cat tap = PET + meow.
- 2026-10-16: icons, layout, Cat-view tap, fat sitting cat committed. World cat now jumps onto
  and off the desk (`src/world/catPath.ts`: walk along the level, clamp to the surface edge,
  then a 450 ms arc in the 'play' pose; `WorldAddition.catSurfaces`). A cat in mid-air lands
  before taps/mood changes take effect. Queued: low-health cat goes quiet + stray ending,
  then docs/feature_ship_it.md.
- 2026-10-16: cat jump committed (c204c0e). Quiet weak cat + stray fate (D25) done. Next:
  docs/feature_ship_it.md.
- 2026-10-16: stray cat committed (e4f6b76). Ship It (D26) done: rules, content, schema 4,
  wheel, ending picture (2 variants), wall frames, sounds, credits/notices, scenarios, browser
  specs. All user-queued requests are done.
- 2026-10-16: user requests: PROMPT icon is a keyboard with a lit Enter key (WRITE CODE keeps
  the small keyboard); code prices show the code icon (revenue keeps `$`); bought compute
  slots stack as rack units on the room floor by the left wall (`withRoomExtras`,
  `WorldViewModel.computeSlots`, canvas `data-compute-slots`), up to the 8-level cap.
- 2026-10-16: user requests: terminal reacts to buys (🛒 / 🪙 line per purchase; discoveries
  keep their 🔓 line; newest line flashes); phones (`(max-width: 699px), (max-height: 599px)`,
  App matchMedia → `compactOffers`) show an UPGRADES button with count, "N affordable" (code
  icon, pulsing when > 0) and "N decisions" chips, opening a full-view popup with stats + cards
  (closes on a discovery or a ship). Browser specs use `openUpgrades`/`closeUpgrades`. The
  camera now hugs the built clusters' bounds + 8 % (`hugBounds`) instead of the authored
  portrait envelopes, except the final framing.
- 2026-10-16: F17 (user report: "progressively slower, especially on non-main screens", a
  stream of sprites-light.json 304s). Cause: App.svelte's DOM-sheet `$effect` read `$api`
  (the whole store), so it re-ran on every snapshot: ~11 atlas fetches/s and a fresh sheet
  object re-rendering every DOM sprite (header, Cat view, intrusions). Fix: depend on a
  `$derived` theme, cache `loadDomSheet` per theme. Probe (3 min cycling views): 2027 → 4
  atlas requests; heap/nodes flat either way on desktop. Guard: tests/browser/atlas-loads.spec.ts.
- 2026-10-16: user requests: PLAY escalates within a session (`attemptSpeedFactor` 1.15,
  `attemptWidthFactor` 0.85 per attempt; the first attempt is sampled slow enough that the last
  still crosses in ≥ minHitWindowMs — so first attempts are a bit slower than before). Memorial
  lap photo redrawn (5 drafts; chose the side view in the desk chair, hand on the cat). Header
  cat icon: skull when dead, sunset when stray (`data-fate`).
- 2026-10-16: memorial polish (user): cat skull with ears in the header; animated candle under
  the photos (3 flame frames + glow, static with reduced motion); lap photo hair redrawn (short
  cap, best of 3) and the desk gets its second leg; the keyboard photo's odd hand replaced by a
  steaming mug (removal / hand-on-cat / mug drafted); Cat title reads "CAT (Dead)" — and
  "CAT (Missing)" for a stray.
- 2026-10-16: user requests: settings cog with teeth; console chatter (src/content/chatter.ts:
  12 lines × 28 technologies; src/game/chatter.ts: a 💬 line every 30–60 s of active time on an
  otherwise quiet step, newest 3 technologies ×3 weight, least-recently-said line first, RNG
  `rng.narrative`, timestamps in `narrative.lastAt` — no save change; validated 10–15 lines,
  ≤ 140 chars, unique). Auto-refill fires only when tokens < 1 (`refillBelowTokens`); its bug
  now pays 50 % of the code to the wrong account / charity for zero tokens; the manual Buy
  tokens card is hidden while v1 is owned until its first bug (then buying by hand dodges it).
  History entries get icons (tech thumbnail, event emoji, skull/sunset, trophy, flag, rocket,
  palm for the jackpot) chosen by the selector (`HistoryEntryViewModel.icon`).
- 2026-10-16: F18 (user: "right border not visible, elements don't fit"). `.app` and
  `.game-view` grids had no column limit, so the single auto column grew to its widest child
  (the Upgrades button's nowrap chips, ~400 px) on every phone width. Fix: `grid-template-columns:
  minmax(0, 1fr)` on both, `min-width: 0` on controls. Stats panel no longer re-wraps as numbers
  grow: equal columns (one per stat), two-line cells (icon + label, value). The Upgrades button
  is one line with compact chips (code icon + affordable count, decision icon + count; full text
  in aria-label). Guards in mobile.spec: no element cut by an edge at 320/360 px (Pixi's
  off-screen a11y hook ignored), stable heights while numbers change.
- 2026-10-16: user requests: the world can be zoomed (wheel, pinch), panned (drag) and fitted
  again (double tap or the FIT button) — `src/world/viewControl.ts` (pure, tested) is a zoom
  factor + pan applied on top of the automatic hugging camera, clamped to the scene; a
  discovery resets it; a drag never counts as a tap on the cat/bowl/poster; canvas
  `data-view` fit|adjusted. Cards explain their effect on the game: `src/game/effectText.ts`
  turns the real effect definitions (a technology card: the technology's effects + new action)
  into a "▸ …" line; choices say "ends the run" etc.; releases show the retire chance.
  "Review capacity" renamed "Hire a code reviewer" (−0.5 debt/s).
- 2026-10-16: user request: a Setup screen (fourth view, `ViewId 'setup'`; the plan's "exactly
  three views" no longer holds — deliberate, by request). Opened by tapping the stats panel
  (transparent overlay button + "›"). Shows the economy per second from `economyFlows` (now
  factored out of `stepEconomy`, behaviour unchanged): agents/compute → work → tasks → tokens
  → funded work × coordination × quality × efficiency = code/s, debt in/out, money; what holds
  production back; stacked upgrades with level and total effect; every technology with its
  thumbnail and effect line. `src/game/setup.ts` (`selectSetup`), `src/ui/SetupView.svelte`.
