# Feature: Projects — code is built into things, never banked

Status: **proposal, not implemented** (2026-10-17). Owner decisions (2026-10-17) are in §2.
Every number is a *starting value*; the harness (`tools/tune.ts`, `tests/helpers/metrics.ts`)
decides, and each phase records its measured result in docs/agent_journal.md. Follow AGENTS.md
TDD: one behaviour RED → GREEN → refactor per step.

Supersedes, where they conflict: docs/feature_ship_it.md §5.2 and D27 ("shipping spends all
your code"), docs/economy_redesign.md E8 (the disaster's loss is defined on the bank) and every
"affordable / shortfall" rule in `src/game/selectors.ts`.

---

## 1. Summary

Code stops being a number that piles up. A programmer never "has 40 000 code" lying around; they
have a branch that is 60 % of the way to a feature. Every code-priced thing in the game becomes a
**project**: the player picks a **target**, everything written (by hand or by agents) flows into
it, and when it is full the project **is built** — its code is consumed and its effect applies,
exactly as buying the card does today.

**Ship It** is the original project and the default target. Whenever the player has not chosen
anything, code drifts back into the release — at half speed, because nobody is steering. Later
technologies take the choice away from the player step by step: first the agents pick the next
build for you, then they pick better than you, then they add projects of their own, and at the
end the original project is the only thing left that is still yours.

Reference model: Civilization's city production queue (production flows into the current item,
partial builds are kept), not builder-timer games.

## 2. Owner decisions (2026-10-17)

| # | Decision |
|---|---|
| P1 | Progress stays on a project when the player switches away (a paused branch). Switching costs nothing. No decay in this version. |
| P2 | Ship It does **not** ship on its own. At 100 % it waits for the player's SHIP; code arriving meanwhile is **polish** and is lost. |
| P3 | **Attention tax:** after a build completes, production falls back to Ship It at **×0.5** until the player picks the next target. Picking Ship It yourself gives ×1. The tax ends when **Manager Agent** unlocks auto-selection. |
| P4 | Token packs are small projects that interrupt the current build; token auto-refill is the first upgrade that switches the target without asking. |
| P5 | **Worktrees** give a second build slot (the flow splits between two projects). |
| P6 | Any project can be a target; none is a trap. The player can stop a build half-way and switch. |
| P7 | Revenue stays a bank (money piles up, code does not). Tokens stay a stock. Revenue-priced cards remain instant purchases. |
| P8 | The world shows scaffolding where a project is being built. |

Why only after a completion: production steps are 100 ms (`src/app/runtime.ts`), so a literal
"half of the overflow" would be at most 0.05 s of output and nobody would notice. The tax is
on the *unattended* time after a build, which is what costs attention.

## 3. Goals and non-goals

**Goals**

- Immersion: no code bank anywhere in the UI or the state.
- A tap fills a bar you can see; a completed build is a moment.
- The run's story — the human losing control — is played as the **loss of the choice of what
  to build**, on the existing technology ladder.
- Pacing for an attentive player stays where docs/economy_redesign.md §4 put it (build time =
  price ÷ rate, the same as saving up today).

**Non-goals**

- No new resource. Projects are a new *place* for code, not a new currency.
- No new technologies; the takeover rides on existing ones.
- No build timers or speed-ups. Progress comes only from code.
- Ship It keeps no economic reward (docs/feature_ship_it.md §3).
- No offline progress.

## 4. Player experience walkthrough

1. Run start: the Ship strip shows **Ship v0.1 · 0 %** with a "building" marker; WRITE CODE taps
   visibly fill it (the floating +1 flies into the bar). Before Terminal Agent the project is still
   "the project": the strip reads **The project** and has no SHIP button yet.
2. **Autocomplete** appears as a card with its price and *~7 s at your pace*. Tapping it makes it
   the target: the card gets a BUILDING badge and a fill; Ship It shows *paused 12 %*.
3. It completes: the usual unlock announcement, then the log says *"Built Autocomplete. The team
   drifts back to the release."* The Ship strip is marked **AUTO · ½** (dimmed, half-filled
   chevron, slow pulse on the bar): it was picked for you and runs at half capacity. One tap on
   the strip confirms it — it turns into a normal BUILDING target at full capacity — or a tap on
   any card builds that instead.
4. Terminal Agent: tokens appear. When they run low the player taps **Buy tokens**; the pack is a
   few seconds of output; the build it interrupted resumes when the pack is done (no tax — it was
   a context switch, not a new decision).
