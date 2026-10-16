# Feature: Ship It — launch windows, the wheel, and The Infinite Weekend

Status: **implemented** (2026-10-16); deviations are listed in docs/agent_journal.md D26
(schema 4, card order after choices, wheel-driven sounds). **Changed by the user (D27):** there
are no launch windows any more — the next release is always on offer once the Terminal Agent
exists; it needs at least its price in code and **spends all of the player's code**; after the
five authored releases (v0.1–v3.0) they continue (v4.0, v5.0, …, ×6 each) with the last
release's chance. §5.1's open/close rules below are history. Replaces the one-click
`ship-original` → `three-users` ending. Numbers below are starting values; §12 lists what tuning
may change and which tests guard it.

## 1. Summary

Shipping the original project stops being an instant, predictable ending. Five times during a
run a **launch window** opens. While it is open the player may spend an enormous, exponentially
growing amount of code to **ship a release**. Shipping opens a **wheel of fortune** that spins
and lands on a silly startup outcome ("3 users, including your mom"), shows a programmer-joke
"top comment", hangs a framed release on the wall of the original room — and the game goes on.

One slice of the wheel is gold. If it hits, the run ends with a new secret ending, **The
Infinite Weekend**: the programmer in a hammock on a beach, the cat asleep on their chest (if
the cat is alive). The gold slice grows with each window; a player who ships every single time
has exactly a **20 %** total chance to retire this way.

## 2. Problem with the current design

`ship-original` (`src/content/endings.ts`) is offered from Terminal Agent until Reviewer once
lifetime output ≥ 1 000.

1. **Not fun:** one click plus a confirm; no decision with a cost.
2. **No surprise:** the card says "This ends the run"; the result is always the same text.
3. **Stuck forever:** the card occupies an offer slot across five technologies and becomes
   noise.

## 3. Goals and non-goals

**Goals**

- Shipping is a recurring, costly, optional gamble with a visible, honest risk.
- Every outcome is funny; the rare jackpot is a genuine surprise.
- Opportunities are sparse (five) and time-boxed; the card never lingers.
- The cat's fate is reflected in every picture and text this feature shows.
- Fully deterministic per run; no reroll by reload or by waiting.

**Non-goals**

- No economic reward for shipping (no revenue, no production bonus). The joke, the wall and the
  lottery ticket are the reward; anything else would make shipping a mandatory chore.
- No manipulative presentation: no fake near-misses, no slice drawn larger than its odds, no
  "almost!" messaging.
- No illustrations for the other ten endings in this feature (see §12, deferred), but the
  two-variant picture pipeline built here is reusable for them.

## 4. Player experience walkthrough

1. Shortly after the Terminal Agent, the log says *"It works. It is small. You could ship it."*
   A card **Ship v0.1** appears with its price (2K code).
2. The player keeps playing; 2K is several minutes of production, so they must stop buying
   upgrades for a while to afford it. Or they ignore it.
3. If they ignore it long enough, the window closes: *"The launch window for v0.1 closed."* The
   card disappears.
4. If they ship: the code is spent, a full-panel **wheel** appears with nine silly slices and a
   hair-thin gold slice labelled with the true odds (*Retire: 0.2 %*). It spins ~4 s with
   ticking and lands.
5. Normal result: a card, e.g. **"Product Hunt"** — *"#47 product of the day, right behind a
   to-do app."* — and below it *Top comment: "If at first you don't succeed, call it version
   1.0."* The player taps **Back to work**. A small frame labelled `v0.1` is now on the wall of
   the original room.
6. Later windows repeat this at Manager Agent, Custom Harness, Self-Driving Repositories and
   Autonomous Company, with bigger prices and a bigger gold slice.
7. Jackpot: the wheel lands on gold, a short beat, then the ending panel **The Infinite
   Weekend** with the hammock picture.

## 5. Rules

### 5.1 Launch windows

| # | Version | Opens when this technology is unlocked | ~When (baseline) | Price (code) | Jackpot weight | Slice = chance on this spin |
| - | ------- | -------------------------------------- | ---------------- | ------------ | -------------- | --------------------------- |
| 1 | v0.1 | `terminal-agent` | 2–4 min | 2 000 | 0.2 | 0.20 % |
| 2 | v0.2 | `manager-agent` | ~14 min | 12 000 | 0.8 | 0.80 % |
| 3 | v1.0 | `custom-harness` | ~23 min | 75 000 | 2 | 2.02 % |
| 4 | v2.0 | `self-driving-repositories` | ~28 min | 450 000 | 5 | 5.15 % |
| 5 | v3.0 | `autonomous-company` | ~32 min | 2 700 000 | 12 | 13.04 % |

