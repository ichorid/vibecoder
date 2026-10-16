# Economy redesign — joint plan (Claude analysis + Fable review)

Status: **proposal, not implemented** (2026-10-16). Owner decisions (2026-10-16): D1 — each
ending's Experience counts **once**; D2 — Ship It gets its **own slot** outside the three offer
cards. D3 (cat scaling) is still open. Every number below is a *starting value*;
the measurement harness (Phase E0) decides, and each phase records its measured result in
docs/agent_journal.md. Follow AGENTS.md TDD: one behaviour RED → GREEN → refactor per step.

Sources: Claude's economy analysis (seed 101, 4 player archetypes) and an independent Fable
review that re-ran every claim (seeds 1/7/42/101/2024, 10 archetypes; scratch sim
`econ2.ts`, to be folded into `tools/tune.ts` in E0). Where they disagreed, §8 records the
resolution.

---

## 1. Diagnosis in one paragraph

The production chain (`min(agents∧compute, tasks, tokens) × coordination × quality ×
efficiency`) and the verb ladder WRITE → … → OBSERVE are sound and on-theme. But the **main
route is tuned so the player never meets the couplings**: every technology ships exactly
enough managed capacity and review to neutralise what it adds, the card surface shows **one**
optional card in a fixed priority order, and progression prices grow at the same ×1.35 as
output. Result: minutes 0–7 depend entirely on tap rate (the human act lasts 51 s at 1 cps,
12 s at 4 cps), and from Manager Agent on the run is a **fixed ~16-minute timer** with one
decision — buy the next card. The money act lasts 2.6 min and is never at risk.

## 2. Verified findings

