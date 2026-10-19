# Feature: Build deck — the choice lives under the thumb

Status: **draft** (2026-10-20). Owner decisions are in §2. Every number is a *starting value*;
playtests decide, and each phase records its result in docs/agent_journal.md. Follow AGENTS.md
TDD: one behaviour RED → GREEN → refactor per step.

Amends docs/feature_projects.md §7.1 (cards and strips) and docs/feature_money.md §6 (where the
money strip, gig board and job card are drawn). No rule in `src/game/` changes meaning: projects,
slots, the fallback tax, token packs and auto-selection work exactly as specified there. This is
a presentation feature plus a few read models.

---

## 1. Summary

Twenty mobile playtests, one finding every time: nobody notices the **UPGRADES** button, and a
player who does find it has to leave the code to pick the next build and then come back. The
fallback tax (feature_projects.md P3) is meant to be an attention tax, but a tax the player cannot
see reads as "the game got slow for no reason".

The root cause is that **the moment of choice and the place of choice are apart**: a build
completes next to the thumb, and the choice waits behind a button that looks like a menu.

The build deck puts every choice next to the CODE button, always:

- a **build row** shows what the code is filling right now, with progress and ETA;
- a **build lane** — a horizontal carousel right under it — holds every other target; one tap
  switches, and nothing is lost (P1);
- when a build completes, the lane **expands** into readable cards in place: the reward moment
  and the next decision are the same moment;
- a **token gauge** with a reload button is always on screen once tokens cost money — a tower
  on cooldown, not a card in a menu.

The UPGRADES button and the offers sheet are removed, on phones and on desktop.

## 2. Owner decisions (2026-10-19 / 20)

| # | Decision |
|---|---|
| B1 | Nothing that appears on completion blocks tapping. CODE keeps working at all times. |
| B2 | The fallback tax stays as specified (×0.5 into the release) and is **shown** where the choice is: *"release at ½ while you decide"*. No auto-pick on a timer. |
| B3 | Phones and desktop get the same model. The offers sheet and the inline offer list both go. |
| B4 | Switching mid-build is the core of the game: the player sees a long build crawl and decides on their own to take something shorter (an upgrade, a gig). Alternatives are always in reach, one tap, with their ETA. |
| B5 | The alternatives are a **horizontal carousel** (the lane). It replaces the UPGRADES button and its sheet. |
| B6 | Buying tokens is a **tower reload**: an always-visible gauge with a one-tap reload, available at all times once tokens cost money. |
| B7 | No nudge toward shorter projects. The player finds it out alone. |
| B8 | Items **animate in** when they appear in the lane, to draw the eye. |
| B9 | A finished build is a **ta-da**: fireworks, confetti, sound, scaled by what was built (§8.1). |
| B10 | When something appears in the lane, the lane **scrolls to it by itself** and spotlights it with effects (§6.3, §8.2). |
| B11 | SHIP / RUN are not separate buttons. The release and the demo are lane items: while they build, picking one is just picking a project. When one is **ready**, a popup offers the choice (ship / run, or later). *Later* leaves it in the lane as **READY**; tapping it brings the popup back (§9). |
| B12 | Decisions and the compute slot are lane items. A decision opens its full-screen card on tap; it does not pop up by itself. |

## 3. Goals and non-goals

**Goals**

- A completed build is a moment, and the next choice is made in it, in place.
- The cost of not choosing (the tax) is visible at the moment it starts.
- A switch is one tap at a spot the thumb remembers (§6.3).
- Running out of tokens is something the player sees coming and acts on.
- Nothing new can steal a tap meant for CODE (§6.4, §6.5).

**Non-goals**

- No change to prices, rates, the tax, auto-selection or any game rule.
- No save schema change: lane order is presentation state (§11).
- No hints, arrows or tutorials pointing at the "better" pick (B7).
- No new resource or currency.

## 4. Player experience walkthrough

1. First seconds: the build row reads `▶ Release ▓░░░ 4% ~1:10`. The lane fills in from the
   right, one item at a time, each with a pop and a sparkle (§8.2): `[Tests ~12s] [Linter ~20s]
   [Gig…`.
