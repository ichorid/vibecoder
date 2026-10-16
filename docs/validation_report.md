# Validation report (P11)

Build: the P11 commit (parent `27f49a9`), production `npm run build`, served by `vite preview`.
Environment: Linux, Node 22.20, Chromium 1228 (Playwright 1.61.1, headless, software GL). **No
physical phone was available**: every device row below is *blocked*, not passed.

## P11.1 — deterministic strategies (`tests/scenarios/strategies.test.ts`)

Command-driven, current offers only, full 28-technology catalog, 60-minute cap with a stall
diagnostic (technologies, offers, rates). Active minutes to the autonomous company:

| Strategy | Seed | Company at | Cat | Care counts |
| --- | --- | --- | --- | --- |
| Baseline (feed ≤ 70 every 3 min, pet every 1 min, PLAY every 4.5 min) | 101 / 202 / 303 / 404 | 31.8 / 31.8 / 31.8 / 31.8 | alive | ~10 feeds, 32 pets, 7 PLAY |
| No care | 101 | 31.8 | starved at 14.8 | 0 |
| Calm care (feed every 4 min, PLAY every 6 min) | 202 | 31.8 | alive | 7 feeds, 5 PLAY |
| Slow player (press every 3 s, then 15 s; buys every 5 s) | 303 | 37.8 | alive | — |
| High-frequency input (10 presses/s) | 404 | 22.7 | alive | — |
| Overfeeding for 6 min, then baseline | 101 | 31.8 | sick for a while, alive | 42 feeds |
| Pet only | 202 | 31.8 | starved at 14.8 | 15 pets |
| Long Cat/History visits (no input 2 of every 8 min) | 303 | 37.0 | alive | — |
| Bad purchases (every affordable card for 10 min) | 404 | 33.7 | alive | — |

Seeds do not move the economy (RNG affects presentation and cat-play only). Care never changes
production (`cat-independence.test.ts`). Useful feeding lands every ~3.2 min, PLAY every ~4.5 min.
High-frequency input is bounded by the action-charge bucket (6/s): 29 % faster than baseline,
not trivial. **No balance change was needed**: all expectations held with the P08.6 values (the
tests passed on their first run; they are regression ranges, not RED-first).

The ten ending routes (`tests/scenarios/endings/`) pass from `createRun` with public commands.

## P11.2 — playthrough observations

A human mobile playthrough was **not done** (no device, no human tester in this session). What
was checked instead, by the implementing agent on screenshots (`tools/screens.ts`, 390×844 @2x):

- All 28 technology illustrations (contact sheet in progression order) are distinct and move
  from the desk scene to abstract systems, ending with an almost empty dark "RUNNING" grid.
- World: the room becomes a technology network; programmer and cat shrink with LOD; the late
  world is abstract, not a city. Light and dark themes show the same scene.
- Memorial: two happy photos; death is stated briefly. Ending texts (both fates) read as
  tragicomedy, no moral; the success ending exists with a living and a dead cat.
- A neglected cat's large intrusion covers the primary action in the late game (designed:
  tapping it opens Cat); the header stays usable (`attention.spec.ts`).

Not judged here: whether each technology *feels* like a role change, whether the pace leaves
room for the cat, PLAY with a real finger. These need the human pass.

## P11.3 — performance (desktop headless; `npx vite-node tools/measure.ts`)

| Metric | Budget | Measured | Method |
| --- | --- | --- | --- |
| Initial game JS | ≤ 350 KiB gzip | 234 KiB (entry 57 KiB) | `npm run build` manifest walk from `index.html` (lazy Pixi included, lazy audio excluded) |
| First assets | ≤ 1 MiB | 44 KiB | light atlas + CSS |
| Session art | ≤ 8 MiB | 34 KiB | all PNG in `public/assets` |
| Resident textures + targets | ≤ 64 MiB | ≈ 4.7–8.1 MiB (estimate) | 512×256 RGBA atlas per loaded theme + 2 × drawing buffer at DPR 2 |
| Frame work | p95 < 16 ms @ 30 fps | no long tasks during 6 s idle late world; one 208 ms task while loading the late save | `PerformanceObserver('longtask')`, rAF intervals (p95 16.8 ms = display rate) |
| JS heap | — | 9.5 MiB cold, 10.7 MiB late world | `performance.memory` (Chromium only) |
| Interactive | — | 70–96 ms to primary action (warm local preview) | wall time to the button |

