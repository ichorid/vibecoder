# Feature: Code a demo

Status: implemented 2026-10-16 (user request). A purely cosmetic code sink: the player spends
code on a "demo" — a popup that plays a pixelated, demoscene-style animation of an organic form
grown from a horn grammar. Each demo is a mutation of the previous one, so a run grows a lineage.

Decisions (user, 2026-10-16): cosmetic only (no economic effect; it is there to amuse and to eat
code); its own strip like Ship It; every demo mutates the previous one; a dev-only "Demo lab"
page in Settings.

## Origins and copyright

The form grammar follows William Latham and Stephen Todd's FormSynth "horn" grammar as published
(Todd & Latham, *Evolutionary Art and Computers*, 1992) and as documented by the Organic Art
preservation port: a horn is a tube of ribs; each rib's transform is the chain of the horn's
rules at u = i / ribs; a rib can itself be a horn. The rule definitions are mathematics:

| rule | transform at u |
|---|---|
| `stack(h)` | translate (0, u·h, 0) |
| `bend(a)` | rotate about Z by u·a |
| `twist(a, off)` | rotate about Y by u·a around x = −off |
| `grow(g)` | scale g^u (negative g keeps the sign) |
| `branch(a, k)` | tilt down a sphere cap of a° and turn k·137.5°·u·n (phyllotaxis) |

