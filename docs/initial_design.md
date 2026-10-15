# Implementation Specification: VIBE CODER

## 1. Overview

Build **VIBE CODER**, a mobile-first, pixel-art incremental clicker game inspired by [Universal Paperclips](https://www.decisionproblem.com/paperclips/).

**Premise:** A programmer starts with autocomplete and progressively automates software development, creating coding agents, custom harnesses, meta-harnesses, self-improving systems, autonomous repositories, and eventually self-driving companies.

The game is a 30-minute tragicomedy about productivity, technological escalation, loss of control, and the gradual disappearance of the human from the system they created.

A small orange cat accompanies the programmer throughout the game. The player must periodically interrupt their automation efforts to care for it.

**Central design principle:** Every technological improvement automates something the player previously did manually, while introducing a new bottleneck or responsibility.

The game gradually automates itself.

---

## 2. Visual Style

### Art direction

- Retro 8/16-bit pixel art, reminiscent of 1990s computer games.
- Crisp pixel rendering with no texture smoothing.
- Small pixel-art characters, equipment, and UI icons.
- Both light and dark themes, manually switchable at any point.
- Light: warm cream backgrounds, dark borders, green buttons.
- Dark: navy backgrounds, purple/blue highlights, glowing terminals.
- Subtle pixel animations throughout the game.
- Humorous, occasionally sarcastic writing that becomes increasingly ominous.

### Mobile layout

Target portrait screens (approximately 9:16).

The interface has three vertically arranged sections:

**Header (~12%):**
- Game title.
- `CAT` icon button.
- `HISTORY` button.
- Light/dark toggle.
- A minimal selection of current game statistics.

**Animated game world (~50–55%):**
- A continuous, animated pixel-art canvas.
- Shows the programmer, cat, and evolving technological infrastructure.
- Gradually zooms out as technology advances.

**Controls (~30–35%):**
- One primary action button.
- Up to 2–3 currently available upgrades.
- Small event log showing recent messages.

Use responsive sizing; proportions may change to accommodate smaller devices.

Avoid scrolling during normal gameplay whenever practical.

### Progressive disclosure

**Never show unavailable technology levels or their total count.**

The player should not know how many stages remain.

New resources, controls, mechanics, and upgrades appear only when unlocked.

Outdated controls can disappear when the corresponding functionality becomes automated.

The game must remain visually simple throughout, following the progressive UI philosophy of Universal Paperclips.

---

## 3. Screens

There are exactly **three screens**.

### A. Game

The main incremental game. All technology, resource management, upgrades, and world visualization happen here.

No navigation tabs, technology ladder, or separate management dashboards.

### B. History

Accessible through `HISTORY` in the header.

Contains a chronological timeline combining:
- Previously unlocked technologies.
- Achievements.
- Significant events.
- Milestones.
- Important moments involving the cat.
- Previously discovered endings.

Entries may have small pixel-art illustrations.

**No future technologies, locked achievements, or undiscovered milestones are visible.**

### C. Cat

Accessible through the cat icon in the header.

Contains:
- A large animated illustration of the cat.
- Detailed cat status.
- Three buttons: `FEED`, `PLAY`, `PET`.
- Short contextual messages describing its current condition.

The cat mini-game runs within this screen, without opening a fourth screen.

Returning to the main game must be instantaneous.

---

# 4. Main World: Recursive Zoom-Out

The game's main illustration is a **single continuous conceptual world**.

Initially, it shows a programmer in a cozy room, typing at a computer, with an orange cat nearby.

Whenever the player unlocks a significant technological advancement, the camera smoothly zooms out.

This reveals increasingly abstract structures surrounding the previous ones.

Example progression:

| Stage | World visualization |
|---|---|
| Autocomplete | Programmer, cat, desk, computer |
| Coding agent | Terminal processes surrounding the room |
| Multiple agents | Several small agent nodes, linked by task flows |
| Automated testing | Test runners, verification nodes, feedback loops |
| Agent manager | Supervisory nodes coordinating other agents |
| Custom harness | Tool, memory, context, and execution subsystems |
| Meta-harness | Hierarchical systems controlling other systems |
| Self-improving harness | Recursive feedback loops and self-modifying structures |
| Autonomous repositories | Large connected networks of development pipelines |
| Autonomous companies | Abstract corporate subsystems and decision hierarchies |
| Endgame | An immense, almost fractal autonomous computational network |

**Important:** Do not zoom out geographically through apartment → building → neighborhood → city.

The zoom reveals **new layers of technological abstraction**: connected machines, subsystems, controllers, pipelines, processes, and hierarchies.

The original room remains somewhere inside the expanding structure.

The programmer becomes progressively smaller.

Eventually, they are barely distinguishable from the machinery.

### Cat in the world

The orange cat must be a persistent animated entity.

Initially, it is clearly visible beside the programmer.

As the system expands, it explores the surrounding technological structures:
- Sleeping on a keyboard.
- Chasing cables.
- Playing with agent cursors.
- Sleeping on servers.
- Exploring graph connections.
- Wandering between abstract system nodes.

As the camera zooms out, the cat becomes a progressively smaller cluster of orange pixels.

Near the end, it is a single barely noticeable orange pixel moving among thousands of other pixels.

In the final zoom-out, that pixel disappears.

If the cat has already died, it must be absent from the world.

### Technology illustrations

**Every newly unlocked technology must have its own pixel-art illustration.**

On unlocking a technology:
1. Briefly pause or slow the world animation.
2. Display a small `NEW TECHNOLOGY` announcement.
3. Show the technology's illustration, name, and a short humorous description.
4. Animate the new subsystem appearing in the world.
5. Smoothly zoom out to accommodate it.
6. Resume normal gameplay.

The illustrations must communicate the technology visually rather than relying entirely on text.

Reuse consistent visual motifs across unlock illustrations and the persistent world.

---

# 5. Incremental Game Mechanics

Target completion time: **approximately 30 minutes** of active gameplay.

Use a data-driven technology and upgrade system.

### Technology progression

Include approximately 25–30 technological milestones, grouped internally into these phases:

1. **Manual coding:** Typing, autocomplete, AI-generated snippets, AI-native IDEs.
2. **Agentic coding:** Terminal agents, autonomous edits, tool permissions, persistent instructions.
3. **Agent orchestration:** Ralph loops, reviewers, parallel agents, worktrees, manager agents.
4. **Infrastructure:** Context management, persistent memory, model routing, token optimization, local servers.
5. **Recursive automation:** Custom harnesses, meta-harnesses, evaluations, workflow optimization, self-improvement.
6. **Autonomous organizations:** Self-driving repositories, AI product management, marketing, finance, executive agents, autonomous companies.

These groups are internal implementation details, never an explicit ladder shown to the player.

### Core gameplay

At the beginning, the player clicks:

`WRITE CODE`

This generates a small amount of code.

Upgrades introduce passive generation and multipliers.

The primary action evolves as the player progresses:

`WRITE CODE → PROMPT → DELEGATE → SUPERVISE → OPTIMIZE → OBSERVE`

The player should progressively perform less direct work.

Technological improvements eliminate existing bottlenecks while introducing new ones.

For example:
- Coding agents increase output but introduce review requirements.
- Parallel agents increase throughput but introduce coordination overhead.
- Automated reviews reduce human work but require better evaluation.
- Model routing reduces costs but introduces optimization complexity.
- Self-improving systems reduce manual configuration but introduce control problems.

### Resources

Introduce resources progressively, as needed:
- Code / output.
- Tokens.
- Agents.
- Compute.
- Technical debt.
- Automation.
- Revenue.

Do not expose all resources at the beginning.

Avoid excessive resource-management complexity. The main appeal is discovering the next absurd level of automation.

### Narrative

Use short, dynamically triggered messages:

> Your AI reviewer has approved its own code.

> You spent $400 optimizing a workflow that saves $0.03 per run.

> Your agents have hired a manager.

> Your manager has requested a manager.

> Human oversight has been identified as an inefficiency.

Keep the tone humorous in the early game, increasingly dark and existential near the end.

---

# 6. Cat Mechanic — Core Requirement

The cat is an independent Tamagotchi-like system that competes for the player's attention.

**Its purpose is to interrupt the optimization loop.**

The player must periodically stop pursuing productivity to observe and care for a living creature.

Cat care must have no direct positive effect on code production, automation, or resource generation.

The cat is intentionally an inefficient use of the player's time.

## 6.1 Header: miniature status bars

Place a small cat-face button immediately beside the `HISTORY` button.

**Directly underneath the cat button, place two tiny horizontal status bars.**

These must resemble the miniature HP/MP indicators from old computer games.

Example:

```text
┌────────┐ ┌─────────┐
│  🐈    │ │ HISTORY │
├────────┤ └─────────┘
│████░░░░│  Health
│███░░░░░│  Mood
└────────┘
```

This ASCII diagram is schematic; the actual implementation should be much more compact.

Requirements:

- Both bars must be **no wider than the cat button**.
- Each bar should be approximately 3–4 CSS pixels tall.
- They must sit immediately below the button, separated by only 2–3 pixels.
- No permanent text labels or numeric percentages.
- Use small icons or distinct colors to differentiate physical condition and mood.
- Both bars remain visible during normal gameplay.
- The entire cat-button area must be easy to tap, despite the tiny bars.
- No large cat status panel on the main screen.

**The small size is intentional.**

The player should have to consciously monitor the indicators.

Do not automatically enlarge them or transform them into prominent notifications when their values decrease.

Use smooth depletion, while retaining pixel-art styling.

Internally, track:
- `health`: 0–100.
- `mood`: 0–100.
- `fullness`: 0–100.
- `overfeeding`: accumulated overeating.
- `alive`: boolean.

The two header bars represent **health and mood**. Fullness is an internal variable, visible in detail on the Cat screen and reflected in health as starvation develops.

---

## 6.2 Time and decay

Cat needs decrease while the game is actively running.

Use both elapsed active gameplay time and player actions to drive the simulation.

Suggested starting values:

```typescript
health = 100;
mood = 85;
fullness = 75;
overfeeding = 0;
alive = true;
```

Suggested mechanics:

- A base simulation tick occurs every 5 seconds of active gameplay.
- Meaningful player actions can accelerate needs slightly.
- Acceleration must be capped to prevent accidental death during rapid clicking.
- Fullness decreases approximately 0.65 per base tick.
- Mood decreases approximately 0.45 per base tick.
- Low fullness gradually reduces health.
- Repeated overfeeding also damages physical condition.
- Successful feeding allows health to recover gradually.
- Severe starvation eventually kills the cat.

The rates should be tuned so that:
- Feeding is normally useful every 3–4 minutes after the initial grace period.
- Playing is useful approximately every 4–6 minutes.
- Ignoring the cat throughout an entire playthrough is fatal.
- Caring for it is manageable but creates meaningful interruptions.

The cat must never die merely because the browser is closed or the tab is inactive.

Pause cat simulation when the game is not actively running.

---

## 6.3 FEED

Button: `FEED`

Visual: a pixel-art food bowl.

Effect:
- Adds a random 18–32 points to fullness, capped at 100.
- Plays a short eating animation.
- May gradually restore health if the cat was hungry.

Overfeeding:
- Feeding while nearly full adds to an overfeeding counter.
- One excessive meal should not immediately cause sickness.
- Repeated excessive feeding causes the cat to become visibly fatter.
- Severe overfeeding makes it lethargic, sick, and unhappy.
- While sick, mood decreases faster.
- Recovery requires time without excessive feeding.

Possible cat messages:

> *nom nom nom*

> Not hungry, but okay...

> That was probably too much.

> The cat is becoming suspiciously spherical.

Avoid turning feeding into a trivial button-spamming strategy.

---

## 6.4 PLAY — timing mini-game

Button: `PLAY`

The player enters a simple reaction mini-game within the Cat screen.

Display a horizontal track:

```text
┌───────────────────────────┐
│───────████────────🐁──────│
└───────────────────────────┘

         [ CATCH! ]
```

- A small pixel-art mouse moves repeatedly across the track.
- A highlighted target zone occupies a random portion of it.
- The player must press `CATCH!` while the mouse is inside the target.
- Every attempt randomizes the target position and width.
- Each play session contains three attempts.
- Difficulty can increase modestly as the game progresses.

Use responsive, touch-friendly timing.

Suggested target widths: 15–30% of the track.

Vary mouse speed, but keep the game fair on mobile devices.

Scoring:
- Successful hit: significant mood improvement.
- Near miss: little or no improvement.
- Miss: no improvement.
- Three successful hits should produce roughly +20–36 total mood.
- Cap mood at 100.

Each attempt should trigger a short cat animation.

Examples:
- Cat pounces successfully.
- Mouse escapes.
- Cat rolls over.
- Cat gets distracted by its own tail.

The mini-game should take approximately 10–20 seconds.

**Important:** This activity deliberately requires focused human attention. Do not introduce automated cat-care upgrades.

---

## 6.5 PET

Button: `PET`

Effect:
- A small improvement in mood (+3–5).
- Plays a short petting/purring animation.
- Has a cooldown of approximately 60 seconds of active gameplay.

Repeated clicking during cooldown should animate the cat without producing further mood gains.

Petting is supplementary, not a replacement for playing.

---

# 7. Attention-Seeking Behavior

When the cat's mood deteriorates, its behavior changes.

### Mood 70–100

Normal behavior.

The cat explores the game world, naps, or plays with technological objects.

### Mood 40–69

The cat occasionally approaches the programmer and demands attention.

Short animations:
- Meowing.
- Sitting on the keyboard.
- Watching the programmer.
- Following cursor movements.

### Mood 20–39

The cat begins appearing as a **foreground sprite overlapping the interface**.

It may:
- Sit on an upgrade card.
- Cover part of the main button.
- Walk across the UI.
- Obscure a resource counter.

### Mood 0–19

The cat becomes significantly more intrusive.

It occasionally appears as a large animated pixel-art cat covering a substantial portion of the screen.

It can sit on the primary action button, blocking clicks until the player interacts with it.

Tapping the intrusive cat opens the Cat screen.

These interruptions should be inconvenient and slightly absurd, without making the game permanently unusable.

The header Cat button and navigation controls must always remain accessible.

### Critical visual distinction

The cat has two presentation modes:

**World sprite:** Physically located in the abstract game world. Scales down as the camera zooms out.

**Attention-seeking overlay:** Temporarily displayed at a readable foreground size, regardless of the current world zoom.

This allows a cat that has become almost invisible in the automated infrastructure to suddenly occupy half the player's screen.

---

# 8. Death

Cat death is permanent within a playthrough.

Death results from prolonged starvation and consequent depletion of health.

Do not kill the cat merely because its mood is low.

Overfeeding can cause sickness, but ordinary overfeeding should remain recoverable.

### Death event

When the cat dies:

1. Its animations stop.
2. The cat disappears permanently from the main world.
3. Its header icon changes to a deceased-cat icon.
4. Both miniature status bars become empty and gray.
5. `FEED`, `PLAY`, and `PET` become permanently unavailable.
6. The event is recorded in History.

The main game continues normally.

Only one understated log message is needed:

> The cat is gone.

Avoid dramatic alerts, screen-filling death animations, or explicit moral lectures.

### Cat screen after death

Replace the entire interactive Cat screen with a minimal memorial.

Show **two happy pixel-art photographs**:

- The cat sleeping on the keyboard beside the programmer.
- The cat happily sitting on the programmer's lap.

These photographs can be styled as slightly faded Polaroids.

No status bars.

No interaction buttons.

No replacement cat.

No resurrection.

No opportunity to undo the event within the current playthrough.

Keep the memorial understated.

The emotional contrast with the game's accelerating technological triumph should carry the effect.

---

# 9. Narrative Significance of the Cat

The cat represents an obligation whose value cannot be expressed through the game's productivity metrics.

Its fate should influence endings.

Examples:

**Cat alive, automated company successful:**

> Your company operates without human intervention.
>
> You are no longer required.
>
> Somewhere inside the system, a small orange pixel is still moving.

**Cat dead, automated company successful:**

> You've automated every meaningful responsibility.
>
> Your company is worth $2 billion.
>
> You finally have time for yourself.
>
> The cat's bed is empty.

**Player abandons the automation race to finish the original project:**

> You shipped the app.
>
> It has three users.
>
> The cat is asleep on your keyboard.
>
> You are happy.

Do not make cat survival a universal requirement for winning. The game should support multiple interpretations of success.

---

# 10. Endings

Implement branching endings determined by gameplay statistics and decisions.

Include at least 10, ideally using the following concepts:

1. Fully Automated Bankruptcy.
2. The Greenest Pipeline.
3. The Great Merge Conflict.
4. Acquired by Yourself.
5. The Perfect SaaS.
6. Enterprise Transformation.
7. The Last Programmer.
8. Three Users.
9. The Forgotten Project.
10. The Infinite Weekend.
11. You Have Been Optimized.
12. The Human Approval API.
13. Alignment Achieved.
14. Recursive Succession.
15. The Closed Loop.
16. The Last Real Message.
17. Just Three Buttons — secret ending.

Cat survival or death should modify appropriate endings.

The player should be able to discover different endings through subsequent playthroughs.

---

# 11. Persistence and Technical Requirements

Implement as a lightweight browser game suitable for mobile.

Prefer the existing project's framework if there is one.

Otherwise, use:
- TypeScript.
- React for UI.
- HTML Canvas or PixiJS for the animated pixel-art world.
- CSS for responsive layout and light/dark themes.
- LocalStorage or IndexedDB for persistence.

No backend should be required.

### State management

Keep the simulation independent from rendering.

Use data-driven definitions for:
- Technologies.
- Upgrades.
- Resource production.
- Events.
- Achievements.
- Cat behavior.
- Endings.

Persist:
- Current game state.
- Unlocked technologies.
- Completed milestones.
- Achievements.
- Cat state and death.
- Discovered endings.
- User preferences.

Support restarting a new playthrough while retaining previously discovered endings in History.

### Rendering

- Maintain one persistent world coordinate system.
- Implement camera zoom independently from UI layout.
- Keep the programmer's original room at a stable world position.
- Add new subsystem graphics around existing content.
- Use smooth camera transitions between major milestones.
- Render world-space and foreground cat sprites independently.
- Preserve crisp pixel-art rendering at all scales where feasible.
- Avoid visual clutter and excessive animation that obscures gameplay.

### Cat simulation

Use an explicitly modeled state machine for:
- Normal.
- Hungry.
- Lonely.
- Attention-seeking.
- Overfed.
- Sick.
- Critical.
- Dead.

States may overlap where appropriate.

Do not derive the cat's condition solely from animations.

Use active-play time rather than unrestricted wall-clock time for needs decay.

The cat's death must be persistent and irreversible during that playthrough.

---

# 12. Acceptance Criteria

The implementation is complete when:

**Core game**
- A player can complete a full progression in approximately 30 minutes.
- The game begins with a programmer, a cat, and a simple coding action.
- Technologies unlock progressively without revealing future stages.
- Each new technology has a distinctive illustrated unlock event.
- Automation progressively changes the primary player action.
- The main world zooms out through abstract technological subsystems.
- The original programmer becomes increasingly insignificant.
- Both light and dark themes work throughout.

**Interface**
- Exactly three screens: Game, History, Cat.
- The main game fits a portrait mobile viewport.
- No permanent technology ladder or extra navigation.
- The header Cat button has **two miniature bars immediately beneath it, each no wider than the button**.
- No large cat indicators on the main screen.
- History only reveals past milestones and achievements.

**Cat**
- The cat is visibly animated and moves through the game world.
- Health, mood, and fullness are simulated.
- `FEED` produces randomized satiety gains.
- Repeated overfeeding causes visible obesity and sickness.
- `PLAY` runs the three-attempt timing mini-game with randomized target zones.
- `PET` gives a small cooldown-limited mood benefit.
- Low mood causes increasingly disruptive cat sprite overlays.
- Severe starvation eventually kills the cat.
- The cat cannot die while the game is inactive.
- Death permanently removes the cat and replaces its screen with two happy photographs.
- The cat becomes progressively smaller with world zoom and eventually disappears visually, even when alive.

**Narrative**
- Technology descriptions and events maintain a humorous, increasingly ominous tone.
- Cat care does not increase software productivity.
- The cat's fate can influence endings.
- At least 10 different endings are reachable.
- The player can restart and discover alternative endings.

---

## 13. Design Constraints — Do Not Violate

1. **Keep the interface extremely simple.** Universal Paperclips is the primary UX reference.
2. **No visible future progression.** Discovery is part of the game.
3. **One persistent game screen.** History and Cat are the only secondary views.
4. **The world represents technological abstraction**, not geographical expansion.
5. **Each technological advancement zooms the camera out**, making the original human progressively smaller.
6. **The cat's world-space size decreases with the zoom.**
7. **The two cat status bars are tiny, directly under its header button, and exactly constrained by its width.** Their subtlety is deliberate.
8. **Caring for the cat must require attention and time.** Never provide an automatic cat feeder, AI pet sitter, or other upgrade that eliminates this responsibility.
9. **Cat neglect has permanent consequences.** No resurrection or automatic reset.
10. **Avoid excessive tutorials, notifications, and UI guidance.** Let players discover mechanics through observation.
11. **Don't turn the cat into a productivity modifier.** Its importance is narrative and emotional.
12. **Maintain the tragicomic tone.** Technological progress should feel simultaneously impressive, ridiculous, and increasingly unsettling.

### The intended final experience

The player begins by clicking a button to write code.

Thirty minutes later, an immense automated system is building software, managing agents, optimizing its own infrastructure, and running companies without assistance.

The original programmer is no longer visible.

Perhaps the cat is still alive, wandering somewhere among the millions of autonomous processes.

Perhaps the player was too busy optimizing to notice that it died.

**The system runs perfectly either way.**