2. The player taps *Tests*. It flies up into the build row; *Release 4%* drops into the spot
   *Tests* left. The bar now runs visibly faster.
3. *Tests* completes: **ta-da** — confetti bursts from the build row, *"+20 % code"* floats over
   the world, purchase cue. The lane grows into cards (*✓ TESTS BUILT · WHAT NEXT?*) and the
   line under them says *release at ½ while you decide*. The player keeps tapping CODE; after a
   beat they tap *Linter*. The lane shrinks back. A new card unlocked by Tests arrives: the lane
   glides to it and it lands with a sparkle.
4. Later the player starts *GPU Cluster*: `9% ~3:40`. The bar crawls. Nobody says anything.
   They tap *Gig ~25s* — `GPU 9%` waits in the lane, paused — and come back to it with a tap
   on the same spot.
5. The release fills up: fireworks over the world, and a popup — *v0.3 is ready · retire
   chance 4 % · [🚀 SHIP] [Later]*. The player taps *Later*; the release waits in the lane as
   **READY**. A minute later they tap it, the popup comes back, they ship, and the wheel spins.
6. Terminal Agent: the **token gauge** appears above the build row
   (`TOKENS ▓▓▓▓▓▓ ~1:40 [⟳ $48]`). At *~0:20* it turns yellow and ticks; at zero the agents in
   the world fall asleep. Reloading before rent is due shows *→ $30 ⚠ rent 1:20*.
7. Manager Agent: completions stop expanding the lane; the build row says *Manager picked Tests*
   and the lane stays switchable — a tap still wins.

## 5. Layout

Bottom-up by how often the thumb goes there: CODE (constantly), the build deck (often), the
token gauge (periodically). The money-spending reload is separated from CODE by the whole deck.

```
┌──────────────────────────────────┐
│ $278 · rent 2:40           v0.3  │  header (unchanged)
├──────────────────────────────────┤
│                                  │
│          [ pixel world ]         │
│                                  │
│ > Paid $128.                     │  log: 1–2 lines on phones
├──────────────────────────────────┤
│ TOKENS ▓▓░░░░░░░ ~0:20   [⟳ $48] │  token gauge (§7)
├──────────────────────────────────┤
│ ▶ GPU Cluster ▓░░░░░░░ 9%  ~3:40 │  build row (§6.1)
│ [🚀Release 80%][💵Gig $90+][Lint ~│ ▸4•   build lane (§6.2)
├──────────────────────────────────┤
│          [    CODE    ]          │
└──────────────────────────────────┘
```

There is no SHIP or RUN button anywhere: shipping and running start from the ready popup (§9).

The expanded lane (§6.6) is drawn **over** the world and the log. It never pushes the CODE
button: no layout shift under the thumb, ever.

## 6. The build deck

### 6.1 Build row

- One row per build slot: target name, badge (BUILDING / AUTO / AUTO · ½ / PAUSED, as in
  feature_projects.md §7.1), fill bar, ETA at the current pace.
- AUTO · ½ (fallback) adds the line *release at ½ while you decide* under the row.
- Tapping the build row expands the lane (§6.6) to read the items; it never changes the target.
- **Two slots (Worktrees):** two rows. Tapping a row **focuses** that slot (outline); lane picks
  go to the focused slot. Default focus: the slot that freed most recently, else slot 1. The
  manual-tap rule of feature_projects.md §5.2 is unchanged.
- **Employed:** the row becomes `💼 At work · all code goes to the employer` with the job's
  controls; lane items show PAUSED and cannot be picked (as today).

### 6.2 What is in the lane

Everything that used to live in the offers sheet, as lane items:

| Item | Tap |
|---|---|
| Code projects (upgrades, technologies) | `selectProject` |
| Release, demo — building | `selectProject` |
| Release, demo — **READY** | open the ready popup (§9) |
| Paused projects (`⏸ 9%`) | `selectProject` (resume) |
| Gig / gig search (`SEARCH 0/5`) | select the gig / one search tap |
| Job offer card | open its accept flow |
| Money cards except tokens (compute slot) | `buyUpgrade` — coin look, BUY, instant |
| Decisions (`choice`) | open the full-screen decision with its confirm text |

