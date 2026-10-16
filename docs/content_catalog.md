# Content catalog (authoring table — never shown to the player)

Working table for the 28 milestones (implementation plan P08.1). Code lives in
`src/content/{technologies,upgrades,balance}.ts`; art in `art/illustrations/`; world additions in
`src/content/world.ts`. Prices are starting values tuned by the headless main-route scenario
(target 30–90 s of current production per unlock; full pacing tuned in P11).

## Economy model (shared by all milestones)

Per 100 ms step (architecture §5):

```text
activeAgents  = min(agents, compute)
agentDemand   = activeAgents × workPerAgent × dt          (work units)
taskLimited   = min(agentDemand, tasks × workPerAgent)    (agents need queued tasks)
funded        = min(taskLimited, tokens / tokenCost)      (unfunded capacity idles)
coordination  = max(0.2, min(1, managed / max(1, activeAgents)))
quality       = max(0.2, 1 / (1 + debt / 100))
useful        = funded × coordination × quality × efficiency
debt         += funded × uncheckedFraction × debtRate − review × dt   (≥ 0)
output       += manualWork + passive × dt + useful
```

- Manual work is free (no tokens) and is the recovery path; a shared action-charge bucket
  (6 presses/s) caps the contribution of any primary action.
- Tokens are a stock refilled by supply; compute/agents/managed are capacities.
- Revenue (after product management) = useful × monetization; finance introduces operating
  costs; margin = revenue rate − costs; spendable revenue never goes negative.

Primary actions (each bounded):

| Action | From | Contribution |
| --- | --- | --- |
| WRITE CODE | start | manual output |
| PROMPT | 03 | manual output; from 04 also queues agent tasks (capped queue) |
| DELEGATE | 10 | temporary managed capacity (+1 per press, max +3, decays) |
| SUPERVISE | 12 | removes debt (bounded by the charge bucket) |
| OPTIMIZE | 21 | temporary efficiency (+5 % per press, max +25 %, decays) |
| OBSERVE | 28 | nothing |

## Milestones

| № | ID | Price | Effects (once, on discovery) | New bottleneck / responsibility | Action | Illustration / world |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | autocomplete | 10 out | manual +1 | still typing | WRITE CODE | ghost text + TAB / suggestion nodes by the monitor |
| 02 | generated-snippets | 30 out | manual +2 | still typing | WRITE CODE | comment → bricks / floating snippets |
| 03 | ai-native-ide | 90 out | passive +1/s | prompting | PROMPT | split-pane IDE / side terminals |
| 04 | terminal-agent | 450 out | 1 agent, 1 compute, 6 work/agent·s, token cost 1, supply 4/s, +150 tokens, PROMPT queues 12 task·s (cap 60); reveals Tokens | tokens and tasks | PROMPT | terminal process / terminal ring |
| 05 | autonomous-edits | 650 out | work/agent +6, debt from unchecked work (fraction 0.5 with basic tests, rate 0.01), tests review 0.05/s; reveals Debt | technical debt | PROMPT | edit/test loop / test runners |
| 06 | tool-permissions | 1 000 out | work/agent +6, task duration ×1.5 | permission gates | PROMPT | tool gates / gated tool rack |
| 07 | persistent-instructions | 1 300 out | passive tasks +1 task·s/s, work/agent +8 | instructions drift | PROMPT | instruction scroll / instruction node |
| 08 | ralph-loop | 1 700 out | passive tasks +3/s, work/agent +10, debt rate +0.01 | looping creates debt | PROMPT | infinite loop / loop machine |
| 09 | reviewer | 2 000 out | review 0.5 debt/s | review throughput | PROMPT | reviewer eye / review node |
| 10 | parallel-agents | 2 400 out | agents +2 (managed stays 1), supply +12/s (team plan) | coordination, compute | DELEGATE | branching agents / agent cluster |
| 11 | worktrees | 3 000 out | managed +1, compute +1 | merge conflicts | DELEGATE | parallel branches / worktree lines |
| 12 | manager-agent | 4 200 out | managed +4, automates delegating | review again | SUPERVISE | crowned manager / supervisor node |
| 13 | context-management | 19 000 out | work/agent +3, token cost ×0.85 | context limits | SUPERVISE | context buffers / buffer stacks |
| 14 | persistent-memory | 27 000 out | efficiency +0.2 | memory upkeep | SUPERVISE | memory bank / memory modules |
| 15 | model-routing | 38 000 out | token cost ×0.6 (min 0.1) | routing tuning | SUPERVISE | router / routing hub |
| 16 | token-optimization | 52 000 out | supply +8/s | squeezing tokens | SUPERVISE | token compressor / compressor |
| 17 | local-servers | 70 000 out | compute +6 | hardware | SUPERVISE | server ring / rack ring |
| 18 | custom-harness | 95 000 out | work/agent +4, managed +4, review +1 | harness upkeep | SUPERVISE | subsystem frame / harness frame |
| 19 | meta-harness | 130 000 out | agents +6, managed +6, compute +4 | harnesses of harnesses | SUPERVISE | supervisory layer / outer frame |
| 20 | evaluations | 175 000 out | review +4, unchecked ×0.5, automates supervising | metric gaming | OPTIMIZE* | eval dial / eval loop |
| 21 | workflow-optimization | 235 000 out | compute +6, efficiency +0.1 | optimization upkeep | OPTIMIZE | optimizer gears / gear works |
| 22 | self-improvement | 320 000 out | work/agent +6, efficiency +0.3, automates optimizing | control | OPTIMIZE | recursive core / feedback spiral |
| 23 | self-driving-repositories | 440 000 out | agents +12, managed +12, compute +12 | everything ships | OBSERVE* | repository network / pipelines |
| 24 | product-management | 600 000 out | monetization 0.02 rev/useful; reveals Revenue | product decisions | OBSERVE* | product node / roadmap node |
| 25 | marketing | 9 000 rev | monetization ×2 | growth | OBSERVE* | megaphone / growth links |
| 26 | finance | 22 000 rev | operating costs on; reveals Margin | spending | OBSERVE* | finance charts / finance subsystem |
| 27 | executive-agents | 50 000 rev | monetization ×1.5, automates deciding | governance | OBSERVE* | executive bots / hierarchy |
| 28 | autonomous-company | 110 000 rev | final framing | none left for you | OBSERVE | the company core / computational organization |