- A window **opens** on the step its technology is unlocked (the unlock transaction, not the
  announcement acknowledgement).
- A window **closes** when **both** hold: at least 3 further technologies have been unlocked
  since it opened, **and** at least 240 s of active time have passed since it opened. Window 5
  never closes (nothing comes after it). The "whichever is later" rule keeps fast players from
  losing a window they could not possibly afford yet; window 4 especially needs it (its price is
  close to everything produced during its first three technologies).
- **At most one release per window.** After shipping, the card is gone until the next window.
- A window that was skipped or missed is gone for good; later windows are unaffected.
- No window opens after the run has ended. Windows are independent of all other choices, with one
  exception: after `keep-manual` (which removes further automation) windows still open, since
  shipping is not automation.

Baseline timings come from a one-off headless measurement (seed 101, `baselineBuyer`, P11
strategy policies): code/s ≈ 5–8 at Terminal Agent, ≈ 50 at Manager Agent, ≈ 400–1 000 at Custom
Harness, ≈ 2 300–4 300 at Self-Driving Repositories, ≈ 3 600 at Autonomous Company (with ~650K
banked). Prices grow ×6 per window, i.e. roughly 2–4 minutes of saving at windows 1–4 and ~10
minutes for the final release.

### 5.2 Price

- Paid from the **spendable code balance** (`economy.output`), exactly like an output-currency
  upgrade. Lifetime output is unaffected (it already counted the code when written).
- The card shows the price and is disabled while unaffordable, like upgrade cards.
- Prices live in `src/content/` as named constants (`RELEASE_WINDOWS`), not computed in UI.

### 5.3 Jackpot odds

Weights (in percent of a whole run) are **0.2, 0.8, 2, 5, 12** — they sum to **20**. The wheel
shows the conditional chance for *this* spin, which makes the unconditional chance of winning
at window *k* exactly its weight for a player who ships every time:

```text
hazard_k = weight_k / (100 − Σ weights before k)

k  hazard     won by k (shipping every time)
1  0.200 %    0.2 %
2  0.802 %    1.0 %
3  2.020 %    3.0 %
4  5.155 %    8.0 %
5  13.043 %   20.0 %
```

- Hazards are **fixed per window index**, so skipping windows lowers a player's total chance but
  never changes what the wheel shows. The wheel never lies.
- Content stores the **weights**; the hazard is derived by one pure function with a unit test
  asserting the table above and that Σ weights = 20.

### 5.4 Outcome draw (determinism)

- Add a dedicated RNG stream `rng.release` (`deriveSeed(seed, 'release')` in `createRun`). It is
  consumed **only** by shipping, so the outcome depends on the run seed and the number of
  releases shipped — never on timing, waiting, or other narrative events. Reloading a save and
  shipping again gives the same result.
- Draw order per ship: (1) `nextFloat` → jackpot if `< hazard_k`; (2) if not jackpot,
  `nextInt` over **slices not yet used this run** (5 ships ≤ 9 slices, so never a repeat);
  (3) `nextInt` over **top comments not yet used this run**.
- The landing angle inside the chosen slice is presentation-only: derived from `visualSeed` and
  the release number, kept away from slice edges (and exactly centred for slices narrower than
  6°).
- The wheel animates toward a result that is **already committed** in the run. The UI never
  decides the outcome.

### 5.5 The cat rule

> If there is no cat (for any reason), there is no cat — in any text or picture.

- Today "no cat" means the cat has died. Sick, hungry, hiding, or in a PLAY session all count as
  **present**.
- A release records `catAlive` at the moment it was shipped; its result text never recomputes it.
  The ending record already stores `catAlive` (`EndingRecord`); the ending picture is selected
  from that same field, so text and picture can never disagree.
- Absence is shown as absence: no grave, no sad cat, no memorial objects inside these pictures.
- Applies to: wheel slice labels and texts (§6.1), the ending text and picture (§6.3, §7.6), and
  any new log line. The framed releases on the wall contain no cat at all.
- Guarded by validation and an art test (§10).