Token packs are **not** in the lane: they have the gauge (§7).

Each item shows name, price or progress, and ETA; the coin look and the decision look stay
distinct from code items at 360 px. No item is ever marked as the recommended one (B7).

### 6.3 Order: never re-sorted

The lane is a list the thumb learns. Its order changes in exactly three ways:

1. **Swap in place.** Picking an item swaps it with the current build: the old build takes the
   picked item's position. Switching back is a tap on the same spot.
2. **Insert.** A new item goes in at the **peek position** — the first position not fully
   visible at the current scroll — or at the end if everything is visible. The lane then
   **scrolls to it by itself** (B10): the smallest smooth scroll that shows it whole, and the
   spotlight of §8.2. Inserting at the peek keeps that scroll to about one item width, so the
   thumb's map of the lane barely shifts.
3. **Remove.** A built, bought or withdrawn item collapses (200 ms) and the items to its right
   close the gap.

No sorting by price, ETA or anything else, ever. On load the order is the read-model order (§11).

### 6.4 Scrolling and taps

- **Peek:** the last visible item is always cut, so the lane reads as scrollable. Item widths
  are chosen so this holds at 360 px.
- **Edge counter** at each side that has hidden items: `▸4`. A dot (`▸4•`) while a NEW item
  (§8) is hidden there. The counter bounces once when its number grows.
- **First appearance** in a run: the lane scrolls ~40 px and back once, by itself.
- Scroll snaps to item edges.
- **Tap vs drag:** a pick needs a press and release on the same item with < 10 px of movement.
  Any more is a scroll. A tap during momentum only stops the scroll.

### 6.5 Fat-finger guard

- Expanded cards (§6.6) and the ready popup (§9) are **inert for 400 ms** after they appear
  (dimmed, no hit testing).
- Lane items never move under a press in progress: inserts, removals and auto-scrolls wait for
  the release.
- **Auto-scroll waits while the player aims:** not during a press on the lane, and not within
  1 s of the last lane touch or manual scroll. It runs as soon as that window passes.
- Items that just moved under an auto-scroll are **inert for 300 ms**.
- Nothing in the deck, and no effect, overlaps the CODE button's hit area. CODE and the build
  row never move.

### 6.6 Expanded lane

```
│ ✓ LINTER BUILT · WHAT NEXT?        │
│┌──────────┐┌──────────┐┌────       │
││🚀Release ││💵 Gig    ││Tests      │
││ 80%  ~9s ││ $90–170  ││120⌨ ~1    │
││ ship it  ││ ~25s     ││+20% c     │
│└──────────┘└──────────┘└────       │
│ ● ○ ○ ○ ○ ○   release at ½ while you decide │
│            [    CODE    ]          │
```

- The same lane, same order, items grown into cards with the effect text; dots show position.
- **Opens** when a slot completes a build while it would fall back (no Manager Agent), when the
  player taps *Later* on a ready popup (§9), and when the player taps a build row. Scroll resets
  to the start on a completion. Arrivals while it is open scroll to themselves as in §6.3.
- **Closes** on a pick, a tap on its header, or a swipe down. On a completion it otherwise stays
  open while that slot is in fallback (the question is still open).
- From Manager Agent on, a completion does **not** open it: the build row shows
  *Manager picked X* for 3 s with a highlight (the auto-pick log throttle is unchanged).

## 7. Token gauge

Visible once tokens cost money (Terminal Agent, docs/feature_money.md §5) and while there is
token demand. It enters with an `UnlockAnnouncement`-style moment the first time in a run.

