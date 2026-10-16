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
- D27 (user) Ship It without windows: the next release is always offered (from
  `releases.availableFrom` = terminal-agent); minimum price as authored (2K…2.7M, then ×6) and
  shipping sets code to 0. Hazard per release number, later ones keep v3.0's 13.04 %. Slices and
  comments repeat only after all were used. Save: release number 1–999 (`MAX_RELEASES`). The
  always-ship-and-save strategy became degenerate; replaced by "upgrades first, ship when
  affordable": company at 33.9 min, releases at 11, 20, 28, 33 min (seed 1).
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
- 2026-10-16: user rule extended: any text naming the cat has a version for its absence
  (`CatAwareText` now also on technology descriptions and event texts; `catAware` moved to
  src/game/catAware.ts). Local servers: "…would have had opinions about it, if the fella was
  still around."; idle-agent line: "…like the cat used to." validateContent fails a plain text
  naming the cat in technologies, events, upgrades, choices, chatter (achievement titles and
  the alive-only "cat is helping" event exempt).
- 2026-10-16: user requests: theme preference AUTO (default, follows prefers-color-scheme live)
  / LIGHT / DARK — profile `theme` accepts 'auto' (no schema bump; old explicit light/dark kept),
  App resolves the shown theme; Settings is a radiogroup. Zoom-in limit is now absolute
  (`MAX_ABSOLUTE_ZOOM` 4 CSS px per world px, or 6× the framing if larger) so a grown scene can be
  zoomed back to the room. Upgrade cards show "≈ +X code/s · ±Y debt/s right now" from
  `upgradeImpact` (the economy recomputed with the card owned; packs none). Measured release
  windows on baseline (seeds 101/303): v0.1 2.3–7.2 min, v0.2 ~14.6–18.6, v1.0 ~21.7–25.7,
  v2.0 ~28.4–32.4 (card visible 3.5 of 4 min), v3.0 from ~31.5 and never closes.
- 2026-10-16: D27 done; the dead cat's icon is a candle (header + History); OBSERVE presses
  float "+1 existential dread" / "+1 boredom" (cosmetic); Setup's money section explains
  revenue = useful code/s × $ per code (base × multipliers) and costs = agents × $/s + overhead.
- 2026-10-16: D28 (user chose) Credit line + automatic bankruptcy: when costs exceed revenue the
  bank balance may go negative down to `money.creditSeconds` (180) × current costs, at
  `interestPerSecond` 0.2 %; agents keep working on credit (src/game/economy.ts `economyFlows`).
  Reaching the limit triggers Fully Automated Bankruptcy automatically (priority 50); the
  close-company choice stays. New choice "Pull out of every market" (`cancel-expansion`,
  `ChoiceDefinition.cancels`) drops the expansion overhead. 🏦 log lines at 0/50/90 %; a credit
  countdown under the stats; Setup explains it. Save: `economy.revenue` may be negative.
  Also: a new run clears stale world clusters (renderer reconcile); the dead-cat title puts the
  fate on a second line; memorial photos 10 % smaller.
- 2026-10-16: room taps (user): poster jokes ("+1 motivation (does nothing)" …, no longer a
  press), bookshelf "no time for that", window "maybe other time", monitor = main action, plant =
  water it. The plant is a care toy with no economy effect (src/game/plant.ts): water 60, drains
  8/min, +35 per watering, drowns above 120, dries at 0, thirsty warning once below 25; sprite
  `room-plant-{ok,thirsty,soggy,dead}` split out of room-back. Save schema 5 (4→5 adds a living
  plant); v4 fixtures kept, v5 added.