### 5.6 Interaction with existing content

- **Removed:** choice `ship-original` and its route to `three-users`.
- **Kept as legacy:** ending `three-users` stays in `ENDING_IDS` and `content/endings.ts` with a
  `legacy: true` flag so old profiles still show it in History. It is unreachable, excluded from
  "reachable endings" checks and from any remaining-endings hints.
- **`finish-by-hand`:** keeps its "project ready" rule (lifetime output ≥ 1 000); rename the
  constant if it stays only there. Shipping does not affect it.
- **`archive-original`:** description becomes release-aware: with 0 releases *"The thing you set
  out to build is still unshipped. The harness needs you more."*; with ≥ 1 *"You shipped it {n}
  times. Nobody noticed. The harness needs you more."* (`ChoiceDefinition.description` becomes
  `string | (run) => string`, or a selector variant).
- **Offer surface:** the release card is a third offer kind, `release`, sorted before choice
  cards so a long-running decision cannot starve a short window, and counted against
  `MAX_OFFERS` like other cards. The "progression card shown → at most two decisions" rule
  treats the release card as a decision.
- **Ending count:** reachable endings stay at ten (nine existing + The Infinite Weekend).

## 6. Content

### 6.1 Wheel slices (authored)

Nine silly slices of equal size share the wheel minus the gold slice. Labels are short (wheel
text); result lines are the result card body.

| ID | Wheel label | Result line |
| --- | --- | --- |
| `three-users` | 3 USERS | Three users. One of them is your mom. She thinks it's a calculator. |
| `one-star` | 1 STAR | One GitHub star, from a marketing bot. It starred 40,000 other repos today. |
| `hacker-news` | HN | 2 points on Hacker News. Flagged within the hour. |
| `product-hunt` | #47 | #47 product of the day, right behind a to-do app. |
| `viral` | VIRAL! | It went viral: a screenshot of the typo on your landing page. |
| `acquired` | ACQUIRED | Acquired for $1 by a crypto project. The payment bounced. |
| `cloud-bill` | $400 | Revenue: $0. Cloud bill: $400. Someone left autoscaling on. |
| `pivot` | PIVOT | An investor loves it. As a dating app. |
| `cat-review` | alive: CAT REVIEW · no cat: NO REVIEW | alive: The cat reviewed it by sleeping on the keyboard. Approved. · no cat: Nobody looked at it. Approved. |

`cat-review` is the only cat-aware slice; it uses the cat state at ship time for both label and
text. Gold slice label: **RETIRE** plus the true percentage beside the wheel.

### 6.2 Top comments (third-party, attributed)