```
 full    │ TOKENS ▓▓▓▓▓▓▓▓░ ~1:40          [⟳ $48] │ button muted
 low     │ TOKENS ▓▓░░░░░░░ ~0:20          [⟳ $48] │ yellow, pulses, tick cue
 empty   │ TOKENS ░░░░░░░░░  STALLED 💤    [⟳ $48] │ red; agents asleep in the world
 no money│ TOKENS ░░░░░░░░░  STALLED  [need $48 · gig ▸] │
 risk    │ TOKENS ▓▓░░░░░░░ ~0:20  [⟳ $48 → $30 ⚠ rent 1:20] │
 auto    │ TOKENS ▓▓▓░░░░░░ ~0:35   AUTO v1 ⚠        [⟳] │
```

- The number is **time to empty** (`tokens ÷ tokenDemandPerSecond`), not a percentage. The bar
  is relative to one pack.
- **Low** below 30 s. **Empty** at zero demand-covering tokens.
- **Reload** is `buyUpgrade` on `token-supply`, one tap, always available when affordable. No
  confirm dialog.
- **Risk:** when the money after the purchase is below the next rent and rent is due within
  2 min, the button shows the balance after purchase and the rent timer. Information, not a
  block.
- **No money:** the button becomes *need $N · gig ▸*; tapping it selects the gig (or a search)
  in the focused slot.
- **Auto-refill:** AUTO v1 (with its warning) / AUTO v2 badge; manual reload stays available.

## 8. Motion and the attention budget

Motion is a budget: if everything moves, nothing is seen. The deck spends it on two moments —
something got **built** (§8.1) and something **arrived** (§8.2) — and keeps everything else
quiet.

Effects are drawn in a `pointer-events: none` overlay above the world. Particles may fly over
the world, the header and the build row, never over the lane items or CODE (§6.5).

### 8.1 Ta-da: a build completes (B9)

Scaled by what was built, so the big moments stay big:

| Tier | Built | Effect | Sound |
|---|---|---|---|
| S | technology; release or demo **ready**; a release shipped (after the wheel) | fireworks over the world (3–5 bursts, ≈1.5 s), screen flash, a short shake, the name in large pixel type | fanfare |
| A | upgrade (a level) | confetti burst from the build row (≈0.8 s), *"+20 % code"* floats over the world, the bar flashes | purchase cue (as today) |
| B | gig paid | coins burst into the money counter (the golden *+$x* of today, bigger) | coin cue |

- Two completions within 3 s: the second plays one tier lower. Never two tier-S effects at once.
- The lane expansion (§6.6) or the ready popup (§9) starts as the effect peaks (≈300 ms in), not
  after it ends: the reward and the next choice are one moment.
- From Manager Agent on, tier A drops to the bar flash and the float (completions are frequent
  and automatic by then); tier S stays.

### 8.2 Arrival: an item enters the lane (B8, B10)

| Step | Motion | Sound |
|---|---|---|
| 1. Scroll | the lane glides to the insert position (§6.3), ≈300 ms ease-out | — |
| 2. Land | slide in from the right edge, scale 0.6 → 1.08 → 1 (≈320 ms), a pixel sparkle burst around it | soft pop |
| 3. Spotlight | glow ring pulses twice (≈1.2 s), **NEW** tag | — |

Other motion:

| Event | Motion | Sound |
|---|---|---|
| Item becomes notable (gig found, release/demo READY, money card affordable) | one shine sweep; READY also gets the scroll-to of step 1 | — |
| Swap | picked item flies to the build row, old build flies into its spot (FLIP, ≈250 ms) | existing select cue |
| Removal | width collapses (200 ms) | — |
| Token low | gauge pulse (the only looping motion in the deck) | tick |

Rules:

- **One** arrival at a time; others queue 700 ms apart, each with its own scroll.
- Nothing loops forever except the low/empty token warning.
- **NEW** stays until the item has been fully visible for 1.5 s, or is tapped.
- An arrival whose scroll is held back (§6.5) waits in the queue; the edge counter shows its dot
  meanwhile.
- Auto-scroll moves the lane only; it never moves keyboard focus.
- **Reduced motion** (`reducedMotion`): no particles, shake, slide, scale or pulse; scrolls jump
  instead of gliding; tier S keeps a single flash; arrivals get a high-contrast outline and the
  NEW tag.