- 2026-10-16: experience (user): five "lesson learned" endings (last programmer, merge
  conflict, greenest pipeline, forgotten project, bankruptcy) add +10 % code yield to every later
  run, stacking each time (`EndingDefinition.experience`, `profile.experience`, `run.experience`
  fixed at run start; multiplies presses, passive code and agents' useful code). The ending panel
  says so; Setup shows "× Experience". Save schema 6 (5→6 adds experience 0 to profile and run);
  a recovered old profile without the field reads as 0.
- 2026-10-16: checkpoint (user): Settings → SAVE CHECKPOINT / LOAD CHECKPOINT (confirm) — a
  second localStorage slot `vibe-coder.checkpoint` holding a full envelope; loading brings the
  run back and keeps the current profile (discovered endings, experience, theme), so one run can
  try every ending. AppCommands `saveCheckpoint`/`loadCheckpoint`; snapshot `checkpoint`. The
  cards popup closes when a run ends. NOTE: another Claude session was working in this repo at
  the same time (running tools/tune.ts, creating tools/_econ_tmp.ts); I left its files alone.
- 2026-10-16: economy redesign (docs/economy_redesign.md) E0 — harness: tests/helpers/metrics.ts
  `measureRun(seed, {cps, cpsAfter, buyer, care, experience})` (acts, walls, cadence, binding
  shares, 2+ optional cards, hidden-binding seconds, q<0.9 / coord<0.95 shares 16–31 min, peak
  debt, PM→company, disaster seconds, freeze delay); tools/tune.ts flags; scenario policies
  `tapAt`, `greedyCapacityBuyer`, `seerBuyer`, `progressionOnlyBuyer`. BASELINE (before any
  change, seeds 1/7/42/101/2024, PLAY care):
  | config | company | acts (6) | walls | cadence | 2+cards | hidden | q<.9 | coord<.95 | peak debt | PM→co |
  | 3 cps→1/3s | 28.2–28.6 | 0.3/5.6/12.1/19.0/24.4/28.6 | 0.6/1.2/1.7/1.3/0.9 | 62 s | 0 % | 857–1058 s | 0 % | 0–24 % | 50 | 2.3 |
  | 1 cps→1/5s | 30.9–31.3 | 0.8/7.3/14.0/20.9/26.5/31.3 | | 66 s | 0 % | 876–1096 s | 0 % | 0–22 % | 52 | 2.6 |
  | 10 cps→10 | 20.6–20.7 | 0.1/1.4/4.9/11.2/16.5/20.7 | | 45 s | 0 % | | 0 % | 0–62 % | 64 | 2.2 |
  | greedy 3 cps | 40.4–40.9 (slower!) | | 4.4/7.6 walls | 72 s | 0 % | 709 s | 25 % | 27 % | 253 | 2.2 |
  | seer 3 cps | 31.6 | | | 69 s | 0 % | 1298 s | 4 % | 0 % | 32 | 2.6 |
  | saver (progression only) | 35.0 | | | 76 s | 0 % | 1498 s | 41 % | 0 % | 297 | 2.6 |
  | idle (3 cps→1/min) | 48.5–48.9 | | | 111 s | 0 % | | 66 % | 55 % | 110 | 2.5 |
  | 3 cps, experience 0.5 | 18.7 | | | 39 s | 0 % | | 0 % | 69 % | 43 | 1.4 |
  Disaster cost 2–54 s (varies with seed). Freeze-features offered the same step as Evaluations.
  Also: the stats line in the upgrades popup opens Setup; back returns to the popup.
- 2026-10-16: economy redesign EX (D1): experience is derived — `experienceOf(profile.endings)`
  (src/game/experience.ts) sums distinct lesson endings (max +0.5). createGame recomputes it on
  load (inflated profiles normalise) and after each new discovery; a repeat lesson ending shows
  "Lesson already learned" (`experience.repeat`). The 3 cps run at experience 0.5 is 18.7 min
  today (< the 20 min floor) — to be re-measured after E3/E6 slow the early game.
- 2026-10-16: economy redesign E1–E3 (one commit; the tests had to move together).
  E1: Ship It is a strip under the cards (`game.release`, data-testid ship-strip), never one of
  the three cards; Token review removed (upgrade, effect kind, balance) — save schema 7 (6→7
  drops its level); `relevantCard()` puts the card for what binds (tokens < 30 s demand, compute
  < agents, debt > 20, capacity binding) after progression and choices (endings never hidden).
  E2: floors QUALITY_FLOOR 0.35 / COORDINATION_FLOOR 0.4; QUALITY and TEAM header stats replace
  the automation slot while < 95 % (shown as %); agent card says "needs 1 compute, 1 managed";
  Setup has "Limited by:". E3: actionBurst 6, refill 3/s (createRun starts with 6 charges);
  act-1 prices 20/60/180/900; a capped press floats "typing…"; baseline tapper 3 cps → 1/3 s.
  UI: the strip is one line on 320 px ("Ship v0.1 · 2K to go", odds once it can ship); below
  640 px height the log keeps 3 lines and the controls gap is 6 px (world ≥ 30 % at 320×568).
  Tests: click counts derive from content (AUTOCOMPLETE_PRICE etc. in tests/helpers/run.ts);
  browser presses wait for `data-ready` on the primary button; Playwright timeout 60 s (F19).
  MEASURED (seeds 1/7/42/101/2024 unless noted):
  | config | company | acts | 2+cards | hidden | q<.9 | coord<.95 | peak debt |
  | 3 cps→1/3s | 27.2–27.8 | 0.5/6.4/12.7–13.3/16.6–17.2/23.3–23.9/27.8 | 43–46 % | 418–440 s | 33–35 % | 76–80 % | 168 |
  | 10 cps (seed 1) | 21.1 | 0.5/4.1/8.8/12.5/17.2/21.1 | 40 % | 300 s | 0 % | 100 % | 24 |
  | greedy (seed 1) | 42.4 (still slower) | | 33 % | 268 s | 44 % | 88 % | 494 |
  | seer (seed 1) | 30.2 | | 62 % | 687 s | 56 % | 78 % | 79 |
  | experience 0.5 (seed 1) | 17.0 (< 20 floor) | | 50 % | 222 s | 0 % | 100 % | 93 |
  Pressure now exists (was 0 % on 2+ cards and quality); act 1 lengthened 5.6 → 6.4 min. Still
  open after E3: coordination below 0.95 most of the late game (capacity cards are capped — E4),
  10 cps vs 3 cps ratio 0.76 (target ≥ 0.9 at E-end), greedy slower than baseline, experience 0.5
  under 20 min.
- F19: under the fully parallel Playwright run a real click takes ~1 s, so 20 paced presses
  (buying Autocomplete) took ~25 s and four specs hit the 30 s default. Raised the default to
  60 s in playwright.config.ts; nothing about the assertions changed.
- 2026-10-16: economy redesign E4–E8 + §6 tests (one commit: the scenario tests only pass with
  the money act of E7, and the prices of E6 were tuned against E4/E5).
  E4: agents / compute / reviewers uncapped (maxLevel 99) and priced by payback —
  `priceRule: { paybackSeconds }` (agent 45, compute 35, review 45 after tuning; doc said
  60/45/60), price = roundNice(max(level floor, K × useful/s per runnable agent)); reviewers
  also +1 managed. The compute slot now requires Parallel agents (one agent before that).
  E5: tech managed 4→3 / 2→1 / 4→3 / 6→4 / 12→8 / 24→16; Evaluations review 10, unchecked ×0.5;
  self-driving review 20; the clean-pipeline clock (lowDebtMs) counts only from Evaluations.
  E6 (tuned, not the doc table): act 2–3 keep their old prices (650…4.2k); context 6k–local
  7.4k; custom 14k–self-improvement 28k; self-driving 190k; PM 170k. E7: operating cost 3 per
  agent; marketing 9k, finance 21k, executive 28k, company 42k (revenue); expand overhead 3×
  revenue/s; credit 120 s. E8: a v1 disaster takes max(50 % of the bank, 30 s of output),
  at most the bank; the log lines no longer say "half".
- D29: capacity cards are offered only when they help now (pay back within 300 s) or are the
  relevant suggestion (`cardAdvice` in selectors: best code per code spent; when none helps
  alone, the scarcest of agent / compute / manager, only while agents can still be hired).
  Why: with uncapped capacity, cards that add nothing (agents without compute, compute without
  agents) were bottomless traps — the greedy buyer took 47–55 min and the baseline 35. Cost: the
  §4 "two optional cards visible ≥ 80 %" target is missed (5–18 %). Also a gentle level floor
  (priceGrowth 1.2) so idle capacity is not free to spam.
- D30: early header panels (≤ 3 stats) keep three numbers; QUALITY/TEAM take the automation
  slot or a free one (acceptance: "three at most early", "debt in the header" at the Reviewer).
- D31: the 10 cps ≥ 0.9 × baseline invariant is not met (0.84–0.86): presses after the agent
  still matter a lot (PROMPT/DELEGATE/SUPERVISE at the 3/s cap vs one every 3 s). Encoded a
  ≥ 0.8 guard (stronger than the old ≥ 20 min) and a todo for 0.9.
  MEASURED after E4–E8 (seeds 1/7/42/101/2024 for baseline, 1 and 42 otherwise):
  | config | company | notes |
  | 3 cps→1/3s | 29.8–30.2 | acts 0.5/5.7/13.5/19.5/21.5–23.0/29.8–30.2; walls 1.2/1.4/1.6–2.4/1.2–1.8/1.8–2.6; cadence 58–59 s; q<.9 21–31 %; coord<.95 40–41 %; PM→co 5.3; freeze +120 s |
  | 1 cps→1/5s | 33.4–34.0 | ≤ 36 ✓ |
  | 10 cps | 25.1–25.9 | 0.84–0.86 × baseline (target ≥ 0.9 ✗) |
  | idle (1/min) | 41.2–41.6 | ≤ 55 ✓ |
  | greedy (follows the cards) | 31.6–31.9 | 20 % faster than progression-only 39.1–40.0 ✓ |
  | seer | 29.7–31.3 | peak debt 37–328 (target ≤ 120 ✗) |
  | experience 0.5 | 20.0–21.3 | ≥ 20 floor ✓ |
  Disaster cost 4–74 s (target 25–40 ✗; depends on when it lands). D3 (cat scaling) still open;
  E9 not done. tests/scenarios/economy-shape.test.ts holds the met targets and lists the rest
  as todos. Strategies: baseline 28–31 on five seeds, shipper ≤ 45 min (31.3), early-automation
  manager 11.5–14.5 min.
- D32 (user, 2026-10-16): the "cat demand rises with automation" requirement (economy redesign
  D3 / E9) is removed — cat demand stays independent of automation. docs/economy_redesign.md
  updated (header, E9, §9); nothing in code depended on it.
- 2026-10-16: Code a demo (user; docs/feature_demo.md). Cosmetic code sink: a strip next to
  Ship It (from the Terminal Agent, 1,500 code ×2.2 each, never all the code) opens a popup that
  "depacks" and plays a 160×100 demoscene picture of a horn-grammar form; each demo is the
  judge's pick among mutations of the previous one. New pure layer `src/demo/` (lint-guarded
  like game/: no other layer, no ambient time/random; in tsconfig.game.json): genome families
  and house rules (no original Organic Art 4-rule structure is possible), fast expansion (rib
  tables, typed arrays), judge on 80×50 masks, vector-bob rasterizer. Game: `makeDemo`,
  `run.demos` (seed + cat), `rng.demo`, History entries with WATCH, save schema 8 (7→8 adds
  `demos: []` + demo stream; v1–v7 fixtures kept, v8 + v8-demos added). Dev only: Settings →
  Demo lab (absent from production builds; a browser spec checks). Measured: lineage 16–26 ms
  per new demo in Node, frames ~0.1 ms. `tools/demoSheet.ts` renders contact sheets;
  `tools/screens.ts` has demoStrip/demoPhone/demoDesktop scenes. NOTE: another session is
  adding MIDI import (tools/music/midi*, music/sources/) at the same time; its unfinished
  midiImport.test.ts fails svelte-check — left alone, not staged.