`*` the action column gives the label after automation of the previous responsibility; the
contribution rules above apply. Exact numbers live in content and may be retuned (P08.6/P11).

## Tuned values after P08.6 (source of truth is the code)

13–24 output prices 5 800 → 155 000 (×≈1.35); 25–28 revenue prices 3 000 / 7 000 / 6 000 /
12 000. Passive tasks added on manager (+4), custom harness (+10), meta-harness (+16),
self-driving repositories (+40), autonomous company (+60) — late agents were task-starved.
Review scales with maturity: custom harness +4, meta-harness +8, evaluations +20 with unchecked
×0.2, self-improvement and repositories unchecked ×0.5, repositories +40 review. Context
management token cost ×0.7 (+30 supply), model routing ×0.5. Responsibilities automated:
writing (04), prompting (08), delegating (12), supervising (20), optimizing (22), deciding (27).
Baseline route (seeds 101/202): autonomous company at 31.7 active min with 7 PLAY sessions.

## Tokens are bought with code (user request, after S09)

Replaces the old "Token supply: +6 tokens/s" repeatable. Technology subscriptions (+4/s at the
terminal agent … +400/s late) stay; everything above them is bought.

| Card | Appears | Effect | Price |
| --- | --- | --- | --- |
| Buy tokens (`token-supply`, consumable) | terminal-agent, only while tokens last < 30 s of demand (recovery card below 10) | one pack = 60 s of current full agent demand, min 300 tokens | ⌈pack / rate⌉, rate = 6 tokens per code × (1 + reviews + auto-review) |
| Token auto-refill v1 | persistent-instructions, until v2 is owned | buys a pack when tokens last < 20 s and code suffices; **bug**: the first disaster lands uniformly on refill 3–6, later ones 15 % per refill; a disaster deletes 90 % of current code and buys nothing | 1 200 |
| Token auto-refill v2 | after the first disaster | the same without the bug | 2 500 |
| Review your token spending | reviewer, 5 levels | +10 % rate per level | 800 × 2.2^level |
| Auto-reviewer | evaluations | +2 % rate every 30 s active, up to +50 % | 40 000 |