## 9. Ready release and demo (B11)

While the release or a demo builds it is an ordinary lane item: picking it only picks the target.
Shipping and running are offered once, at the moment it is ready.

```
┌──────────────────────────────────┐
│      ✨ fireworks over world ✨    │
│  ┌────────────────────────────┐  │
│  │   🚀 v0.3 IS READY          │  │
│  │   retire chance 4 %         │  │
│  │                             │  │
│  │  [ 🚀 SHIP IT ]  [ Later ]  │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│ ▶ Release  READY · polishing      │
│ [⏸GPU 9%][💵Gig $90+][Tests ~1…  │
├──────────────────────────────────┤
│          [    CODE    ]          │
└──────────────────────────────────┘
```

- **Opens** on the `projectReady` fact, after the tier-S effect peaks (§8.1). It sits over the
  world, not over the deck; CODE keeps working (B1). Inert for 400 ms (§6.5).
- **SHIP IT** → `shipRelease` → the wheel (feature_ship_it.md §7.2), as today. The demo's popup
  offers **▶ RUN** → the demo screen, as today. The popup shows what the old strip showed
  (version and retire chance; the demo's number).
- **Later** closes it. The item stays in the lane as **READY** (gold frame, shine on arrival),
  and the lane expands with *what next?* (§6.6): the slot is polishing, and polish is lost
  (feature_projects.md P2), so the next pick is the natural follow-up.
- **Tapping a READY item** opens the popup again. It never re-targets the slot.
- Readiness is one event per build: the popup opens by itself once, never again for the same
  ready release or after a reload.
- From Manager Agent on, the popup still opens (shipping stays the human's choice); the manager
  moving the slot off the ready release after 5 s (feature_projects.md §5.7) is unchanged.
- The SHIP and RUN buttons of the old strips are removed. Confirming a fallback (a tap on the
  release item while it builds) can never ship: shipping only exists inside the popup.

## 10. Desktop

The same component. On a wide layout the lane **wraps** into rows and does not scroll (horizontal
wheel scrolling is awkward with a mouse); expanded mode shows the cards with effect text inline.
The token gauge and the build rows are the same. Keyboard: arrow keys move focus along the lane,
focus scrolls it into view, Enter picks.

## 11. Read models and state

Pure TypeScript in `src/game/` (no DOM), unit-tested:

- **`laneItems(run, catalog)`** — every pickable target and lane-eligible card as one list with
  key, kind (`project` / `money` / `gig` / `search` / `job` / `choice`), name, progress, price,
  ETA, badge, and flags (`ready`, `affordable`). Its order is the default order on load.
- **`tokenGauge(run, catalog)`** — visible, tokens, seconds to empty, state (`full` / `low` /
  `empty` / `noMoney`), pack price, money after purchase, rent risk (amount, seconds), auto
  badge.
- **Completion signal** — the game view model exposes the latest `projectBuilt` per slot and the
  latest `projectReady` with their times and what was built (for the tier of §8.1), so the UI
  celebrates, expands and opens the ready popup once per event and never on a reload.

Presentation state in `src/ui/buildLane.ts` (pure helper, Vitest): the lane order with
`swap`, `insertAt(peekIndex)` and `remove`, and the NEW set. It is **not saved**: after a reload
the lane takes the read-model order. No `schemaVersion` change.

`selectProject` / `buyUpgrade` / existing commands are reused; no new game command.

## 12. Phases

Each phase ends with `npm run check`, `npm run test:game` and, from D2, `npm run test:browser`
(360 × 640 and desktop).

**D0 — Read models (MUST).** `laneItems` → `tokenGauge` states (full, low, empty, noMoney) →
rent risk → completion signal per slot.

**D1 — Lane order (MUST).** Swap in place → insert at the peek index → insert at the end when all
visible → remove closes the gap → no re-sort when prices or ETAs change → arrival queue (one at a
time, held while the player aims, released after 1 s).

**D2 — Deck on phones (MUST).** Build row + compact lane replace the UPGRADES toggle and the
sheet; peek, edge counter, tap-vs-drag threshold, momentum tap. Remove `offers-toggle` /
`offers-sheet`.

**D3 — Expansion (MUST).** Opens on completion in fallback, *release at ½* line, inert 400 ms,
close rules, no expansion from Manager Agent on (toast in the build row).

**D4 — Token gauge (MUST).** Visibility, time to empty, states, reload, risk, no money → gig,
AUTO badges, agents asleep at empty.

**D5 — Ready popup (MUST).** Opens once on `projectReady` → SHIP / RUN as today → *Later* leaves
a READY item and expands the lane → tapping READY reopens it → never on reload → old strips and
their SHIP / RUN buttons removed.

**D6 — Motion (MUST).** Arrival scroll + land + spotlight, NEW tag, queue, shine, swap FLIP;
ta-da tiers S / A / B, tier step-down within 3 s, the effect overlay never over the lane or CODE;
reduced motion; sounds (docs/sound_design.md gets the pop, tick and fanfare).

**D7 — Desktop (MUST).** Wrapping lane (arrivals spotlight without scrolling), keyboard, inline
offer list removed.

**D8 — Edges (MUST).** Decisions and compute as lane items, two-slot focus, employed row.

**D9 — Playtest and release.** §13 on phones; MINOR release.

## 13. Playtest checks

Same protocol as the 20 tests that found the problem.

| Check | Target |
|---|---|
| Players who pick within 3 s of a completion | most of them, from the first completion |
| Players who switch away from a long build on their own (B4) before 10 min | most of them |
| Picks undone within 5 s (misfires) | rare; any repeated case is a bug |
| Stalls from empty tokens noticed and reloaded within 10 s | most of them after the first |
| Players who scroll the lane without being told | all of them |
| Players who notice a new lane item within 3 s of its arrival | nearly all of them |
| Players who tap *Later* and ship later from the READY item | most of those who tap *Later* |
| Complaints about breaking the tapping rhythm | none |

## 14. Tests that change (no weakening)

| Test | Change |
|---|---|
| `tests/browser/mobile.spec.ts`, `setup.spec.ts`, `helpers.ts` | `offers-toggle` / `offers-sheet` → build deck and lane |
| `tests/browser/first-loop.spec.ts`, `agents.spec.ts` | pick targets from the lane; ship from the ready popup |
| `src/ui/GameView.test.ts` | deck instead of the sheet; expansion; gauge |
| `src/app/moneyView.test.ts` | money items and the gauge instead of sheet contents |
| new: `src/game/laneItems.test.ts`, `src/game/tokenGauge.test.ts`, `src/ui/buildLane.test.ts` | §11 |

## 15. Risks

- **Lane misfires** while the thumb is warm from CODE — §6.4 / §6.5; measured in §13.
- **Hidden items are missed** — the peek, the edge counter and its dot; if playtests still miss
  them, widen the peek before adding anything else.
- **Motion noise** — the §8 budget; if the lane feels busy, cut the glow first, keep the slide.
  If early tier-A confetti gets old, shorten it before removing it.
- **Auto-scroll fights the thumb** — the 1 s aiming window and the 300 ms inert rule (§6.5);
  §13's misfire check covers it. If it still steals taps, scroll only while the lane has been
  untouched for 3 s.
- **A missed ready popup** — the READY item keeps it one tap away, and the lane expands on
  *Later*.
- **Vertical space at 360 × 640** with two build rows, the gauge and the lane: the log shrinks
  to one line; the world keeps at least 40 % of the height (browser screenshot check).
- **The tax becomes trivial** because switching is easy: acceptable — the tax was meant to
  punish inattention, not hide the choice. Watch the harness *taxed share* numbers anyway.
- **Desktop wrap grows tall** late in a run: cap at two rows with an inner scroll if needed.

## 16. Open questions

- The shake in tier S (§8.1): keep it after the first phone playtest, or flash only?