- 2026-10-16: CC0 MIDI import (user: "analyze them, match and remix" into the generative system).
  Source: "15 Melodic RPG Chiptunes" by Aureolus_Omicron (OpenGameArt, CC0), 15 .mid files kept
  in music/sources/rpgchip/ with plan.json (song → era + measured mood; game over skipped: 3/4
  sting). New tools: tools/music/midiFile.ts (dependency-free SMF parser), midiImportLib.ts,
  importMidi.ts (`npm run music:import-midi [-- --check]`). Pipeline per song: key by
  Krumhansl profile in the target mode's family, channel → role (active low line = bass,
  highest independent melody = lead, busiest other line = arp, else pads arpeggiated; pads =
  shared onsets + slow or ≤ 6 pitches), transpose + recolour degree→degree into the era mode,
  quantize (half-time when closer to the source tempo), one chord per bar, four-bar windows that
  enter on the tonic chord (mode quality) and exit on I, V, or a chord the source resolves to I;
  near-duplicates skipped with the validator's own similarity rule; kit polyphony respected.
  When no window fits, the reading is searched over the 4 best tonics × both stretches (The
  Evil One profiles as G minor but circles E). Battle 2 moved acceleration → orchestration (its
  tonic chord is minor). Result: 45 unreviewed candidates (demo: false, CC0, attribution) in all
  six eras (discovery 10, acceleration 4, orchestration 8, recursion 10, self-improvement 6,
  singularity 7); music:validate 0 errors (707 warnings, chord/chromatic notes); every pattern
  renders through real Tone with no dropped event, RMS 0.028–0.087, peak ≤ 0.36
  (tests/browser/music-imported.spec.ts); dev Lab lists them. Approved/demo packs unchanged —
  they ship only after a human approves them in the Lab. Two music tests assumed the corpus size
  (4 demo patterns; 3 singularity patterns) and now scope/derive it.