Nothing else is taken from Organic Art: no meshes, textures, scenes, lighting, oscillator
constants, generator code or form. The 72 original forms were analysed for their *principles*
only (two-level "tube inside a fan" skeletons, rule order meaning, waves summed from unrelated
rates, radial/mirror symmetry). This game's generator was then written from those principles,
and checked (outside the repo) against the 72 original scripts: 0 runs of 4 consecutive
instructions match exactly; with names and numbers erased only boilerplate ("declare a tube,
nest a child, set ribs, stack") matches.

**House rules** (`structureOk` in `src/demo/genome.ts`): `stack` and `tilt` may only open a
horn, and `bend` and `twist` are never neighbours. Every 4-rule sequence that occurs in any
original form breaks at least one of these, so no genome can repeat an original 4-rule
structure — guaranteed by construction, without storing any original data here.

## Generator (`src/demo/genome.ts`)

- **Tendrils** (innermost tubes): *taper* (stack, slow spin, shrink, curl), *spring* (offset
  twist → helix that swells or thins), *shell* (stack, more than a turn of bend, shrink → log
  spiral), *cone* (phyllotaxis `branch` inside a tube — new, the original only fans with it).
- **Arrangements** (wrap the level below): *fan* (branch over a 150–340° cap), *ring* (tilted
  copies on a circle via a full-turn offset twist), *tower* (stacked, twisted, shrinking tiers),
  *whorl* (copies along a shrinking spiral). Up to two levels.
- Radial copies 1–6, optional mirror, a slow tumble, an optional bulb at tendril tips.
- Parameters are `base + amp·wave (+ amp2·wave2)` over seven waves of this game's own periods
  (1.45–13.7 s) with per-genome phases.
- Budget: at most 900 balls per frame (`instanceBound`).
- **Mutation**: 1–3 weighted operators (tweak a parameter, change a wave, ribs, add/drop a
  rule, wrap/unwrap an arrangement, copies/mirror, bulb, swap the tendril, palette, backdrop,
  trails); a child that breaks the house rules or the budget is redrawn.

## Swirl, ripple, webs and colour (user, 2026-10-16)

The first version jittered instead of swirling. The original's motion comes from three things,
now in the generator (`genome.ts`): **slow, large oscillations** (its clock runs ≈ 20°/s, so
its waves have 9–90 s periods and twists swing ±360°) — waves are now 3–41 s and every family
has a *swirl* (±40–540° on a slow wave) on its main angle; **differential rotation** (each rib
turns by u·angle(t), so spirals wind and unwind); and **no turntable**: a `vortex` view puts
the form's axis at the camera and rolls it slowly, `tumble` sways it.

- **Ripple** (this game's extension): a wave's phase shifts with the parent rib's position, so a
  wave runs round an anemone's tentacles. A rippling horn's table is rebuilt per parent rib.
- **Webs** (principles of the original's web forms, rebuilt from our parts): a strand laid
  sideways about its middle (`lay`, applied after the rules, so the house rules hold), stacked in
  swirling, growing `layers`, repeated as spokes in a ring, seen face on.
- **Colour genes** (mutable): `bands` stripes along tubes, `flow` stripes that travel (with a
  ripple between tentacles), `tentacles` one colour per tube, `alt`, `mono`; `pulse` runs a
  light wave along the tubes. `thickness` ranges from lace (0.45) to fat bobs (1.3).
- The judge adds `+0.6·min(flow, 0.6)`, where flow = mask change between moments 3 s apart
  (first demos: 0.22 / 0.42 / 0.67 at p10/p50/p90). The first demo is the best of four viable
  draws.

## Invisible carriers, flocks, swarms, archetypes and shapes (user, 2026-10-16)

The original also drew *nothing* for some parts: an inform could be hidden ("Inform i of n
(hidden)"), scenes use `<none>` meshes, and grammars use horns with `ribs(0)` only to `attach`
other horns, chains of tails and heads, or the same horn rendered at several moving offsets —
invisible structure placing visible parts that do not touch. Our versions:

- **`dots`**: a tube draws every k-th rib (beads) or none but its tip (0: fireflies riding
  invisible swirling paths). Hidden ribs still set rib size; they are not drawn, framed or judged.
- **`flock`** arrangement: an invisible carrier path (helix or arc) with few, widely spaced
  ribs, so its children are far apart; rings may also set their children apart.
- **`swarm`** layout for copies: each copy faces its own way on its own slow orbit round the
  others (separate figures dancing round each other) instead of radial copies.
- **Archetypes**: a first demo's kind is drawn from its seed — solo 20 %, swarm 20 %, flock 18 %,
  radial 30 %, web 12 % — and the judge compares draws of that kind only (its taste favours
  spread-out radial forms). Scattered forms are judged against 2.5 % / 16 % coverage (viable /
  target) instead of 5 % / 28 %; the big-ball penalty allows big balls when there are many
  (solid tubes); solo, flock and swarm forms start thicker (overlapping balls).
- **Sprite shapes** (`src/demo/sprites.ts`): ball, ring (torus), gem (octahedron), cube, star,
  petal and drop, pre-shaded and outlined like the balls, made on first use per shape, size and
  one of 16 angles; shapes that are not round turn along their tube on screen. Ribs and tips
  each have a shape gene (mutation `shape`, cosmetic to the judge).

## Moving away from radial (user, 2026-10-16)

A first demo may be radial, but lineages then drift away: the judge's ranking of children
(`pickScore`) subtracts `0.8·max(0, symmetry − 0.5)`, where symmetry is how well the middle
mask matches itself turned by 360°/k (k = 3, 4, 5, 6, 8; on a 2-pixel grid). First demos read
0.25 / 0.56 / 0.79 (radial, p10/p50/p90) and ≈ 0.4 for flocks and swarms. Over 14 lineages that
start radial or as webs, mean symmetry goes 0.75 → 0.47 → 0.48 at demos 1 / 4 / 8 (without the
penalty 0.73 → 0.61 → 0.66).

## Designing the next demo (user, 2026-10-16)

On the demo screen — and only there, right after coding a demo (not when a demo is replayed
from History, not even the newest) — the player chooses what the next
demo grows into: three live previews (A is the judge's own pick; B and C are the next best that
look different) or **???**, a mystery that starts a brand-new random form. The previews are
built from the next demo's real seed (`nextUint32(rng.demo)`, exposed by the offer), so the
picked preview is exactly what is coded (UI and browser tests compare genome fingerprints).
The design is kept in `run.demoPick` (command `designDemo`) and copied to the demo's `pick`;
lineages replay `(seed, pick)` steps. Save schema 9 (8 → 9: `pick: null` on demos, `demoPick:
null`).

## Judge (`src/demo/judge.ts`)

Each new demo: up to 60 mutations of the previous genome; up to 12 that are *viable* (at 3, 6
and 9 s the form covers 5–55 % of the screen and touches ≥ 22 of 16×10 cells), *visibly
different* (≥ 30 % of the shape's mask pixels change) and *not only recoloured* are scored, and
the best wins. Scoring works on 80×50 occupancy masks splatted from projected rib centres (no
rendering):

```
−3·|coverage − 0.28| + cells/160 + 1.2·min(detail, 0.5)
−12·max(0, ribSize/radius − 0.06) − 6·max(0, biggestBall/radius − 0.22)
−0.4·min(1, |ln(motion/0.25)|) + 0.6·min(flow, 0.6) + 0.6·novelty
(+0.15 if the tree's skeleton changed)
```

`detail` = edge pixels per covered pixel (blobs are low); `motion` = mask change over 0.4 s
(calibrated: first demos 0.11 / 0.27 / 0.62 at p10/p50/p90); `novelty` = smallest mask
difference to the last three ancestors. Style (20 % vector lines), palette (re-rolled 40 %) and
backdrop (30 %) come from each demo's own seed, because the judge cannot see them.

Lineages are reproducible from the run's demo seeds and memoised by prefix; the popup replays
uncached demos one per animation frame behind a "depacking" bar.

## Speed (demoscene tricks)

Measured in the prototype against the straightforward version: one frame 7.0 → 0.11 ms (median
of 24 genomes), the judge 1,025 → 15 ms per demo, identical rib positions (float32 rounding).

- Typed-array transforms (13 floats), composed in place: no allocation per frame.
- **Rib tables**: each horn's transforms are computed once per frame and only composed with each
  parent rib (an inner tendril is not re-evaluated per parent rib).
- Leaf ribs keep only centre and scale (a ball looks the same from every side).
- **Vector bobs**: pre-shaded ball sprites at half-pixel radii with a 1-px dark outline instead
  of polygons; a 256-slot counting sort by depth; a screen-space 4×4 Bayer dither; depth fog.
- **Trails** by palette index: old pixels step one shade darker every n frames.
- Copper bars or a parallax starfield; a 160×100 indexed buffer mapped through a palette LUT
  into `ImageData`, scaled up with `image-rendering: pixelated`.

## Game rule

See `src/game/demos.ts` and `src/content/demos.ts`: available from the Terminal Agent (with Ship
It); the first demo costs 1,500 code and each next one ×2.2; it never spends more than its price.
The run records each demo's seed (from its own `rng.demo` stream) and whether the cat was there;
titles, groups and greetings are derived from the seed. A demo adds a log line and a History
entry from which it can be watched again. Save schema 8 adds `demos` and `rng.demo`; schema 9
adds the designed picks.

## Dev tools

- Settings → **Demo lab ›** (dev server only): seed, RANDOM / MUTATE / BACK, a 3×3 grid of
  judged children with their scores (pick one to continue; agreement with the judge is counted
  for tuning), family/palette/style/backdrop overrides, pause and a time slider, the genome as
  horn-script text, and frame statistics.
- `npx vite-node tools/demoSheet.ts -- --mode seeds|lineage|anim --seed N --count 24 --out x.png`
  renders contact sheets.