5. **Token auto-refill v1**: tokens run out → the target switches to a pack on its own (AUTO badge,
   log line). Sometimes v1's pack arrives empty *and* reverts ~30 s of the build it interrupted.
6. **Worktrees**: a second slot. Two cards can be BUILDING; each gets half the flow; taps go to
   the first slot.
7. **Manager Agent**: when a build completes, the manager picks the next one (AUTO badge, log
   line). No more AUTO · ½. A tap still overrides.
8. Later: Workflow Optimization overrules your picks when it knows better; Self-Improvement
   starts projects nobody asked for; Product Management stops defaulting to the release; the
   Autonomous Company removes the picker. The Ship strip — the original project — keeps
   filling only when the company has nothing better to do.

## 5. Rules

### 5.1 Projects

A **project** is any of:

| Project | Key | Price | On completion |
|---|---|---|---|
| Output-priced upgrade card (progression, capacity, token automation, auto-reviewer) | its `UpgradeId` | `offerPrice` | exactly today's `buyUpgrade` minus the payment: level +1, discoveries, log |
| Token pack (`token-supply`) | `token-supply` | `tokenPack(run).price` | tokens added (§5.6); level unchanged; card stays |
| Next release | `release` | `releaseAt(n).price` | becomes **ready**; ships only on SHIP (§5.5) |
| Next demo | `demo` | `nextDemo().price` | becomes **ready**; made only on the demo strip's button (same as Ship It) |
| Internal project (Self-Improvement, §5.9) | `internal:<id>` | authored | authored effect |

Not projects: revenue-priced cards (`currency: 'revenue'`, instant purchase from the revenue
bank as today), choice cards, cat care.

- A project's **price is frozen** when its first code arrives (`ProjectProgress.price`). This
  matters for payback-priced capacity (`priceRule`) and token packs, whose live price moves with
  the economy; a bar must never jump backwards. A completed repeatable project (capacity, packs)
  starts a fresh entry with a fresh price.
- **Progress is kept** when the target moves away (P1). It is lost only if the project stops
  being offered for good (e.g. `keep-manual` removes automation cards) — removed from state, no
  refund, no log.
- A project with progress > 0 that is still offered ranks **above** unstarted optional cards on
  the offer surface, so a paused build never hides behind `MAX_OFFERS`.

### 5.2 Slots and the flow

- The run has `slots`: one at start, two from `worktrees` (P5).
- Each slot has a `target` and `by: 'player' | 'system' | 'fallback'`.
- Each step, `produced` (manual + passive + useful, as `stepEconomy` computes today) is split:
  - **manual work** goes entirely to slot 1;
  - **agent and passive work** is split evenly between the slots.
- A slot's share is multiplied by **0.5 while `by === 'fallback'`** and Manager Agent is not
  unlocked (P3). The other half is gone.
- `stats.lifetimeOutput` still counts everything written (unchanged meaning: "code produced"),
  so endings and narrative conditions keep working.
- A project sits in at most one slot. Selecting a project that is in the other slot moves it
  there; the slot it left falls back.
- **Tap rule with two slots:** a tapped card goes to a slot in fallback if there is one, else to
  the slot whose player choice is oldest. (Tune after a phone playtest.)
- Selecting the project a slot already builds never deselects it. If that slot is in fallback,
  the tap **confirms** it: `by` becomes `'player'` and the slot runs at ×1 (§5.3). Otherwise it is
  a no-op.
- Leftover code on completion carries over in full into whatever the slot builds next.

### 5.3 Fallback (the attention tax)

- When a slot's project completes, its target becomes the fallback: Ship It, `by: 'fallback'`.
  If Ship It is in the other slot, both slots feed Ship It.
- Ship It **chosen by the player** (tapping the Ship strip) is `by: 'player'` at ×1.
- **The fallback is always visible and one tap from full capacity.** A target in fallback shows
  the **AUTO · ½** state (§7.1) wherever it is drawn — the strip or card, the slot list in Setup,
  and its scaffold (§7.2). Tapping it once confirms the pick (`by: 'player'`, ×1) and the marker
  clears at once. The SHIP button is a separate control from the strip's body, so confirming
  can never ship by accident.
- From Manager Agent on, completion runs **auto-selection** (§5.7) instead; `by: 'fallback'` is
  used only if auto-selection finds nothing.