| # | Finding | Verdict | Key evidence |
|---|---|---|---|
| F1 | Back half is a fixed timer | Confirmed (both) | manager→company 15.8–17.3 min for every rate 1–10 cps; ≥2 optional cards visible 0 % of the time in 18/29 windows |
| F2 | Bottlenecks go dormant mid-game | Confirmed, refined by Fable | agents/compute bind 76–100 % of every window from 2.4 min; quality < 0.9 only 9.9–16 min; coordination < 0.95 only 17 % of one window; tokens bind only 11.4–13.0 min. **Tasks never bind for an active player** (Claude's "min 2–7" was wrong) |
| F3 | Couplings are real but hidden | New (Fable) | a player who buys agents aggressively hits debt 398, quality at the 0.2 floor, coordination < 0.95 for 90 % of a window — nothing on screen explains why |
| F4 | Card surface blocks allocation | New (Fable) | `selectors.ts:31` MAX_OFFERS 3; the always-on release card takes a slot (`selectors.ts:343-346`) → `[progression, release, one optional]`; baseline was compute-bound 100 % of 17.1–21.1 min while a 600-code compute slot stayed hidden behind review-capacity (priority 55 < 60) |
| F5 | Pace calibrated to 1 cps; cap allows 10 | Confirmed | `balance.ts` burst 10 / refill 10; company at 31.4 (1 cps) / 23.7 (4 cps) / 20.9 (10 cps); manual act 0–0.85 min vs architecture target 0–4 |
| F6 | Tokens are upkeep, not a decision | Confirmed | packs ≈ 2–5 % of code spent; 1 code → 6 work early, ~30 late; token-review is dead (priority 70 ⇒ never shown; worth ≈ 0.2 % even if bought) |
| F7 | Auto-refill v1 disaster is toothless | Confirmed | bank is 1–40 code at tech boundaries; the one disaster cost < 1 s of output; it can only really hurt savers |
| F8 | Money act: 2.6 min, never at risk; code stranded | Confirmed | cost 29/s vs revenue ≈ 200/s at Finance; bank 634k at company. Late code sink *already exists* (always-on releases; v3.0 ≈ 5 min after company) |
| F9 | Saving for releases is ruinous | Confirmed, cause refined | saving shipper > 15 min behind, partly because the test policy also blocks compute slots |
| F10 | No rhythm | Confirmed | 60–100 s per card everywhere; acts drift from the architecture table by up to −3 min |
| F11 | Ending gates are degenerate | New (Fable) | freeze-features opens the same step Evaluations unlocks; small-saas window 36 s; expand-anyway → automatic bankruptcy 9.8 min of OBSERVE |
| F12 | Harness measures an unreal run | New (Fable) | `tools/tune.ts` has no PLAY policy (its cat dies); no binding-share or cps columns |
| F13 | Experience multiplies everything, unbounded | New (Fable) | `economy.ts:197-198,338` × (1 + experience), +0.1 per lesson-learned ending, stacking per reach (`createGame.ts:163-168`) → **fixed by EX** (each ending once, max +0.5 with 5 lesson endings) |

## 3. Goals and non-goals

**Goals**

1. Each of the six acts lands within ±1.5 min of the architecture table (§4) for a **3 cps**
   player, and a 10 cps player is at most 10 % faster.
2. From 4 min on, the player sees ≥ 2 relevant optional cards most of the time and the one
   that matters (the binding constraint) is always among them.
3. Every automation keeps its dynamic alive: debt and coordination stay *visible and
   manageable* in the back half instead of pinned at 0 / 1.0.
4. Rhythm: a wall before each act, a burst of cards after it.
5. The money act is 5–6 min with a margin worth watching; a chosen bankruptcy plays out in
   ~3 min.

**Non-goals** (pillars from docs/initial_design.md §5 and feature_ship_it.md §3)

- No new resources and no new production systems ("avoid excessive resource-management
  complexity; the appeal is the next absurd level of automation").
- The technology ladder stays linear — no per-act forks.
- Shipping keeps **no economic reward**. Token packs stay an obvious buy ("the reseller rounds
  up"). The jokes stay; only their economics are fixed.
- MAX_OFFERS stays 3 (architecture rule); the release moves *out* of it instead.
- No offline progress; active time only.

## 4. Target metrics (the contract E0 measures)

All at experience 0, seeds 1/7/42/101/2024, PLAY-capable care.

| Metric | Today | Target |
|---|---|---|
| Company reached, 3 cps baseline | ≈ 25 min (between 2 cps 26.7 and 4 cps 23.7) | 28–31 min |
| Company, 1 cps / 10 cps | 31.4 / 20.9 | ≤ 36 / ≥ 25.5 (10 cps ≤ 10 % faster than 3 cps) |
| Idle (1 press/min after agent) | stalls at act 4 | finishes ≤ 55 min |
| Act boundaries (3 cps) | 0.85 / 7.3 / 14.1 / 21.1 / 26.6 / 31.4 | 3 / 8 / 13 / 18 / 24 / 30 (±1.5) |
| Manual share of output (3 cps) by tech | 23→6 % (1 cps), 72→33 % (4 cps) | ≈ 67 / 50 / 40 / 32 / 25 % at terminal…ralph, ≈ 0 after DELEGATE |
| Seconds with ≥ 2 visible optional cards, from 4 min | 0 % in most windows | ≥ 80 % |
| Window where X binds 100 % while an X card is affordable but hidden | yes (compute) | never |
| quality < 0.9 share, windows 16–31 min | 0 % | 30–60 % |
| coordination < 0.95 share, windows 16–31 min | 0 % | 20–50 % |
| Greedy capacity buyer vs progression-only | 2.2 min **slower** | ≥ 10 % **faster** |
| "Seer" buyer peak debt | 398 | ≤ 120 |
| Inter-act wall / intra-act card cadence | none / 60–100 s | ≥ 2 min / ≤ 60 s |
| Product Management → company | 2.6 min | 5–6 min |
| Expand → automatic bankruptcy / close-company offered | 9.8 / 2.0 min | 2.5–3.5 / 2.0 min |
| Auto-refill v1 disaster cost | < 1 s of output | 25–40 s, for spenders and savers alike |
| freeze-features delay after Evaluations | 0 s | ≥ 60 s |

## 5. Phases

Order is deliberate: measure → let the player *see* decisions → make them legible → retune.
Each phase is independently shippable and ends with `npm run check`, `npm run test:game`,
and a harness report pasted into the journal.

### E0 — Measurement harness (MUST, first)

- `tools/tune.ts`: flags `--cps <n>` (presses/s before and after agents), `--buyer
  baseline|greedy|seer|saver`, `--care play|none`, `--experience <x>`; per-window columns:
  binding shares (agents/compute/tasks/tokens), `quality<0.9`, `coord<0.95`, `2+offers`
  (from `selectGame`), manual share, bank, revenue, cost. Fold in Fable's `econ2.ts`.
- `tests/helpers/scenario.ts`: `tapAt(cps)` policy, `greedyCapacityBuyer`, PLAY in the
  standard care set used by tune.
- `tests/helpers/metrics.ts`: `measureRun(seed, policies)` → the §4 metrics as data, so
  scenario tests assert on named metrics instead of ad-hoc loops.
- Record today's numbers as the baseline table in the journal. **No balance change here.**

### EX — Experience counts each ending once (MUST, small, any time — owner decision D1)

Problem F13. Today `recordDiscoveries` (`src/app/createGame.ts:159-178`) adds an ending's
`experience` on **every** reach; replaying one lesson ending inflates every later run without
limit (the profile validator only caps it at 100 = +10 000 %).

- Experience becomes **derived**: `experienceOf(profile.endings, catalog)` = sum of
  `catalog.endings[id].experience` over the profile's distinct endings (pure, in `src/game/`).
  Five lesson endings × 0.1 ⇒ maximum **+0.5** (+50 %). Adding a lesson ending later raises
  the cap with no code change.
- `recordDiscoveries` gains experience only when the ending is new to the profile — the gain
  moves inside the existing "first discovery" branch.
- Loading a profile (`src/persistence/save.ts:445-455`) recomputes experience from `endings`
  and ignores a larger stored value, so inflated profiles normalise on next load. The stored
  field may stay for compatibility; it is no longer a source of truth. No run-schema bump: an
  in-progress run keeps the `run.experience` snapshot it started with.
- Ending screen (`selectors.ts:395-397`): for an ending already in the profile show
  "Lesson already learned" instead of `+10 % → next`. The selector returns
  `{ gained: 0, next }` plus `repeat: true`; one new string in content.

TDD order: reaching the same lesson ending twice gains 0.1 once → RED/GREEN; a profile with
`experience: 0.7` and two lesson endings loads as 0.2; a repeat ending's view model has
`gained 0, repeat true`; a non-lesson ending still shows nothing. Tune targets in §4 stay at
experience 0; add one harness line at experience 0.5 (all lessons) and require the 3 cps run
to stay ≥ 20 min.

### E1 — Card surface: show the decision (MUST)

Problem F4, F6. Pillar: Paperclips-style decisions without new systems.

1. **Ship It gets its own slot** (owner decision D2): a persistent **SHIP strip** under the
   three offer cards (`src/ui/`), shown from Terminal Agent while the run plays — one line
   "Ship v1.0 · 75K · retire 2 %", dimmed with the shortfall while unaffordable, tap → the
   existing confirm and wheel. `selectGame` exposes `release: ReleaseViewModel | null`
   separately from `offers`; `selectors.ts:336-346` loses the release branches, so with a
   progression card showing, the two remaining slots belong to ending choices and optional
   cards. Ending choices keep their current rules. Browser test: the strip fits the 9:16
   layout at 360 px without pushing the primary button off screen; release fixtures in
   `tests/browser/` move from card to strip.
2. Rank optional cards by **relevance** computed from `economyFlows` (pure, in
   `src/game/selectors.ts`): compute when compute < agents; agents when agents bind and
   managed ≥ agents and review has headroom; review when debt > 20; token pack when tokens
   last < 30 s; else static priority. Ties keep authored order.
3. Remove **token-review** (dead card): drop from `upgrades.ts`, `ids.ts`, `cardIcons.ts`,
   its tests (`effectText.test.ts:18`, `setup.test.ts:37-45`, `tokens.test.ts:66`);
   schema 6 → 7 migration strips its level (precedent: `token-supply` in
   `src/persistence/migrations.ts`). The `tokensPerCodeBonus` effect kind then has no content;
   remove it with the card (the auto-reviewer uses `economy.tokenReviewBonus`, not this kind).

TDD order: selector returns `release` separately → RED/GREEN; compute-bound run ranks
compute first → agents-bound ranks agents → debt > 20 ranks review; migration fixture.
Verify: `2+offers` ≥ 80 % from 4 min; no hidden-binding window.

### E2 — Legible couplings, softer cliffs (MUST)

Problem F3. Pillar: "every automation introduces a new bottleneck" — the player must see it.

- `qualityEfficiency` floor 0.2 → **0.35**; `coordinationEfficiency` floor 0.2 → **0.4**.
- Header: show `QUALITY nn%` while < 95 % and `TEAM nn%` (coordination) while < 95 %; they
  take the slot of `automation` late (which is a progress meter, not a state).
- Card impact text for capacity (`src/game/effectText.ts`): additional-agent reads
  "+1 agent · needs 1 compute, 1 managed".
- Setup view already shows flows; add the binding constraint name ("Limited by: compute").

Verify: seer buyer peak debt ≤ 120; force-merge still reachable by the reckless policy by
≈ 20 min (that ending is well designed; keep it).

### E3 — The human act and the tap cap (MUST)

Problem F5, F10 (act 1). Pillar: the human disappearing needs a "before".

- `balance.ts`: `actionBurst 6`, `actionRefillPerSecond 3`.
- Act-1 prices: autocomplete 20, generated-snippets 60, ai-native-ide 180, terminal-agent
  900 (see E6 for the rest of the table).
- UI: an over-cap press gets a visible "typing…" fizzle so the cap reads as pacing, not lag.
- `baselinePrimary` becomes **3 cps before agents, 1 per 3 s after** — the new design baseline
  (documented reason: realistic mobile tapping, see §7).

Verify: ai-native-ide at 2.5–3.5 min for 3 and 10 cps; manual-share curve within ±8 % of §4.
The early agent stays weaker than the thumb (that *is* the joke) but overtakes by
Autonomous Edits.

### E4 — Capacity becomes the back-half decision (MUST, after E1+E2)

Problem F1. Pillar: Paperclips processors/memory balancing — on existing cards only.

- Uncap `additional-agent`, `compute-slot`, `review-capacity` (maxLevel → e.g. 99).
- Price them by **payback**, not by level: `price = max(basePrice, K × usefulPerSecond /
  max(1, runnableAgents))` — "about K seconds of one agent's work". Starting K: agent 60,
  compute 45, review 60. Add `priceRule: { paybackSeconds }` to `UpgradeDefinition`;
  computed in `offerPrice` like `tokenPack` (`economy.ts`).
- Review-capacity also grants **+1 managed** ("senior reviewers coordinate") so the
  agent/compute/managed/review balance is buyable after DELEGATE is automated.
- Progression prices stay **fixed** (E6 table) — see §8 for why not output-relative.

The decision is then the balancing puzzle: which of agent / compute / reviewer is short now.
Verify: greedy capacity ≥ 10 % faster than progression-only; seer ≤ greedy (no hidden
advantage); 3 cps baseline still 28–31 min.

### E5 — Keep debt and coordination alive (SHOULD)

Problem F2, F11. Pillar: automation removes the button, not the dynamic.

- Tech managed capacity ≈ 70 % of the agents it brings: manager-agent +4 → +3,
  model-routing +2 → +1, custom-harness +4 → +3, meta-harness +6 → +4,
  self-driving-repositories +12 → +8, autonomous-company +24 → +16.
- Review: evaluations 20 → 10 and unchecked ×0.2 → ×0.5; self-driving review 40 → 20.
  The Evaluations satire ("the scores are always excellent") now has teeth: debt hovers.
- `lowDebtMs` resets when Evaluations unlocks, so freeze-features needs a real 120 s of
  clean pipeline.

Verify: §4 quality/coordination shares; freeze-features ≥ 60 s after Evaluations; the
"debt-heavy" narrative line still fires once.

### E6 — Act walls and bursts (SHOULD)

Problem F10. Rule: the first card of each act costs ×2 the previous card; within an act
×1.17. Total span kept (900 → ~180k). Starting table (round numbers, tune with E0):

| Card | Now | New | | Card | Now | New |
|---|---|---|---|---|---|---|
| terminal-agent | 450 | 900 | | context-management | 5.8k | **11k** |
| autonomous-edits | 650 | 1.1k | | persistent-memory | 7.8k | 13k |
| tool-permissions | 1k | 1.2k | | model-routing | 10.5k | 15k |
| persistent-instructions | 1.3k | 1.4k | | token-optimization | 14k | 18k |
| ralph-loop | 1.7k | **2.9k** | | local-servers | 19k | 21k |
| reviewer | 2k | 3.4k | | custom-harness | 26k | **41k** |
| parallel-agents | 2.4k | 4k | | meta-harness | 35k | 48k |
| worktrees | 3k | 4.7k | | evaluations | 47k | 56k |
| manager-agent | 4.2k | 5.5k | | workflow-optimization | 63k | 66k |
| | | | | self-improvement | 85k | 78k |
| | | | | self-driving-repositories | 115k | **160k** |
| | | | | product-management | 155k | 180k |

During a wall the only affordable cards are capacity (E4) — that is where allocation
happens; the act then bursts its remaining cards in ≈ 3 min. Verify: wall ≥ 2 min, intra-act
≤ 60 s, act boundaries ±1.5 min of §4.

### E7 — A money act worth watching (SHOULD)

Problem F8, F11.

- `operatingCostPerAgent` 1 → 3 (Finance); revenue card prices marketing 6k, finance 15k,
  executive-agents 20k, autonomous-company 30k.
- expand-anyway overhead `max(20, 3 × revenue/s)`; `money.creditSeconds` 180 → 120.
- small-saas then has a ≈ 3-min window naturally.

Verify: PM → company 5–6 min; margin at Finance ≥ 1.5× cost; expand → bankruptcy
2.5–3.5 min; close-company offered at 2.0 min.

### E8 — Auto-refill v1 disaster with teeth (SHOULD)

Problem F7. Loss = `max(disasterLoss × bank, 30 s × current output)`, clamped to the bank.
Keep both log lines. Verify: disaster costs 25–40 s of progress for spender and saver.

### E9 — Could

- **Cat demand rises with automation** (pillar: the cat as the last live loop). Pass
  `CAT_INTENSITY × (1 + automationFraction)` into `updateCat` from `simulation.ts`
  (economy → cat is the allowed direction; `cat.ts` stays economy-free). Verify the cat
  survives baseline care at every stage; care actions/min ≈ 2 → 4.
- **Ship card copy late**: "it costs you one second now" on cheap old releases — lean into
  the joke that shipping the original became free.
- ~~Experience~~ — decided (D1), now phase EX.

## 6. Test changes (no weakening — targets get stricter, the baseline gets realistic)

| Test | Now | After | Reason |
|---|---|---|---|
| strategies: baseline reaches company | 25–35 min at 1 cps | 28–31 min at 3 cps, 5 seeds | realistic baseline, tighter band |
| strategies: high-frequency input | ≥ 20 min at 10 cps | 10 cps ≥ 0.9 × 3 cps time | stronger invariant |
| strategies: slow player | 30–55 min | unchanged (1 cps then 1/15 s) | still guards the floor |
| strategies: shipper | ≥ 3 releases, ≤ 60 min | ≥ 3 releases, ≤ 45 min | E1 frees capacity buying for savers |
| early-automation: manager < 18 min; tokenShort > 20 s; debt-or-coordination > 20 s | as is | manager 11.5–14.5 min; keep the rest | act targets |
| new: `economy-shape.test.ts` | — | §4 metrics via `measureRun` | the contract |
| new: selector relevance tests | — | E1 | |
| new: migration 6 → 7 fixture | — | E1 | |
| new: experience counted once; inflated profile normalises; repeat-ending view | — | EX | D1 |
| browser: release card → SHIP strip | card in offers | strip outside offers | D2 |

## 7. Why 3 cps is the design baseline

Thumb tapping on a phone settles at 3–6 cps for minutes at a time; 1 cps is a patient
player, 10 cps an auto-clicker. Capping at 3/s makes every human player the same player for
pacing purposes, and lets the act-1 prices give the human act its intended ~3 minutes.

## 8. Disagreements and how they were resolved

| Topic | Claude | Fable | Resolution |
|---|---|---|---|
| First fix | uncap capacity / add a back-half decision | surface + legibility first; uncapping alone makes aggressive buyers collapse (debt 398) | **Fable**: E1, E2 before E4 |
| Tasks | "bind min 2–7" | never bind for an active player | **Fable** (measured 1 %); tasks untouched |
| Tap cap | 4/s | 3/s and retune act 1 | **Fable**; plus over-cap feedback (Claude) so the cap doesn't read as lag |
| Debt satire | Evaluations hides debt | just two multipliers | **Fable** (no new mechanic) |
| Late code sink | needed | already exists (always-on releases) | **Fable**; the money act is the real problem |
| Capacity pricing | — | seconds of *total* output; progression output-relative too | **Claude**: price by seconds of *one agent's* output. Total-output pricing makes payback grow with fleet size (dead late), and output-relative progression would make card time constant *by construction*, re-creating the fixed timer E4 exists to break. Progression stays fixed. |
| Tech forks | maybe one per act | no (scope; linear ladder is the design) | **Fable** |
| Act walls start at | — | reviewer | **architecture table**: walls at ralph-loop, context-management, custom-harness, self-driving-repositories |

## 9. Owner decisions

- **D1 Experience — decided 2026-10-16: each ending counts once.** Max +50 % with the five
  current lesson endings. Implemented by phase EX.
- **D2 Ship It — decided 2026-10-16: its own slot** (SHIP strip outside the three offer
  cards). Implemented in E1.1.
- **D3 E9 cat scaling — open**: raises late-game care load; needs a mobile playtest first.

## 10. Risks

- E4 + E5 together can over-correct into a debt spiral; E2's floors and the seer metric are
  the guard — land E5 only with the seer test green.
- Checkpoint saves (ab914e4) created under old prices load into new prices; harmless (prices
  are derived), but levels above new caps cannot exist since caps only rise.
- Art/world additions are keyed to technologies, not prices; no asset changes needed.