- F20: the validator does not apply per-role polyphony to drums, but the phrase planner does
  (whisper-kit = 2): an import with three hits on a step dropped one silently. The importer caps
  hits per step (kick > snare > hat) and a test asserts compilePhrase drops nothing.
- NOTE: another session has uncommitted changes in src/game, src/app, src/content,
  src/persistence; left untouched.
- 2026-10-16: listening feedback on the import: "recursion is very good; the rest have very
  whiny main tones, pretty long ones". Measured: Recursion's leads averaged C5 (72) with short
  notes; the others sat at F5–G#5 (77–80, up to C7) on thin pulse presets, and held long notes
  (acceleration 94 % of lead time, self-improvement 82 %). Fix in the importer, presets
  untouched: plan.json `lead: { maxSteps: 6, centre: "C5" }` — the lead octave is the one
  averaging nearest C5 among shifts keeping ≥ 75 % of notes in range, held lead notes are cut to
  a dotted quarter. Recursion songs set `lead: { maxSteps: null, centre: null }`: their files are
  byte-identical. After: lead means 68–72, max length 6 steps outside Recursion.
- 2026-10-16: demos v2 (user): swirl (slow 3–41 s waves, ±40–540° swirls, vortex/tumble views,
  no turntable), ripple between tentacles, web forms (strand `lay` → swirling `layers` → ring),
  colour genes (bands / flow / tentacles / alt / mono, light pulses) and `thickness`, all
  mutable; judge flow term; first demo = best of 4 viable. Designing: the demo screen (only
  there, newest demo) shows variants A★/B/C + ??? mystery for the next demo, built from its
  real seed; `designDemo` command, `run.demoPick`, `DemoRecord.pick`, save schema 9 (v8
  fixtures kept, v9 + v9-demos added). Lineage ≈ 50 ms per demo in Node. Generator changes mean
  existing saves' demos now look different (cosmetic, seeds unchanged).