- One log line per fallback, from a small authored pool (*"The team drifts back to the
  release."*, *"Nobody said what's next. Someone opened the release branch."*).

### 5.4 Overflow and polish

- A project never holds more than its price. Leftover code in the completing step carries over
  to the slot's next target.
- A **ready** release or demo (100 %, waiting for the player) takes no more code. Code flowing
  into it is **polish**: lost. One log line per ready project (*"The agents polished the README
  again."*). This is the second half of the attention tax and does **not** end with Manager
  Agent — auto-selection simply moves slots away from a ready project (§5.7).

### 5.5 Ship It

- The release in progress is `projects.release`; `nextRelease` and the jackpot rules are
  unchanged. Available from the run's start as "the project"; the SHIP button and the wheel appear
  from `terminal-agent` (`releases.availableFrom`), as today.
- `shipRelease` requires release progress ≥ price, consumes exactly that progress (not "all your
  code"), resets it to 0 for the next version, and keeps the slot's target (by the same `by`).
- Releases after the authored five keep growing ×6; at the end of the run the release can take
  minutes to fill — the original project quietly outscaled by everything else.

### 5.6 Token packs and auto-refill (P4)

- Tapping **Buy tokens** puts the pack in slot 1 with `resume = <previous target, by>`. When the
  pack completes, slot 1 returns to `resume` **without** the fallback tax (an interruption, not a
  new decision). Tokens per pack are frozen with the price.
- **Auto-refill (v1, v2):** when tokens < `refillBelowTokens`, demand > 0 and no pack is in
  progress, the system does the same switch on slot 1 with `by: 'system'` and an AUTO badge. Log
  once per run the first time: *"Auto-refill switched your build to a token pack."*
- **v1 disaster** (schedule unchanged: first on refill 3–6, then 15 %): the pack completes and
  delivers no tokens, and the build it interrupted loses
  `min(its progress, disasterSeconds × current output/s)` — *"Auto-refill v1 reverted your branch
  while paying for tokens that never arrived."* Target from economy redesign §4 kept: 25–40 s of
  progress lost.
- v2 never fails.

### 5.7 Auto-selection (Manager Agent, P3)

When a slot completes (or a slot is in fallback when Manager Agent unlocks), the system picks:

1. the offered **progression** card (with progress first);
2. else the `relevant` capacity card from `cardAdvice` (economy redesign E1);
3. else the started project with the most progress;
4. else Ship It (`by: 'system'`, ×1).

It never picks a ready project, and moves a slot off a ready release/demo after 5 s (*"The
manager reassigned the release team."*). A player tap always wins; the slot is then
`by: 'player'` until that project completes. Log line per auto-pick is throttled (≤ 1 per 30 s;
the AUTO badge carries the rest).

### 5.8 Later takeover (SHOULD/COULD — §8 phases)

| Tech | Rule |
|---|---|
| `workflow-optimization` | Picks by payback (`impact.codePerSecond / price`). A player pick that is < ⅔ as good as the system's is **overruled** after 20 s of building it; the player can re-tap, and is overruled again 20 s later. *"Workflow optimization moved your build. It was right."* |
| `self-improvement` | Every ~3 min an **internal project** (authored, e.g. "Rewrite the harness in Rust", "Migrate to the new framework", "Rename everything") takes slot 2 with `by: 'system'`; the player cannot select into that slot until it completes. Each gives a tiny permanent efficiency (+2 %), so the joke is that they are barely worth it. |
| `product-management` | Ship It stops being the fallback; auto-selection step 4 becomes "an internal project". Ship It fills only when the player taps it. *"Product has deprioritised the original project."* |
| `autonomous-company` | `selectProject` is rejected (`unavailable`); cards show what the company builds. Ship It is still tappable — the original project is the last thing that is yours. |

### 5.9 Cat, endings, narrative

- Cat care is untouched (no production effect). The cat may sleep on a scaffold (cosmetic).
- `finish-by-hand`, lesson endings, release jackpot: unchanged (they read `lifetimeOutput`,
  releases and choices, not the bank).
- `archive-original` description gains a variant when Ship It has been drifting/neglected — copy
  only.

## 6. State, commands, persistence

```ts
// src/game/types.ts
type ProjectKey = UpgradeId | 'release' | 'demo' | `internal:${string}`;
interface ProjectProgress { code: number; price: number; tokens?: number }
interface SlotState {
  target: ProjectKey;
  by: 'player' | 'system' | 'fallback';
  /** When it was set (two-slot tap rule, overrule timer). */
  sinceMs: number;
  /** Token packs: where to go back to. */
  resume: { target: ProjectKey; by: SlotState['by'] } | null;
}
// RunState: + projects: Partial<Record<ProjectKey, ProjectProgress>>; + slots: SlotState[]
// EconomyState: − output
```

- Commands: `{ type: 'selectProject'; id: ProjectKey }` for code projects; `buyUpgrade` stays for
  revenue cards only (rejects `output` cards). `shipRelease` / `makeDemo` check readiness.
- Facts: `projectBuilt { id }`, `projectSelected { id; by }` (presentation: sounds, scaffold).
- `src/game/projects.ts` (new, pure): `stepProjects(run, produced, catalog)`, `completeProject`,
  `autoSelect`, `fallback`. `stepRun` calls it right after `stepEconomy`; `tokenAutomation` moves
  into it.
- Save schema **9 → 10** (`src/persistence/migrations.ts`): `economy.output` moves into
  `projects.release` capped at its price; the rest of the bank goes into the first offered
  progression card, capped; anything above is dropped (0.x, MINOR release). `slots` =
  `[{ target: 'release', by: 'fallback', sinceMs: activeMs, resume: null }]`. v9 fixtures kept; new
  v10 fixtures.
- Release: **MINOR** bump (new mechanics, schema bump), per AGENTS.md.

## 7. Presentation

### 7.1 Cards and strips (`src/ui/`)

- Output cards are project cards: price, *~ETA at your pace* (from the slot's current rate;
  "—" while the rate is 0), a pixel fill bar along the bottom edge, and one badge:
  - **BUILDING** — the player's pick, full capacity;
  - **AUTO** (agent icon) — the system's pick (auto-refill, Manager Agent), full capacity;
  - **AUTO · ½** — a fallback pick at half capacity: agent icon plus a half-filled chevron, the
    fill bar dimmed and pulsing slowly, the ETA doubled. Tap it to make it BUILDING at full
    capacity (§5.3);
  - **PAUSED nn %**.
  No "unaffordable" dimming — every code card is tappable.
- Revenue cards keep the BUY look; the difference must be readable at 360 px (coin vs bar).
- Ship strip: progress bar, version, retire chance; **AUTO · ½** (as above, with the hint
  *tap to build at full speed* the first time in a run) while it is a fallback; **polishing** +
  SHIP button when ready. Demo strip: same pattern.
- The AUTO · ½ marker sits on the badge and bar, never as a popup or a growing warning, and it
  must stay legible at 360 px in both themes (browser test).
- Header: the `output` stat becomes **CODE/S** (`statLabels`, `STAT_ICONS`); no bank number
  anywhere. Setup view: the slots, their targets and rates replace "Total".
- FloatingGains: the +N of a tap flies toward slot 1's bar.
- Sounds: completion reuses the purchase cue; ready release a soft chime (sound_design.md).

### 7.2 Scaffolding in the world (P8)

The world shows **construction sites** for projects with progress > 0.

- **Progression projects:** the target technology's `WorldAddition` is drawn as **scaffolding**:
  its placements rendered as a dithered silhouette (the sprite masked to a girder/hatch pattern),
  revealed bottom-up to `progress`, with a small crane motif riding the fill line (idle and
  half-speed while the site is an AUTO · ½ fallback). On completion
  the existing reveal animation plays from the scaffold instead of from nothing. Paused projects
  keep their scaffold, frozen; selected ones animate (crane moves, sparks).
- **Framing:** a site outside the current envelope pulls the camera **halfway** to the
  addition's envelope (`interpolate(current, next, 0.5)`), only after the project has been the
  target for 2 s (no camera bounce on quick switching), back when deselected; the user view
  control (pan/zoom) is respected as today. This reveals only what the card already names, so
  progressive disclosure holds.
- **Compute slot:** the next server unit at the next `computeSlots` point, as scaffolding.
- **Ship It:** the next `frameSlots` point on the room wall shows an empty frame assembling;
  when ready it glints.
- **Other capacity, packs, demos, internal projects:** no site (too small or too short); an
  internal project shows a generic site near the newest addition — the machine building for
  itself.
- **LOD:** at `compact`/`dots` a site is a blinking hazard-yellow pixel. Never orange: orange
  pixels are the cat.
- **Art:** new kit motifs in `art/sprites/kit.ts` (`scaffold-girder`, `crane`, `frame-outline`,
  `site-sign`), both themes; `npm run art:export`. Never hand-edit `public/assets/`.
- **View model:** `WorldViewModel.sites: { kind: 'addition' | 'compute' | 'frame' | 'internal';
  id: string; progress: number; active: boolean }[]`. `describeScene` adds "a construction
  site, N % built".

## 8. Phases

Each phase ends with `npm run check`, `npm run test:game`, a harness report in the journal, and
(from Q1) `npm run test:browser`.

**Q0 — Harness speaks projects (MUST, first).** `tests/helpers/scenario.ts`: buyer policies
emit `selectProject`; a `react(seconds)` wrapper models how long a player takes to pick after a
completion. `metrics.ts`: per-project progress instead of `bank`; new metric **taxed share**
(fraction of produced code lost to fallback ×0.5 and polish). `tools/tune.ts --react <s>`.
Behind a stub that maps `selectProject` to today's buy, so today's numbers are the baseline.

**Q1 — Core model (MUST).** TDD order: a tap fills slot 1's target → a project completes at its
price and applies the upgrade → progress kept on switch → price frozen at first code → fallback
×0.5 after completion → the view model marks the fallback AUTO · ½ → tapping the fallback
target confirms it at ×1 and clears the mark → player-chosen Ship It ×1 → ready release takes
no code (polish) →
`shipRelease` needs readiness and consumes the price → demo likewise → revenue cards still
instant → `buyUpgrade` rejects output cards → started projects outrank unstarted optional cards.
Then migration 9 → 10 (fixtures), then UI (cards, strips, header CODE/S, FloatingGains), browser
fixtures moved from "affordable" to "progress".

**Q2 — Packs and auto-refill (MUST).** Pack resumes the interrupted build untaxed → auto-refill
switches slot 1 → v1 disaster reverts `disasterSeconds` of the interrupted build → v2 never fails.

**Q3 — Worktrees: two slots (MUST).** Agent work splits, manual work goes to slot 1 → tap rule →
moving a project between slots → both slots on Ship It.

**Q4 — Manager auto-selection (MUST).** Priority order of §5.7 → no tax after Manager Agent →
ready projects are left after 5 s → a tap overrides until completion → log throttle.

**Q5 — Scaffolding (MUST).** Art motifs, `sites` view model (pure tests), renderer layer, reveal
from scaffold, framing rule (camera tests), LOD dot colour test, scene description.

**Q6 — Takeover (SHOULD: workflow-optimization, product-management; COULD: self-improvement,
autonomous-company).** One behaviour each, §5.8.

**Q7 — Tune and release.** Retune only if Q0 metrics demand it; MINOR release.

## 9. Target metrics (added to docs/economy_redesign.md §4)

At experience 0, seeds 1/7/42/101/2024, 3 cps.

| Metric | Target |
|---|---|
| Company reached, attentive player (react 1 s) | within ±1 min of today's measured baseline |
| Taxed share before Manager Agent, react 1 s / 5 s / 15 s | ≤ 3 % / 8–15 % / 20–30 % |
| Company reached, react 15 s | ≤ +4 min vs react 1 s |
| Idle player (1 press/min after agent, react 60 s) | finishes ≤ 60 min |
| v1 disaster cost | 25–40 s of progress |
| Seconds with ≥ 1 visible BUILDING/AUTO site from Terminal Agent | ≥ 70 % |
| Camera moves caused by switching (2 s rule) | 0 for switches < 2 s apart |

## 10. Tests that change (no weakening)

| Test | Change |
|---|---|
| strategies, economy-shape, early-automation, main-route | buyers select projects; same timing bands |
| releases.test | "spends all code" → "consumes the price; ready waits; polish is lost" |
| tokens.test, lateEconomy.test | packs as projects; disaster defined on the interrupted build |
| selectors tests | `affordable`/`shortfall` → `progress`/`eta`/`badge`; started-first ranking |
| fixtures.test | v10 current; v9 → v10 migration |
| browser | cards show progress; SHIP at 100 %; no bank in header |
| new: projects.test, autoSelect.test, sites.test | §5, §7.2 |

## 11. Risks

- **Tap misfires on mobile:** a tap now changes the target instead of buying. Mitigated by
  P1 (nothing is lost on a switch) and the no-deselect rule.
- **The tax reads as a bug:** the AUTO · ½ marker must be visible on the fallback target and
  logged, or players will think production dropped for no reason; the one-tap confirm is the
  answer the marker points to.
- **Two slots on a 360 px screen:** badges must stay legible; browser test at 360 px.
- **Auto-refill v1 now interrupts:** combined with the disaster it can feel hostile. That is the
  intended v1 joke; v2 is the fix and must be clearly offered (it already is, priority 30).
- **Camera pre-framing** fighting user pan/zoom: the 2 s rule and the existing view control
  clamp; if it still feels bad, drop pre-framing and keep sites off-frame (they are revealed
  with the zoom anyway).

## 12. Open questions

- Two-slot tap rule (§5.2) — confirm after a phone playtest.
- Should the release ever be auto-selected after Product Management (§5.8)? Current answer: no;
  the original project needs the human.