Why these numbers: mid-game an agent turns a token into ≈ 0.7 code, so at 6 tokens/code a pack
returns ≈ 4× its price and costs ≈ 20 s of income — clearly worth buying, still a decision.
Rate 3 starved the mid-game (route ≈ 40 min); 8 gained nothing over 6. The pack and the review
card must never sit permanently in one of the three card slots, or compute/review/agent
repeatables vanish and debt runs away (found while tuning). Baseline route: 31.0–31.5 min on
four seeds. Saves: schema 2; v1 "token-supply" levels become 1 800 tokens each.

## Repeatable upgrades (P07.3)

All priced in output, base × growth^level (2 unless noted), max 8 levels.

| Upgrade | Appears | Per level | Base |
| --- | --- | --- | --- |
| compute-slot | terminal-agent | +1 compute | 150 |
| additional-agent | parallel-agents | +1 agent | 120 |
| review-capacity | reviewer | +0.5 debt/s review | 200 |

Recovery cards (token supply when tokens are nearly empty) outrank optional repeatables; the
current progression card is always first; at most three cards.

## Header statistics (≤3, defined by the latest technology that sets them)

start: Code · 04: Code, Tokens · 05: Code, Tokens, Debt · 20: Code, Debt, Automation ·
24: Revenue, Code, Automation · 26: Revenue, Margin, Automation.

## Ship It (user request; design in docs/feature_ship_it.md)

| Window | Version | Opens at | Price | Jackpot weight | Wheel shows |
| --- | --- | --- | --- | --- | --- |
| 1 | v0.1 | terminal-agent | 2 000 | 0.2 | 0.2 % |
| 2 | v0.2 | manager-agent | 12 000 | 0.8 | 0.8 % |
| 3 | v1.0 | custom-harness | 75 000 | 2 | 2.02 % |
| 4 | v2.0 | self-driving-repositories | 450 000 | 5 | 5.15 % |
| 5 | v3.0 | autonomous-company | 2 700 000 | 12 | 13.04 % |

A window closes after 3 more technologies AND 240 s (window 5 never). One release per window,
paid from the code balance, no economic reward. Draw: `rng.release` only (jackpot → unused
slice → unused comment). Always shipping wins 20 % of runs; it costs ~12 min of saving
(company at 43 min, seed 1). The release card sorts after choice cards (journal D26).
`three-users` is a legacy ending (old profiles only); The Infinite Weekend is the tenth.

## Cat fates (user request, after S09)

Three fates: **alive**, **dead** (starved; candle log line, memorial with two photos) and
**stray**: a cat that begs for attention (mood < 40) for 8 active minutes in a row while not
critically weak walks out silently: no log line, no banner, a "The cat left. Nobody noticed
when." History entry, a MISSING poster in Cat, and the `stray` text in every ending. A
critically weak cat (health < 20) stops all intrusions and lies still.

## Endings (P09) — offer conditions and decision

| Ending | Card appears when | Decision | Route test |
| --- | --- | --- | --- |
| three-users | terminal-agent, before reviewer, lifetime output ≥ 1 000 | Ship the original project | early-routes |
| the-last-programmer | after `keep-manual` (reviewer..manager window) ≥ 120 manual presses, project ready | Finish it yourself | early-routes |
| the-great-merge-conflict | parallel-agents and debt ≥ 150 | Force-merge every branch | early-routes |
| the-greenest-pipeline | evaluations (before repositories), debt ≤ 5 for 120 s | Freeze feature work | early-routes |
| the-forgotten-project | custom-harness, before evaluations | Archive the original project | late-routes |
| the-perfect-saas | product-management (before company), margin > 0 for 120 s, debt ≤ 20 | Keep it small and profitable | late-routes |
| acquired-by-yourself | finance, before company | Accept the acquisition offer | late-routes |
| fully-automated-bankruptcy | after `expand-anyway` (fixed overhead = max(20, 2 × revenue/s)), margin < 0 for 120 s | Close the company | late-routes |
| the-human-approval-api | autonomous-company | Keep mandatory human approval | late-routes |
| you-have-been-optimized | autonomous-company (standard resolution, always available) | Remove human oversight | late-routes |

`keep-manual` returns WRITE CODE and hides further progression; `expand-anyway` commits a
loss-making overhead. While a progression card shows, at most two decision cards share the three
slots; later-stage decisions are authored first. Margin uses owed costs (spending is capped so
revenue never goes negative). Every ending has alive/dead text.