These are **not** phone numbers (software GL, desktop CPU). Not measured: real GPU memory,
cold-cache network loading, battery/heat over 30 minutes, lock/unlock, app switch.

## P11.4 — release artifact

Clean `npm ci` (lockfile; npm did not run esbuild's postinstall — the platform binary from the
optional dependency works, the build passed), then all green:

| Gate | Result |
| --- | --- |
| `npm run check` (types, lint, format, rules, content, release content, music types/validate/pack, notices) | OK |
| `npm run test:rules` | 3/3 |
| `npm run test:game` | 375/375 |
| `npm run check:release-content` | OK |
| `npm run test:music` | 159/159 |
| `npm run build` | OK, within budgets |
| `npm run test:browser` (production preview, no debug routes) | 59/59 (re-run after the `/music-lab` redirect test was added) |
| `npm run test:music-browser` (dev-server Tone fixtures) | 15/15 |

Save checks: fresh run, reload resume, dead-cat resume, discoveries after restart, schema-1
fixtures (`tests/fixtures/saves/`), future/corrupt refusal — all covered by tests above.

Deployment (static host, no backend, no service worker): `dist/index.html` and
`dist/music-lab/index.html` reference absolute `/assets/<name>-<hash>.*`, so the site must be
served from the domain root. MIME on preview: HTML `text/html`, JS `text/javascript`, CSS
`text/css`, PNG `image/png`, JSON `application/json`. Recommended headers: `Cache-Control:
public, max-age=31536000, immutable` for `/assets/*` (fingerprinted), `no-cache` for the two
HTML files. `/music-lab/` serves the Lab; a host that falls back to the game page for
`/music-lab` (vite preview does) is redirected to `/music-lab/` by the game entry (test added).
Publishing is a separate action and was not done.

## Acceptance matrix

| Requirement | Evidence | Status |
| --- | --- | --- |
| About 30 minutes main route | strategies + main-route scenarios (31.8 min) | passed (headless); mobile playthrough **blocked** |
| 28 technologies, hidden future | P08 release catalog, selectors/DOM tests | passed |
| Unique illustrations, abstract zoom | asset checker, contact sheet, reveal specs | passed (agent review; human look pending) |
| Exactly three views | P03/P09 browser navigation | passed |
| Tiny health/mood bars | `layout.spec.ts` geometry, `mobile.spec.ts` | passed |
| FEED / overfeeding / PET | P04 rules, overfeed strategy, persistence | passed |
| PLAY: three attempts, timing, pause | P05 unit/browser | passed; real touch session **blocked** |
| Foreground cat, usable navigation | `attention.spec.ts` | passed |
| Starvation death, memorial, no resurrection | P04/P10 save + browser | passed |
| No death/offline output in background | runtime/lifecycle tests, synthetic browser events | passed headless; screen lock/app switch **blocked** |
| Care does not affect production | `cat-independence.test.ts`, strategies | passed |
| World cat shrinks and disappears | P06 LOD, P08 endgame screenshots | passed |
| ≥ 10 reachable endings | ten route scenarios | passed |
| Fate variants, retained discoveries | P09 ending/restart tests, profile recovery | passed |
| Both themes, reduced motion | `world-reveal.spec.ts`, `mobile.spec.ts` | passed |
| Mobile performance / recovery | P10 recovery specs; desktop measurements | partial: device measurements **blocked** |
| Agent quality gates | P00 rule fixtures, `npm run check` on final code | passed |
| Sound in Settings, Music submenu/Lab in production | `sound.spec.ts`, `settings.spec.ts`, `lab*.spec.ts` | passed (headless) |

**Overall acceptance is not complete**: the human mobile playthrough and the Android/iPhone
device checks (P11.2/P11.3) remain blocked. Nothing here claims "mobile-ready".