Shown under every non-jackpot result as *Top comment: "…"*. Quoted **verbatim** from the
English neutral list of [pyjokes](https://github.com/pyjokes/pyjokes) (`pyjokes/jokes_en.py`),
whose header states the jokes come from the Stack Overflow question
["What is your best programmer joke?"](http://stackoverflow.com/questions/234075/what-is-your-best-programmer-joke)
under **CC BY-SA 3.0**. No general startup-joke source with a usable license was found; listicle
and pun sites are all-rights-reserved.

Selected (one per release, no repeats within a run):

1. If at first you don't succeed, call it version 1.0.
2. Hey! It compiles! Ship it!
3. You never finish a program, you just stop working on it.
4. Bug? That's not a bug, that's a feature.
5. A product manager walks into a bar, asks for drink. Bartender says no, but will consider adding later.
6. I have a joke on programming but it only works on my computer.
7. My attitude isn't bad. It's in beta.
8. Computer analyst to programmer: You start coding. I'll go find out what they want.
9. Child: Dad, why does the sun rise in the east and set in the west? Dad: Son, it's working, don't touch it.
10. QA Engineer walks into a bar. Orders a beer. Orders 0 beers. Orders 999999999 beers. Orders a lizard. Orders -1 beers. Orders a sfdeljknesv.
11. Artificial intelligence usually beats real stupidity.
12. Software developers like to solve problems. If there are no problems handily available, they will create their own.
13. You are making progress if each mistake is a new one.
14. The program is absolutely right; therefore the computer must be wrong.
15. Number of days since I have encountered an off-by-one error: 0.
16. A user friendly computer first requires a friendly user.
17. There are two ways to write error-free programs; only the third one works.
18. Programmers are tools for converting caffeine into code.

**Licensing:** the jokes live in their own file `src/content/releaseComments.ts` whose header
states source URLs, authorship ("Stack Overflow contributors, collected by the pyjokes
project"), and **CC BY-SA 3.0**; that file (only) is distributed under CC BY-SA 3.0, and the
project remains Apache-2.0. Credits appear in:

- the file header;
- `THIRD_PARTY_NOTICES.md` via a new static "Content" section emitted by the generator
  (`tools/noticesLib.ts`) — never a hand edit, since `npm run notices` regenerates the file;
- a one-line **Credits** entry in the Settings menu.

### 6.3 Ending: The Infinite Weekend (`the-infinite-weekend`)

The title comes from the original design list (`docs/initial_design.md` §10, #10).

Alive:

1. One release, out of nowhere, took off.
2. You sold it before anyone asked what it does.
3. Now there is a beach, a hammock, and no roadmap.
4. The cat sleeps on your chest. Neither of you has checked the metrics.

No cat:

1. One release, out of nowhere, took off.
2. You sold it before anyone asked what it does.
3. Now there is a beach, a hammock, and no roadmap.
4. The hammock has room for two.

### 6.4 Cards and log lines

| # | Card title | Card description (window open log line is the same text) |
| - | --- | --- |
| 1 | Ship v0.1 | It works. It is small. You could ship it. |
| 2 | Ship v0.2 | The original project still compiles. Mostly. |
| 3 | Ship v1.0 | The harness could ship the original project in an afternoon. |
| 4 | Ship v2.0 | The repository offers to ship itself. It needs your approval and a lot of code. |
| 5 | Ship v3.0 | The company does not know what the original project is. You could ship it one last time. |

- Window closed: *"The launch window for {version} closed."*
- Shipped (log + History entry): *"Shipped {version}: {wheel label}."*
- No "This ends the run" text and **no confirm step**: shipping is not a destructive
  commitment. The wheel's visible gold slice is the honest disclosure of the risk.

### 6.5 Achievements (discovered-only, no bonuses)

- `first-release` — *Shipped it (three users, probably)* — first release.
- `serial-shipper` — *Serial shipper: five releases* — all five windows shipped.

## 7. Presentation

### 7.1 Release card

Same visual family as upgrade cards (price, disabled when unaffordable) with a distinct accent
and the action label **SHIP**. Rendered in `GameView.svelte` as the new `release` offer kind.

### 7.2 Wheel overlay (`src/ui/ReleaseWheel.svelte`)

- Opens on the `releaseShipped` fact for the release just committed; covers the game panel like
  `EndingPanel` (absolute, inset), not the world canvas. The simulation keeps running (no new
  pause reason).
- **Geometry** in a pure module `src/ui/wheelGeometry.ts`: gold slice angle = hazard × 360°;
  nine equal slices share the rest; pointer at the top. The gold slice is drawn at true size
  with a glint marker and an outside label *RETIRE 0.2 %* so a sub-degree slice is still
  findable.
- **Spin:** SVG rotation, ~4 s, 4–6 full turns (from `visualSeed`), ease-out; a tick sound at
  each slice boundary crossing; landing angle per §5.4.
- **Skip:** after 1 s a tap/click or Enter/Space jumps to the final angle.
- **Reduced motion** (`prefers-reduced-motion`): no rotation; the wheel appears already resting
  on the result with the slice highlighted.
- **Accessibility:** focus moves into the overlay; the result is announced through an
  `aria-live="polite"` region; the result button **Back to work** returns focus to the offer
  list. Wheel slices have text labels (no colour-only meaning).
- **Reload mid-spin:** the release is already committed and saved; on reload the wheel is not
  replayed. The outcome is visible in the log and History (and, for the jackpot, the ending
  panel).
- Layout must fit 390 px wide with no horizontal scroll (existing layout tests).

### 7.3 Result card

Wheel label as the heading, result line, then *Top comment: "…"* in a quieter style, then
**Back to work**.

### 7.4 Jackpot sequence

The run is ended in the same transaction as the ship (ending record + History + profile
discovery saved in one envelope, as with every ending). Presentation holds the ending panel until
the wheel lands, then a ~600 ms gold flash, then `EndingPanel`. With reduced motion, the ending
panel shows after the static result.

### 7.5 Framed releases on the wall

- New sprite `release-frame` (small pixel frame with a version tag, e.g. 10×12) in
  `art/sprites/room.ts`.
- `ROOM_ADDITION` gains up to five fixed frame slots on `room-back`. The scene plan takes the
  number of shipped releases as a new input and places that many frames in slot order.
- Frames stay for the whole run and are visible whenever the room is (they shrink with LOD like
  the rest of the room).

### 7.6 Ending picture

- First ending with an illustration. `EndingDefinition` gains optional
  `illustrationId`; `EndingPanel.svelte` renders it above the title when present.
- Art in `art/illustrations/endings.ts`, 128×96 like technology illustrations: sea, sand, two
  palm posts, hammock with the programmer, and a cat layer composited with the existing cat
  sprites (`catSprites(...)` frame `cat-sleep`), as in `memorial.ts`.
- Exported twice by `npm run art:export`: `endings/infinite-weekend.png` (with cat) and
  `endings/infinite-weekend-nocat.png` (same scene, cat layer omitted — one drawing function with
  a `withCat` flag so the two cannot drift).
- The selector picks the variant from `EndingRecord.catAlive`. Alt text follows the same rule.

### 7.7 Sound

- Tick per slice boundary, a short "result" sting, and a jackpot fanfare. Wired through the
  existing `onFacts` → `music.facts(...)` binding (`releaseShipped`, `endingReached`). Ticks are
  driven by the wheel component through the same audio API the care effects use. Respects sound
  settings; size budget per `docs/sound_architecture.md`.

## 8. State, commands, facts, persistence

### 8.1 Run state

```ts
// RunState additions
rng: RngStreams & { release: number };
releases: ReleaseRecord[];          // in ship order

interface ReleaseRecord {
  window: 1 | 2 | 3 | 4 | 5;
  outcome: ReleaseOutcomeId | 'jackpot';
  commentId: string | null;         // null for jackpot
  catAlive: boolean;
  activeMs: number;
}
```

Window open/closed state is **derived**, not stored: the opening time is the `activeMs` of the
window technology's `{ kind: 'technology' }` entry in `run.history`; "+3 technologies" counts
later technology entries; shipped-ness comes from `releases`. `HistoryEntry` gains
`{ kind: 'release'; window; outcome; activeMs }` so History shows shipped releases in the
timeline.

### 8.2 Command and facts

- Command `{ type: 'shipRelease' }`. Rejected when: the run has ended, no window is open, this
  window already shipped, or the balance is below the price. Applied: spend price, draw outcome
  (§5.4), append `ReleaseRecord`, log + History entry; on jackpot, end the run with
  `the-infinite-weekend` in the same transition.
- Fact `{ type: 'releaseShipped'; window; outcome }`, followed by `endingReached` on jackpot.
- Selectors: `selectGame` gains the release offer; a `selectRelease(run, catalog, index)` view
  model gives the wheel slices (labels resolved by cat state), hazard, landing target and result
  texts. Svelte never reads catalog weights directly.

### 8.3 Persistence

- Bump `CURRENT_SCHEMA_VERSION` 2 → 3 with a migration: `releases: []`, and
  `rng.release = deriveSeed(hash(run.id), 'release')` for runs in progress.
- A saved run that already ended with `three-users` keeps that ending (legacy definition).
- Profiles containing `three-users` load unchanged; History shows it with its title and text.
- `ship-original` stays in `CHOICE_IDS` only if needed to load old `choices` maps; otherwise the
  migration drops that key (a run with it has already ended).

## 9. Boundaries (per `AGENTS.md`)

| Layer | Work |
| --- | --- |
| `src/game/` | command, draw, hazard function, window derivation, selectors, facts (pure TS) |
| `src/content/` | `RELEASE_WINDOWS`, slices, comments file, ending, achievements, events |
| `src/ui/` | release card, `ReleaseWheel.svelte`, `wheelGeometry.ts`, result card, `EndingPanel` picture, credits line |
| `src/world/` | release frames in the scene plan |
| `src/app/` | fact → sound wiring, ending-panel hold during spin |
| `src/persistence/` | schema v3 migration |
| `art/` | `release-frame` sprite, `endings.ts` illustration with/without cat |
| `tools/` | notices content section, content validation additions |

## 10. Test plan (TDD order: one behaviour RED → GREEN → refactor)

**Rules (`src/game/*.test.ts`)**

1. Hazard function: table of §5.3 to 3 decimals; Σ weights = 20; product of misses after window
   5 = 0.80.
2. Window opens on the unlock of its technology; not before; never after the run ended.
3. Window closes only when both +3 technologies and +240 s hold; window 5 never closes.
4. `shipRelease` rejected when closed / already shipped / unaffordable / ended; applied spends
   exactly the price from the balance and leaves lifetime output unchanged.
5. Determinism: same seed + same ship count ⇒ same outcome regardless of the time of shipping or
   intervening narrative events.
6. No repeated slice or comment within a run across five ships.
7. Jackpot ends the run in the same transition; ending record stores `catAlive` at that moment;
   discovery recorded once.
8. Cat-aware slice resolves label/text from the release's `catAlive`.
9. Achievements fire once, give no bonuses.

**Content validation (`tools/validateContent.ts`)**

- Every ending has non-empty alive and dead text; every ending with an `illustrationId` has both
  exported variants.
- Every cat-aware slice has both variants; slice labels ≤ 10 characters.
- `releaseComments.ts` contains the attribution header; comments ≤ 140 characters.
- Release windows: five, increasing prices, technologies in catalog order, weights sum to 20.

**Art (`art/` tests)**

- `infinite-weekend-nocat` contains no pixel of the cat palette colours; the with-cat variant
  does. Both are identical outside the cat layer's bounding box.
- `release-frame` fits its slot; `npm run check:content` up to date.

**Scenarios (`tests/scenarios/`)**

- `endings/`: a route to `the-infinite-weekend` from `createRun` with public commands only, on a
  seed found by searching for a jackpot (document the seed in the test).
- `endings/early-routes.test.ts`: remove the `three-users` route.
- Strategies: an "always ship" policy still reaches Autonomous Company within the existing
  regression ranges (+ allowance for saving time) and ships all five windows when affordable;
  existing strategies unchanged (they never ship).
- Statistical sanity (pure, seeded loop over many seeds): always-ship jackpot rate ≈ 20 % within
  tolerance.

**UI (`src/ui/*.test.ts`)**

- `wheelGeometry`: angles sum to 360°; gold angle = hazard × 360°; landing angle inside the
  target slice and away from edges; sub-6° slices land at centre.
- Wheel component: reduced motion shows the result without rotation; skip works; result card
  shows label, line and comment; focus management.
- Ending panel shows picture variant by `catAlive`; no picture for endings without one.

**Browser (`tests/browser/`)**

- Ship flow on a forced-seed save: card → wheel → result → Back to work; frame visible in the
  room; card gone.
- Jackpot flow: ending panel appears only after the wheel lands; correct picture for alive and
  dead cat.
- Layout at 390 px with the wheel open; reload mid-spin shows no replay and the committed
  outcome.
- Old-profile fixture with `three-users` still renders History.

## 11. Implementation order

| Step | Content |
| --- | --- |
| S1 | Hazard function and `RELEASE_WINDOWS` content; window derivation |
| S2 | `shipRelease` command, price, draw stream, records, facts, log/History |
| S3 | Jackpot → `the-infinite-weekend`; retire `ship-original`; legacy `three-users`; schema v3 migration |
| S4 | Slices and comments content with attribution; validation rules; notices section; credits line |
| S5 | Release card in the offer surface; `archive-original` release-aware text |
| S6 | `wheelGeometry` + `ReleaseWheel` + result card; reduced motion; accessibility |
| S7 | Ending illustration (two variants), `EndingPanel` picture support, art tests |
| S8 | Release frames on the wall (sprite, slots, scene plan input) |
| S9 | Sound (ticks, sting, fanfare) |
| S10 | Scenarios (jackpot route, always-ship strategy, statistical check), browser specs, journal update |

## 12. Open questions and tuning

- **Prices and window length** are starting values from one measurement. S10's always-ship
  strategy is the guard; adjust prices (keep ×~6 growth) or the 240 s minimum if window 4 is
  routinely unaffordable.
- **Version labels** (v0.1, v0.2, v1.0, v2.0, v3.0) — cosmetic, easy to change.
- **Pictures for the other ten endings** — deferred. The `withCat` drawing pattern, the
  two-variant export and the no-cat-pixels art test from S7 are designed to be reused.
- **Second-hand jokes** — if a better-licensed startup-specific source turns up, it can replace
  or extend `releaseComments.ts` under the same attribution rules.