- 2026-10-16: cyber / demoscene import (user: "look for more cyber or demoscene-like free
  chiptunes … to remix and use", then "yes" to building a tracker importer). Search: The Mod
  Archive's public-domain listing (886 modules, crawled at 1 request/s) crossed with its
  Chiptune / Demo Style / Techno / Industrial / IDM genres → 83; shortlisted by rating and style,
  each licence checked on its module page; covers (Loituma, Spelunker, Pac-Man) excluded. Plus
  two CC0 OpenGameArt modules with source (Subterrain, Midnight Drive). 16 modules (3.6 MB) in
  music/sources/cyber/ with plan.json and README (titles, authors, links, MD5).
  New: tools/music/trackerFile.ts (XM + MOD readers; a player following orders, breaks, jumps,
  note-offs, cuts, volume; 0xy arpeggio → sixteenth runs; drums = non-looping samples at ≤ 3
  pitches, kick/snare/hat by zero crossings, pitched one-shots 0.017–0.04 excluded; tempo = the
  speed/bpm heard longest, 8 rows per beat when 4 would exceed 180 bpm), songFile.ts (dispatch by
  extension). Importer: per-song `source` credit, `site`; plan options `windows: "busiest"` and
  `minMelodicNotes` (cyber: busiest, 24 — the earliest windows were intros); centred leads are
  confined to an octave around the centre and the octave search spans ±5 octaves (tracker samples
  carry big relative notes). `npm run music:import` (renamed from music:import-midi) runs every
  source set. Result: 40 `cy-*` candidates — discovery 5, acceleration 5, orchestration 8,
  self-improvement 13, singularity 9; none added to Recursion (liked as is). Fluxchip skipped (no
  fitting window with melody). RPG patterns unchanged except 4 non-Recursion leads now ≤ C6;
  Recursion files byte-identical. Checks: 205 music tests, 19 real-audio tests (all 85 imports
  audible, no drops, no clipping), music:validate 0 errors. IT modules (TIXO, The panic area,
  Electron City, 1KB) not yet supported.
- NOTE: `npm run check` currently fails only on Prettier for src/demo/genome.ts and
  src/demo/horn.ts — files of the other session; left untouched.
- 2026-10-16: demos v3 (user): fewer radial forms; invisible carriers like the original's hidden
  informs / ribs(0) horns — `dots` (beads, or hidden tubes showing only their tip), `flock`
  arrangement (wide invisible path), `swarm` copy layout (figures orbiting each other);
  first-demo archetypes (solo/swarm/flock/radial/web) so the judge compares within a kind;
  scattered forms judged at lower coverage; count-aware big-ball penalty; sprite shapes (ball,
  ring, gem, cube, star, petal, drop; non-round ones turn along their tube). First demos viable
  40/40. Note: main-route scenario once exceeded vitest's 5 s timeout under load (passes alone
  and on rerun).
- 2026-10-16: (user) children pay a mild rotational-symmetry penalty in the judge's ranking, so
  radial starts drift away (mean symmetry 0.75 → 0.47 by demo 4); first demos unpenalised.
  Bug fix (user): replaying a demo from History no longer shows the designer (only right after
  coding one).
- 2026-10-16: (user) speed variation: `speed` gene (the form's clock rate; first demos 0.4–2×),
  mutation draws uniformly from [0, 8); trails mutation off 37 % of the time. The judge adds a
  jitter penalty (mask change over 0.1 s): judge picks centre on 1.15× (p90 3.8×), variants
  still reach ≈ 8× for players who want them.

