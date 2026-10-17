# Feature: Money — gigs, rent, and AI Got My Job

Status: **proposal, not implemented** (2026-10-17). Builds on docs/feature_projects.md (gigs are
projects); implement after its Q1. Owner decisions (2026-10-17) are in §2. Every number is a
*starting value*; the harness decides, and each phase records its measured result in
docs/agent_journal.md. Follow AGENTS.md TDD: one behaviour RED → GREEN → refactor per step.

Supersedes, where they conflict: docs/feature_projects.md §5.6 (token packs stop being code
projects: they are bought with money), the code price of `compute-slot`, and the meaning of
`economy.revenue` (it becomes the player's money from the first gig, not only company revenue).

---

## 1. Summary

**Code builds things; money buys things.** From the first minutes the programmer is a freelancer
paying for their own AI tools. Money comes from **gigs**: a gig is a project (it fills with code
like any other) that pays a random amount of money, inside an honest range, when it is done.
Sometimes there is no gig and the player has to **search for a job** by tapping. Money pays for
**tokens** and **compute**, and every month for **rent**; feeding the cat costs a little.

When the rent cannot be paid, a **landlord wheel** spins. Each missed month makes the red slice
bigger; a lucky player can live on debt for a while, an unlucky one is evicted early. Eviction
ends the run with **AI Got My Job**: the programmer on the street, bearded, holding a cardboard
sign *"AI GOT MY JOB, PLZ HLP"*. Its lesson is a new kind: **live frugal** (−10 % rent in every
later run).

Gigs pay less with every era, because everyone has agents now — each drop is announced as a
**market update**. Later the player's own agents take the gigs; at Product Management the company
takes over the money and gigs disappear.

## 2. Owner decisions (2026-10-17)

| # | Decision |
|---|---|
| M1 | Rent is a **bill**: $100 every month (≈ 3 min of active time), not a continuous drain. |
| M2 | Gig pay per line of code **drops each era**, with a **market update announcement**. |
| M3 | Money buys **tokens and compute** only. Technologies stay code projects. |
| M4 | Eviction is a **lesson ending of a new kind**: *live frugal*, rent −10 % in later runs. |
| M5 | **Auto-freelancing** (automatic gig pick under a money threshold) at Workflow Optimization. |
| M6 | A missed rent spins a **landlord wheel**; the eviction slice grows with each consecutive missed month. |
| — | From the discussion: job-search bot around Ralph Loop; cat food $2 per FEED; search taps spend primary-action charges. |

## 3. Goals and non-goals

**Goals**

- A second axis from minute ~1: *what do I build* (code) and *can I afford to run it* (money).
- Every automation pays for itself in money too: agents cost tokens, tokens cost money, money
  costs code. The player feels the loop.
- Tension without unfairness: missing one rent never ends a run; the odds are always shown.
- The satire: the market for human code collapses while you automate it.

**Non-goals**

- No new production system: money uses the existing `economy.revenue` account and the existing
  credit/bankruptcy rules for the company.
- No shop, prices list or budget screen. Money shows on one strip and in the header.
- No recurring cloud bill for compute in this version (one-time purchase).
- No offline rent.

## 4. Player experience walkthrough

1. Minute 0: code only, as today. The cat eats from the parents' fridge (free).
2. The first technology is built → a **gig** is waiting: *"Landing page for a dentist ·
   $90–170"*. The **money strip** appears under the cards: `$150 · gig ▶`.
3. The gig is built → *"Paid $128."* → *"You moved out of your parents' place."* Rent starts:
   the strip reads `$278 · rent in 3:00`; the header gains `$`. FEED now costs $2.
4. Sometimes after a gig the strip says **No gigs · SEARCH 0/5**; each tap is a tap not spent
   writing code.
5. Terminal Agent: tokens cost money. Buying a pack is instant if the money is there; if not,
   the agents stall until a gig pays.
6. Ralph Loop: **MARKET UPDATE** — *"Gig rates −50 %. Everyone has an agent now."* Shortly
   after, the **job-search bot** is offered: *"Your bot applied to 400 jobs, including your own."*
7. A bad month: rent is due with $40. The rent goes on debt and the **landlord wheel** spins:
   *"Pay by Friday. Which Friday, he does not say."* The red **EVICTED** slice is 5 %. Next month,
   still broke: 15 %.
8. Workflow Optimization: **auto-freelancing** — when money runs low, the system takes a gig
   (AUTO badge). *"You outbid a freelancer named Dave. Dave is holding a sign now."*
9. Product Management: *"The company pays your rent. It calls it a perk."* Gigs end; the money
   act runs on revenue as today.
10. Eviction (if it happens): the ending panel, the street picture, *"Lesson learned: live
    frugal — rent −10 % in every later run."*

## 5. Rules

### 5.1 Money

- The account is `economy.revenue`, renamed **`economy.money`** in the schema bump (the old
  name would mislead every later reader). It may be negative (debt).
- Shown from the first available gig: money strip and header stat `$`.
- **Starting savings:** $150 (moved into the account when money first shows).
- Purchases (tokens, compute, revenue-priced cards) need `money ≥ price`; nothing is *bought* on
  debt. Only rent, cat food and the landlord's fees can push money below 0.
- Before Product Management debt carries no interest (the landlord is the pressure, §5.6). From
  Product Management on, the existing credit line, interest, notices and
  `fully-automated-bankruptcy` apply unchanged.

### 5.2 Gigs

- A gig is a project (docs/feature_projects.md §5.1) with key `gig`. At most one gig exists at a
  time: the **offer** (available, not started), in progress, or none.
- **Size:** `gigSeconds` (25) × the code per second at the moment it is offered, at least 50,
  rounded to a nice number. Frozen with the gig.
- **Pay:** `size × marketRate(era) × draw`, where the draw is uniform in [0.7, 1.3], with a 10 %
  chance of a **tip** (×1.5) and a 10 % chance of a **ghost** (×0.5). The card shows the honest
  range of the common case and the rare cases in small print (*"sometimes a tip, sometimes they
  ghost"*). The pay is drawn when the gig is **offered**, so neither timing nor reload changes it,
  and revealed when it is done.
- **Flavour:** client + job + payment line from authored pools (`src/content/gigs.ts`), e.g.
  *"Landing page for a dentist"* / *"Paid in exposure, then in cash."*. One cat-aware line at most
  (cat rule, docs/feature_ship_it.md §5.5).
- **RNG:** a dedicated stream `rng.gigs` (`deriveSeed(seed, 'gigs')`): offer availability, search
  length, size rounding, pay and flavour draws only.
- **Next gig:** when a gig is paid, the next one is offered with probability 0.6; otherwise the
  board is empty and needs a search.
- **First gig** is guaranteed as soon as the first technology is built.
- A gig in progress keeps its frozen size and pay through a market update (fair to the player).
- From `product-management` on no new gigs are offered; one in progress still pays.

### 5.3 Market rates (M2)

`marketRate(era)` in $ per line of code, by era; each change is a **market update**: an
announcement in the unlock-announcement style (`MARKET UPDATE`, one line, the new range of the
next gig) plus a History entry. It fires on the act-wall technologies from
docs/economy_redesign.md §8:

| From | $ / code | Announcement |
|---|---|---|
| start | 1.00 | — |
| `ralph-loop` | 0.50 | *Gig rates −50 %. Everyone has an agent now.* |
| `context-management` | 0.25 | *Gig rates −50 %. Clients ask why it takes a whole hour.* |
| `custom-harness` | 0.12 | *Gig rates −50 %. Your agents now compete with your agents.* |
| `self-driving-repositories` | 0.06 | *Gig rates −50 %. The gigs are posted by agents, for agents.* |

Output grows ×5–10 per act, so gigs still pay more in absolute terms; the *share* of code they
need falls. The announcements reveal nothing about upcoming technologies (progressive disclosure).

### 5.4 Search for a job

- With no gig offered, the money strip shows **No gigs · SEARCH n/N**. N is drawn uniformly in
  3–8 per search (`rng.gigs`).
- A SEARCH tap spends **one primary-action charge** (`balance.actionBurst` / refill), exactly like
  WRITE CODE, and adds no code: searching costs coding.
- At N/N a gig is offered.
- **Job-search bot** (`job-search-bot`, code project, requires `ralph-loop`, ~1.5 × the ralph-loop
  price): one search step every 2 s on its own; the player's taps still count. Log lines from a
  pool (*"Your bot applied to 400 jobs, including your own."*).

### 5.5 Rent and upkeep

- **Move-out** happens when the first gig is paid (log line). Rent is due every `monthMs`
  (180 000 ms of active time) from then on; the strip shows the countdown.
- **Rent:** `(rentBase + rentCreep × months since move-out) × frugal`, rounded to whole dollars:
  $100, $101, $102, … (`rentCreep` = $1), times 0.9 after AI Got My Job (§5.9). The increase is
  **quiet**: no log line, no announcement; only the number on the strip changes.
- **Cat food:** $2 per accepted FEED after move-out. Feeding is **never** blocked by money (it may
  go into debt) and never starts the landlord wheel. Cat care still has no positive production
  effect (initial design §6).
- **Tokens:** `token-supply` costs money: `price$ = packCodePrice × marketRate × 1.2` (the
  reseller rounds up). Instant purchase, no project. Auto-refill v1/v2 buys with money; v1's
  disaster takes `max(50 % of money, 30 s of income)` from money and delivers nothing — *"paid
  for tokens into the wrong account"* is now literal.
- **Compute slot:** money price `= paybackCodePrice × marketRate`. Instant purchase.
- After `product-management`: *"The company pays your rent. It calls it a perk."* Rent stops; the
  company's operating costs take over.

### 5.6 Missed rent: the landlord wheel (M6)

- Rent is **missed** when, at the due time, money < rent. The rent is charged anyway (money
  goes further below 0) and the **missed streak** grows by 1.
- The streak **resets** to 0 when a rent is paid with money ≥ 0 afterwards (debt cleared before
  the bill).
- Each missed rent spins the wheel. The draw happens **at the due time** from `rng.rent`
  (`deriveSeed(seed, 'rent')`); the wheel only animates the committed result, when Game is
  visible (like an announcement).
- **Eviction hazard by consecutive missed month** (content, `src/content/rent.ts`):

| Missed in a row | Red slice | Evicted by now (if broke every month) |
|---|---|---|
| 1 | 5 % | 5 % |
| 2 | 15 % | 19 % |
| 3 | 30 % | 43 % |
| 4 | 50 % | 72 % |
| 5 | 75 % | 93 % |
| 6 | 100 % | 100 % |

  So a broke player is out after 1–6 months (3–18 min), median about the 4th.
- The red slice is drawn at its **true size** and labelled with its percentage; no near-misses,
  no "almost!" (same honesty rules as the release wheel, docs/feature_ship_it.md §3).
- **Other slices** (equal shares of the rest; one draw among unused ones, like release slices):

| ID | Label | Text | Effect |
|---|---|---|---|
| `forgot` | FORGOT | The landlord forgot. He will remember. | — |
| `friday` | FRIDAY | Pay by Friday. Which Friday, he does not say. | — |
| `late-fee` | LATE FEE | A late fee. For the inconvenience of being poor. | −10 % of rent |
| `couch` | COUCH | You sublet the couch to a crypto founder for a week. | +20 % of rent |
| `roommate` | ROOMMATE | Your roommate covered half. You do not have a roommate. | — |
| `cat-landlord` | alive: CAT · no cat: EMPTY | alive: The landlord met the cat. He'll wait. · no cat: The landlord looked around the empty room. He'll wait. | — |

- **EVICTED** ends the run with `ai-got-my-job` in the same transition (like the release
  jackpot).

### 5.7 Auto-freelancing (M5)

- `auto-freelancing` (code project, requires `workflow-optimization`).
- When money < `max(2 × rent, 60 s of token spending)` and a gig is offered, auto-selection
  (docs/feature_projects.md §5.7) puts the gig first, `by: 'system'`, AUTO badge.
- With no gig offered, it also performs search steps every 2 s (it includes the bot).
- Log pool: *"You outbid a freelancer named Dave. Dave is holding a sign now."*,
  *"Your agents took a gig from a junior developer. The junior developer was also an agent."*

### 5.8 Enterprise job (minor feature, owner request 2026-10-17)

A rare, safe, soul-eating alternative to gigs: a fixed salary every month for as long as the
player builds nothing else at all.

- **Offer:** at each rent due from month 2 on, with probability 0.25 (`rng.gigs`), unless
  employed, on cooldown, or past `product-management`: *"A recruiter from Enterprise Solutions
  Inc. found your profile."* The offer is a card on the offer surface (ranked first while it
  lasts) and **expires after 90 s** of active time.
- **The card:** price **∞** (an infinity symbol where the code price goes), *Salary $N / month*,
  ETA *never*. Tapping it makes the job the run's target (docs/feature_projects.md §5.2); from
  then the card shows **EMPLOYED**.
- **Best Employee bar.** From the moment the job starts, the card's fill bar (which a job would
  never use — it never completes) becomes a **tenure bar** toward Best Employee: 12 pixel
  segments, labelled *BEST EMPLOYEE 3/12*. Each payday fills a segment; the current segment
  fills smoothly with the time employed this month. A firing (hidden layoff or switching) takes
  the bar with the job; the next job starts again at 0/12. Once the mug is awarded in this run,
  the bar is replaced by a small mug icon on later job cards. The bar shows tenure only — never
  the layoff chance — so every full segment is hope, and every layoff takes it away.
  View model: `job.tenure: { paydays: number; of: 12; monthFraction: number } | null`.
- **The job takes everything.** While employed, **all** code — manual and agent, from every
  slot — goes into the job and is consumed; it never completes. Worktrees do not help: the
  other slot keeps its target and progress but receives nothing (*PAUSED · employed*). No
  scaffold in the world. With the job there is exactly one target, so any tap on another
  project card (in any slot) replaces the job.
- **Never a job and a gig.** Accepting the job **abandons the gig**: an offered gig is withdrawn
  and a gig in progress is dropped with its progress and no pay (*"You told the dentist you
  found something stable."*). While employed the gig board shows *Employed*: no gig offers, no
  SEARCH, and the job-search bot and auto-freelancing stay idle. Gigs return after a firing
  through the normal search.
- **Never a job and a company.** Offers stop at `product-management`, and Product Management
  cannot be built while employed (nothing else gets code), so the two never overlap. Asserted
  as an invariant in the scenario tests, not handled as a case.
- **Salary** is fixed at the offer: `0.75 × monthMs/1000 × codePerSecond × marketRate`, rounded —
  a bit worse than freelancing for the same code, but steady. It **does not follow market
  updates**: nobody at Enterprise Solutions has heard of AI, so after a market update the job
  quietly becomes the better deal.
- **Payday** is rent day: salary × (time employed this month ÷ month), paid before rent is
  charged, so an employed player never misses rent.
- **Fired:** when any other project has been the target for more than **2 s** of active time
  (grace for a mis-tap; tapping the job again within it cancels), the player is fired:
  pro-rated final pay at once, a log line from a pool, a History entry, and the job is gone.
  Not an ending. The paused slots resume.
  - Reasons (`src/content/jobs.ts`): *overqualified*, *no cultural fit*, *the reorg*, *camera off
    in stand-up*, *not enough emoji in Slack*, *replaced by an agent you wrote*, *too
    productive*, alive-only: *your cat walked across the keyboard during the all-hands*. Format:
    *"💼 You're fired: {reason}. Your final paycheck: ${n}."*
  - The player's new target runs at ×1 (they chose it; no fallback tax).
- **Layoffs (hidden):** at every payday while employed, after the salary is paid, a draw from
  `rng.gigs` may fire the player anyway, with the same reasons and log format (the final
  paycheck is the salary just paid). The chance is a flat **20 %** every payday, whatever the
  tenure — so a job lasts 5 months on average (95 % end within 14) and never makes the player
  rich. The chance is **never shown**, hinted or announced; there is no warning. This is
  deliberate (owner, 2026-10-17): the job should feel safe and be unfair. It is the one hidden
  chance in the game; wheels keep their honesty rule.
- **Historic milestone: Best Employee.** At the **12th payday of one job** (the first, pro-rated
  payday counts), *before* that payday's layoff draw — so the mug and the firing can land on the
  same day — a History entry is added once per run: **Best Employee** — *"Twelve months at
  Enterprise Solutions Inc. They gave you a mug. It says BEST EMPLOYEE. It was ordered for
  someone else."* Log: *"🏆 Best Employee of the Year. Please collect your mug from reception."*
  - New History kind `{ kind: 'milestone'; id: 'best-employee'; activeMs }`; content in
    `src/content/milestones.ts` (title, text, `illustrationId`). When awarded, the picture is
    shown once in the unlock-announcement panel (kicker `HISTORIC MILESTONE`); in History the
    entry uses the existing 32×24 illustration icon plus a **VIEW** button that reopens the
    panel (History can only open demos today, via WATCH — this adds the same pattern).
  - **Picture** (`art/illustrations/`, both themes): a corporate mug, *BEST EMPLOYEE* in a stiff
    serif-like pixel font, a soulless swoosh logo for Enterprise Solutions Inc., a sad little
    trophy decal, steam. No cat (the cat rule never has to decide).
  - COULD: the mug stays on the desk in the room afterwards (world sprite, `WorldViewModel.mug`).
  - Rarity: 12 consecutive paydays survive the 20 % draw with probability 0.8¹¹ ≈ 8.6 % (the 12th
    draw comes after the award), and take 36 min of active time with nothing else built — a
    trophy for the player who gave the corporation everything.
- **Cooldown:** after a firing, no offers for 2 months (*"HR has flagged your profile."*).
- **Automation never moves the job:** auto-selection and auto-refill leave it alone; only the
  player can get themselves fired.
- Cosmetic (COULD): the programmer wears a lanyard while employed.

### 5.9 Ending: AI Got My Job (`ai-got-my-job`, M4)

- Reached only by eviction. Counts toward the ending total (one more reachable ending).
- **Lesson of a new kind:** `EndingDefinition.lesson` becomes a tagged union:
  `{ kind: 'experience'; amount: 0.1 }` (the existing five) or `{ kind: 'frugal'; rentFactor: 0.9 }`.
  `frugalOf(profile.endings, catalog)` is derived like `experienceOf` (each ending counts once,
  docs/economy_redesign.md D1); `createRun` snapshots it like `experience`.
- Ending screen: *"Lesson learned: live frugal — rent −10 % in every later run."*; repeat:
  *"Lesson already learned."*
- **Text** (cat-aware):
  - alive: *The AI took the gigs. Then the landlord took the flat. You kept the cat. The cat
    kept you warm.*
  - no cat: *The AI took the gigs. Then the landlord took the flat. The sign is new. The
    handwriting is yours.*
- **Picture** (`art/illustrations/endings.ts`, two variants, both themes): a bearded figure on a
  pavement holding a cardboard sign *AI GOT MY JOB, PLZ HLP* (pixel font, legible at 1×); alive:
  the orange cat asleep in a cardboard box at their feet; no cat: no box, no cat, no memorial —
  absence shown as absence.

## 6. Presentation

- **Money strip** (between the offer cards and the Ship strip, `src/ui/`): one line —
  `$ balance · rent in m:ss · [gig card | SEARCH n/N]`. The gig part behaves as a project card
  (badges, fill, ETA, AUTO · ½ rules from docs/feature_projects.md §7.1) and shows the pay range.
  Debt shows as a red balance and *missed ×k*. Must fit 360 px with the Ship and Demo strips
  (browser test); if not, the Demo strip collapses to an icon.
- **Header:** `$` stat from move-out; CODE/S stays.
- **Market update:** reuses `UnlockAnnouncement` with a `MARKET UPDATE` kicker and a small
  falling-chart icon; no world zoom.
- **Landlord wheel:** generalise `ReleaseWheel.svelte` to take slices, colours and the red/gold
  special slice from a view model; red instead of gold. Same spin length and sounds, a lower
  pitch.
- **World:** the room gets a door with a rent notice taped to it (sprite swaps: none → notice →
  red notice while the streak > 0). Cosmetic, from the `rent` view model.
- **Cat screen:** FEED shows *$2* after move-out.

## 7. State and persistence

```ts
// EconomyState: revenue → money
// RunState:
gigs: {
  offer: GigOffer | null;          // available or in progress (its project entry holds progress)
  search: { done: number; needed: number } | null;
  paid: number;                    // count (narrative, achievements)
};
rent: { movedOut: boolean; month: number; nextDueMs: number | null; missedStreak: number; missedTotal: number };
rentWheels: RentRecord[];          // committed results, for the wheel and History
job: {
  offer: { salary: number; expiresAtMs: number } | null;
  employed: { salary: number; monthEmployedMs: number; paydays: number } | null;
  awayMs: number;                  // time the job's slot has had another target (fired at 2 s)
  cooldownUntilMs: number | null;
  fired: number;
};
frugal: number;                    // snapshot of the profile's rent factor (1 or 0.9)
rng: { ...; gigs: number; rent: number };
interface GigOffer { size: number; pay: number; tier: 'normal' | 'tip' | 'ghost'; flavourId: string; rate: number }
```

- Commands: `searchJob`; gigs and the job use `selectProject { id: 'gig' | 'job' }`; `buyUpgrade` handles money
  purchases (tokens, compute, revenue cards).
- Facts: `gigPaid { amount }`, `hired`, `fired { reasonId; finalPay }`, `rentPaid`, `rentMissed { streak; outcome }`, `marketUpdate { era }`.
- Save schema bump (shared with docs/feature_projects.md if both land in one release):
  `revenue` → `money`; new fields default to "not moved out"; a run already past
  `product-management` is marked moved-out with no rent.
- Profile: no new stored field; frugal is derived from `endings`.
- Release: **MINOR** (new mechanics, ending, schema bump).

## 8. Phases

Each phase ends with `npm run check`, `npm run test:game`, a harness report in the journal, and
`npm run test:browser` when UI changed.

**N0 — Harness (MUST, first).** Policies: `freelancer(threshold)` takes a gig when money is
below `threshold × rent`, searches when needed; `carelessMoney` takes gigs only in debt;
`ignoresMoney` never takes gigs. Metrics: **rent burden** (share of produced code spent on gigs
for rent) and **token burden** per act, months missed, eviction minute. Baseline recorded.

**N1 — Money from the first gig (MUST).** TDD: first gig offered after the first technology →
paying it moves out and starts rent → `revenue` → `money` migration → header and strip.

**N2 — Gigs and market rates (MUST).** Size frozen at offer → pay drawn at offer from
`rng.gigs`, revealed when done → tip/ghost shares over 10 000 draws → next-gig probability →
market rate steps on the four act walls with announcement and History → in-progress gig keeps
its pay → no new gigs after Product Management.

**N3 — Search and the bot (MUST).** SEARCH spends a charge and adds no code → N/N offers a gig →
bot steps every 2 s.

**N4 — Money buys tokens and compute (MUST).** Pack and slot priced in money → no purchase on
debt → auto-refill in money → v1 disaster in money.

**N5 — Rent, cat food, the landlord wheel, the ending (MUST).** Bill at `monthMs` → missed rent
charges anyway and grows the streak → reset rule → hazard table (unit test of the cumulative
column) → wheel committed at due time, shown when Game is visible → eviction ends the run →
frugal lesson derived once, applied by `createRun` → rent grows $1 a month with no log line →
FEED costs $2, never blocked → art (both
variants, cat rule validation) → wheel generalised.

**N5b — Enterprise job (SHOULD).** Offer at rent due from `rng.gigs`, expiry 90 s → selecting it
takes all code from every slot and never completes (other slots paused) → accepting drops the
gig, no gig offers or search while employed → payday pro-rated before rent → another target > 2 s
fires with final pay, ≤ 2 s does not → hidden layoff at payday after the salary, a flat 20 %
(frequency test over 10 000 seeds), nothing about it in any view model → tenure bar (paydays, month fraction; reset on firing; mug
icon after the award) → Best Employee at the 12th payday, once per run, before
the layoff draw (History entry, illustration, log) → cooldown 2 months → automation never moves the job →
invariant: never employed with a gig or after Product Management → ∞ card, EMPLOYED and
PAUSED · employed badges (browser).

**N6 — Auto-freelancing (MUST).** Threshold pick → auto-search → AUTO badge and log pool.

**N7 — Company handover (MUST).** Product Management stops rent and gigs; the credit line rules
apply from there.

**N8 — Tune and release.** Retune technology prices so the act boundaries hold (§9).

## 9. Target metrics

At experience 0, frugal 1, seeds 1/7/42/101/2024, 3 cps, attentive projects policy.

| Metric | Target |
|---|---|
| Act boundaries (docs/economy_redesign.md §4) | still 3 / 8 / 13 / 18 / 24 / 30 min ± 1.5 |
| Rent burden, acts 1 / 2 / 3 / 4–5 | 15–25 % / 10–20 % / 5–10 % / < 3 % |
| Token burden (code spent on gigs to pay tokens), act 2–3 | 10–20 % |
| `freelancer(1.5)`: months missed | 0 on every seed |
| `carelessMoney`: evicted | on ≥ 3 of 5 seeds, median minute 8–14 |
| `ignoresMoney`: evicted | on 5 of 5 seeds, between minute 5 and 20 |
| Time with no gig and no search in progress, `freelancer` | ≤ 10 % before the bot |
| A single missed rent ends the run | ≤ 5 % (the hazard table) |
| Enterprise job offers per run (before Product Management) | 1–3 on most seeds |
| Job tenure (paydays), `employedForever` over 1 000 seeds | mean ≈ 5, 95th percentile ≤ 14 |
| Rent at month 10 | $110 (frugal: $99) |
| `employedForever` (takes every job, never leaves one) | never misses rent while employed; builds nothing after being hired, with one slot or two |

## 10. Risks

- **Early overload:** projects' AUTO · ½, search taps and rent all land in act 1. If playtests
  say "chore", cut first the search (raise next-gig probability to 0.85), then the ½ tax.
- **Death spiral:** debt → no tokens → agents stall → less code → no gigs. The guard is the
  `freelancer` metric; the spiral must stay a consequence of ignoring money, never of bad luck
  alone. If needed, a gig offered automatically when money < 0 (*"Your mom found you a gig."*).
- **Strip crowding** at 360 px with three strips; browser test, Demo strip collapses first.
- **Pacing shift:** gigs take a third of early code; technology prices in act 1–2 come down to
  keep the act boundaries.
- **Ending tone:** the eviction ending must read as satire about the market, not as mocking
  homeless people; the sign is the joke and the target is the AI economy. Review copy with the
  owner before shipping.
