# Task: Implement the VIBE CODER Generative Music Engine & Music Lab

> Product clarification: Settings must contain a sound on/off switch and a Music submenu. Settings → Music → Music Lab must also be available in the normal production build. The later “developer-only” wording describes the workbench's purpose and no longer requires excluding it from production. The workbench remains a separate entry from the three incremental-game views; reviews and imported compositions stay local unless explicitly exported.

## Context

We are developing **VIBE CODER**, a 30-minute, mobile-first, retro pixel-art incremental game inspired by Universal Paperclips.

The game follows a programmer's gradual progression from autocomplete to coding agents, multi-agent orchestration, custom harnesses, self-improving systems, and ultimately autonomous companies.

The atmosphere evolves from cheerful technological optimism to dark, existential cyberpunk tragicomedy.

We need a **procedural chiptune soundtrack system** that evolves alongside the game's technological progression.

The soundtrack will be composed of short musical patterns, dynamically assembled into continuous music using **Tone.js**.

Music will be composed separately by LLM agents, reviewed by a human, and stored as structured data.

**Your task is to implement the complete music engine, composition infrastructure, and developer-facing Music Lab. Do not generate the full soundtrack yet.**

---

## 1. Architecture

Use:

- **Tone.js** for audio synthesis, scheduling, and playback.
- **Tonal.js** for music theory, scales, chords, intervals, and harmonic validation.
- **TypeScript** for the music engine and associated tools.
- **JSON** for compositions, patterns, instrument configurations, and musical era definitions.
- **@tonejs/midi** if useful for MIDI import/export.

Inspect the existing repository and integrate with its architecture and framework. Avoid introducing unnecessary dependencies or replacing existing infrastructure.

The system must run entirely client-side, with no backend or external music service required during gameplay.

Keep music composition data independent of playback implementation.

Architecture:

```text
                        GAME
                          │
                  Technology Events
                          │
                          ▼
                    Music Director
                          │
              ┌───────────┴───────────┐
              │                       │
         Current Era             Arrangement
              │                       │
        Pattern Selector          Synth Presets
              │                       │
              └───────────┬───────────┘
                          │
                    Pattern Player
                          │
                       Tone.js
                          │
                     Web Audio
```

Development workflow:

```text
                   COMPOSER AGENTS
                          │
                   JSON Patterns
                          │
                    Validation
                          │
                      Music Lab
                          │
                   Human Review
                          │
                   JSON Feedback
                          │
                   Composer Agents
                          │
                   Approved Music
                          │
                      GAME
```

---

## 2. Music Design

The game contains six musical eras:

| Era | Style | Mood | Harmonic direction |
|---|---|---|---|
| Discovery | Orchestral-inspired NES chiptune | Cheerful, adventurous | Major |
| Acceleration | Energetic chiptune | Excitement, optimism | Major / Mixolydian |
| Orchestration | Mechanical, layered chiptune | Intense, obsessive | Dorian |
| Recursion | Dark synth-chiptune | Anxiety, complexity | Minor |
| Self-Improvement | Industrial cyberpunk | Ominous, unstable | Minor / chromatic |
| Singularity | Minimalist cyberpunk | Cold, existential | Phrygian / ambiguous |

These eras must be configurable as data rather than hardcoded into the playback engine.

### Musical continuity

All eras will eventually share one recognizable melodic motif, transformed through changes in harmony, rhythm, register, arrangement, and instrumentation.

This motif will be created and approved separately.

Each era will ultimately contain approximately **10 interchangeable four-bar patterns**.

Default musical settings:

- 120 BPM.
- 4/4 time signature.
- 16 steps per bar.
- 64 steps per pattern.
- Four-bar pattern duration: 8 seconds.

These values should be configurable.

Patterns within an era should be designed for seamless random sequencing.

Do not assume that arbitrary patterns in the same key are automatically compatible.

---

## 3. Pattern Data Model

Design a validated, versioned JSON schema for musical patterns.

Each pattern should include:

```typescript
interface MusicPattern {
  id: string;
  era: string;

  bars: number;
  bpm?: number;

  key: string;
  harmony: string[];

  energy: number;

  tracks: Record<string, NoteEvent[]>;

  metadata?: {
    description?: string;
    composer?: string;
    version?: number;
  };
}

interface NoteEvent {
  step: number;
  pitch: string;
  length: number;
  velocity?: number;
}
```

Adapt this schema as necessary, particularly for percussion events, rests, articulation, and instrument-specific parameters.

Requirements:

- Use musical steps rather than milliseconds.
- Support multiple independent instrument tracks.
- Support configurable instrument assignments.
- Support monophonic and polyphonic instruments where appropriate.
- Keep musical patterns independent of synthesizer implementation.
- Support future MIDI import/export.
- Allow patterns to carry harmonic entry/exit metadata for transition compatibility.

Create a formal runtime validator and corresponding TypeScript types.

---

## 4. Chiptune Synthesizer

Implement a small, configurable collection of retro-inspired synthesizers using Tone.js.

At minimum:

| Instrument | Character |
|---|---|
| Pulse lead | Classic NES-style melody |
| Triangle bass | Soft 8-bit bass |
| Arpeggio synth | Fast electronic arpeggios |
| Noise percussion | Retro drums and effects |

Support instrument presets that can change between musical eras.

The system should allow later eras to introduce more sophisticated sounds, including:

- Different pulse widths.
- Additional voices.
- FM-like synthesis.
- Distortion.
- Detuning.
- Filtering.
- Mechanical percussion.
- Drones and minimal ambient textures.

Avoid overengineering. Implement a compact set of reusable instrument definitions.

The goal is convincing retro-game music, not necessarily cycle-accurate hardware emulation.

Provide master volume and mute controls.

Persist audio preferences.

---

## 5. Pattern Player

Implement reliable, continuous playback of structured patterns.

Requirements:

1. Use Tone.js musical scheduling, not `setTimeout`-driven note playback.
2. Maintain accurate timing across pattern boundaries.
3. Support multiple synchronized tracks.
4. Prevent audible clicks, timing gaps, and unintended overlapping notes.
5. Properly handle note durations, rests, and instrument releases.
6. Support starting, stopping, pausing, and resuming.
7. Handle browser audio-context restrictions.
8. Pause or appropriately suspend playback when the game becomes inactive.
9. Properly dispose of audio nodes and scheduled events.

The player must support uninterrupted playback over an entire 30-minute session.

### Pattern selection

Implement a **shuffle-bag selector**:

- Randomly shuffle available approved patterns.
- Play each once before reshuffling.
- Avoid immediate repetition across shuffle-bag boundaries.
- Support optional selection weights.
- Allow deterministic seeded randomness for testing.

Keep the selection algorithm separate from the audio engine.

### Transitions

Patterns must transition at musical boundaries.

Implement:

- Same-era pattern transitions.
- Cross-era transitions.
- Optional transition stingers.
- Configurable fade or release handling where needed.
- Preservation of the musical clock during era changes.

When a new technological milestone changes the musical era, finish the current phrase before switching.

Do not abruptly interrupt the music.

---

## 6. Music Director

Implement a higher-level controller that connects the soundtrack to the game's progression.

Suggested API:

```typescript
musicDirector.start();
musicDirector.stop();
musicDirector.pause();
musicDirector.resume();

musicDirector.setEra("recursion");
musicDirector.setArrangement("meta-harness");

musicDirector.setVolume(0.5);
musicDirector.setMuted(true);
```

Adapt naming to the project's conventions.

### Responsibilities

The Music Director should manage two independent dimensions:

**Composition**
- Current musical era.
- Available patterns.
- Pattern selection.
- Harmonic transitions.

**Arrangement**
- Active instruments.
- Instrument presets.
- Musical density.
- Additional musical layers.
- Effects and timbral evolution.

Technology milestones may modify the arrangement without changing the era.

For example:

- First coding agent: introduce bass.
- Parallel agents: introduce arpeggios.
- Agent manager: add rhythmic complexity.
- Custom harness: add mechanical sequencing.
- Meta-harness: introduce dissonant layers.
- Self-improvement: introduce darker timbres.
- Autonomous company: progressively simplify the music.

Implement this mapping declaratively so it can be adjusted later.

The exact musical parameters will be refined after listening tests.

### Cat integration

The game also contains a Tamagotchi-like cat.

The music system must allow occasional cat-related sound effects.

However:

- Do not use music to warn the player about decreasing cat health or mood.
- Do not automatically change the soundtrack when the cat dies.
- The soundtrack should continue uninterrupted after cat death.

This is an intentional narrative decision.

---

# 7. Music Lab — Developer Workbench

**This is a major deliverable.**

Create a developer-only page, preferably `/music-lab`, for composing, previewing, reviewing, and managing musical patterns.

This page is not part of the game's three-screen navigation.

Reuse the game's existing UI stack where practical.

It should be functional on desktop and reasonably usable on mobile.

### Main interface

```text
┌──────────────────────────────────────┐
│ MUSIC LAB                            │
├──────────────────────────────────────┤
│                                      │
│ Era: [ Discovery              ▼ ]    │
│ BPM: 120                             │
│                                      │
│ PATTERNS                             │
│                                      │
│ 01  ▶  ★★★★★   APPROVED             │
│ 02  ▶  ★★★☆☆   REVISE               │
│ 03  ▶  ★★☆☆☆   REJECTED             │
│ 04  ▶  ☆☆☆☆☆   UNREVIEWED           │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ ▶ PLAY SINGLE                        │
│ ▶ PLAY RANDOM SEQUENCE               │
│ ▶ TEST TRANSITIONS                   │
│ ▶ PREVIEW EVOLUTION                   │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ Selected: Discovery / 02             │
│                                      │
│ Rating: ★★★☆☆                       │
│                                      │
│ Feedback:                            │
│ ┌──────────────────────────────────┐ │
│ │ Good rhythm, weak bass line.     │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [APPROVE] [REVISE] [REJECT]          │
│                                      │
│ [COPY FEEDBACK PROMPT]               │
│ [EXPORT REVIEWS]                     │
│                                      │
└──────────────────────────────────────┘
```

### Playback modes

Implement four modes.

**1. Single Pattern**

Play one selected pattern.

Allow looping it and switching between patterns.

**2. Random Sequence**

Play approved patterns from the selected era using the actual runtime shuffle-bag algorithm.

Allow continuous playback for several minutes.

Display the currently playing pattern.

**3. Transition Testing**

Test transitions between selected patterns.

Support both intra-era and cross-era transitions.

Allow deliberately testing problematic pattern pairs.

**4. Evolution Preview**

Play a compressed musical journey through all six eras.

Target duration: approximately 1–2 minutes.

Automatically advance through eras, exercising instrument and arrangement changes.

This is essential for verifying that the soundtrack feels like one composition evolving from cheerful chiptune into ominous cyberpunk.

---

## 8. Human Review Workflow

The workbench must support:

- Rating each pattern from 1 to 5.
- Marking patterns `unreviewed`, `approved`, `revise`, or `rejected`.
- Writing free-text feedback.
- Preserving reviews across browser reloads.
- Exporting and importing reviews as JSON.
- Filtering patterns by status.
- Playing only approved patterns.
- Comparing revised versions against earlier versions.

Do not implement a backend just for feedback persistence.

Browser storage plus JSON import/export is sufficient for the first version.

### Composer feedback generation

Implement a **COPY FEEDBACK PROMPT** button.

It should produce a structured, ready-to-use prompt for an LLM composer agent.

Include:

- Current musical era.
- Shared motif and composition guidelines.
- Era-specific constraints.
- Approved patterns and their metadata.
- Rejected or revision-requested patterns.
- Ratings and human feedback.
- Instructions to preserve approved material.
- Instructions to regenerate or improve only the requested patterns.
- The required output schema.
- Validation requirements.

The generated prompt should be self-contained enough to provide to a new agent without relying on conversation history.

Also support exporting the same information as a Markdown file.

The goal is to support this development loop:

**Agents compose → Human listens → Human rates → Feedback exported → Agents revise → Human approves.**

---

# 9. Pattern Validation Tools

Implement a CLI validator for generated patterns.

It should check:

**Structural validity**
- JSON schema compliance.
- Valid note names.
- Valid step positions.
- Positive note durations.
- Events within pattern boundaries.
- Supported instrument tracks.

**Musical validity**
- Instrument pitch ranges.
- Polyphony limits.
- Conflicting note events.
- Rhythmic consistency.
- Harmonic compatibility with the declared progression.
- Phrase boundary compatibility.

**Diversity**
- Detect exact or near-duplicate patterns.
- Report similarity between variations.
- Compare rhythmic density and pitch distributions.

Separate hard errors from musical warnings.

For example, an intentional chromatic passing tone should not fail validation merely because it is outside the current chord.

A musical validator cannot reliably determine whether a pattern sounds good. Human review remains authoritative.

Provide commands similar to:

```bash
npm run music:validate
npm run music:validate -- --era discovery
```

Follow the repository's existing package-management conventions.

---

# 10. Composer Agent Infrastructure

Prepare the repository for subsequent parallel composition by LLM subagents.

Create a clear directory structure, such as:

```text
music/
├── README.md
├── COMPOSITION_GUIDE.md
├── PATTERN_SCHEMA.json
│
├── motif/
│   └── main.json
│
├── eras/
│   ├── discovery.json
│   ├── acceleration.json
│   ├── orchestration.json
│   ├── recursion.json
│   ├── self-improvement.json
│   └── singularity.json
│
├── patterns/
│   ├── discovery/
│   ├── acceleration/
│   ├── orchestration/
│   ├── recursion/
│   ├── self-improvement/
│   └── singularity/
│
├── reviews/
│
└── composer-prompts/
    ├── lead-composer.md
    └── era-composer.md
```

The exact locations should follow existing project conventions.

### Lead composer instructions

Create a reusable prompt template for a future Lead Composer agent.

Its responsibilities will be:

1. Generate several candidate main motifs.
2. Define the musical identity of the game.
3. Define six related harmonic transformations.
4. Define instrument and arrangement guidelines for every era.
5. Produce a small number of reference patterns.
6. Ensure musical continuity across all eras.

**Do not execute the full lead-composer assignment yet.**

### Era composer instructions

Create a reusable prompt template for six future parallel composer agents.

Each agent will:

1. Receive the approved main motif.
2. Receive the shared composition guide.
3. Receive its assigned era definition.
4. Generate approximately 10 interchangeable four-bar patterns.
5. Validate them.
6. Correct technical failures.
7. Save them to its own era directory.
8. Avoid modifying patterns belonging to other eras.

The instructions should support independent execution in separate Git worktrees.

Provide a convenient way to generate a complete agent prompt for a selected era.

---

# 11. Initial Demo Content

Do not attempt to generate all 60 final soundtrack patterns.

Instead, create enough musical content to verify the engine and production workflow.

Implement:

- Two playable patterns for **Discovery**.
- Two playable patterns for **Singularity**.
- One simple recognizable motif shared between them.
- Appropriate instrument presets for both eras.
- A working transition between them.

The example patterns should demonstrate the intended relationship between cheerful major-key chiptune and ominous minor/cyberpunk music.

These are **temporary demo compositions**, intended to verify the infrastructure.

Do not treat them as approved final soundtrack material.

Ensure the application works immediately after installation, without requiring external files or API credentials.

---

# 12. Licensing and Reproducibility

The game will be released as open source.

Expected licensing:

- Game code: Apache-2.0.
- Music and compositions: CC BY 4.0 or CC0.
- Third-party dependencies: retain their respective licenses.

All music patterns must be stored in editable, human-readable formats.

Do not depend on proprietary audio-generation APIs at runtime.

Do not include copyrighted music samples, copied melodies, or third-party musical material without appropriate licensing.

The music creation workflow should be reproducible using open-source tools and LLM-generated structured notation.

---

# 13. Testing

Implement automated tests for:

- Pattern schema validation.
- Note timing calculations.
- Pattern boundary handling.
- Shuffle-bag behavior.
- Prevention of immediate repetition.
- Deterministic random selection.
- Era switching.
- Correct scheduling of arrangement changes.
- Handling of missing or invalid patterns.
- Playback start/stop lifecycle.
- Resource disposal.
- Review storage, import, and export.
- Feedback prompt generation.

Where appropriate, use a mockable scheduling layer so that timing logic can be tested without actual audio playback.

Also provide a manual testing checklist covering:

- Continuous playback for at least 10 minutes.
- No audible gaps at pattern boundaries.
- No stuck notes.
- No clipping under normal playback conditions.
- Correct behavior after browser tab suspension.
- Correct playback after navigation between Game and Music Lab.
- Functional audio controls on mobile browsers.
- Smooth transitions between musical eras.

---

# 14. Deliverables

The completed implementation must include:

1. A functional Tone.js chiptune synthesizer.
2. A JSON-based musical pattern system.
3. A continuous pattern player with shuffle-bag selection.
4. A Music Director integrated with game progression.
5. Configurable musical eras and arrangements.
6. A working developer-only Music Lab.
7. Human ratings, approvals, rejection, and revision feedback.
8. JSON review import/export.
9. A feedback-to-composer-prompt generator.
10. Automated pattern validation.
11. Lead Composer and Era Composer prompt templates.
12. Four playable demo patterns spanning two contrasting eras.
13. Automated tests and basic documentation.

Document how to:

- Start Music Lab.
- Create or import a pattern.
- Listen to patterns.
- Approve or reject compositions.
- Export feedback for a composer agent.
- Run validation.
- Add a new musical era.
- Connect a game technology milestone to an arrangement change.

---

## 15. Acceptance Criteria

The task is complete when I can:

1. Start the project and open `/music-lab`.
2. Hear convincing retro 8-bit music generated entirely through Tone.js.
3. Select and play individual demo patterns.
4. Start continuous random playback without audible gaps.
5. Switch between cheerful Discovery and ominous Singularity.
6. Hear the same recognizable motif transformed between the two eras.
7. Preview the soundtrack's stylistic evolution.
8. Rate patterns and write feedback.
9. Export reviews and generate a ready-to-use composer-agent prompt.
10. Add new musical patterns by creating JSON files, without modifying the audio engine.
11. Run automated validation against generated patterns.
12. Follow the documentation to launch independent composer agents for different eras.

**The system must be ready for the subsequent composition phase, but the final 60-pattern soundtrack is explicitly outside the scope of this task.**

---

## 16. Implementation Principles

- Prefer simple, maintainable solutions over complex abstractions.
- Keep musical content separate from synthesizer logic.
- Make eras, instruments, and arrangements data-driven.
- Use Tone.js scheduling for all musically timed events.
- Avoid introducing a second game engine or audio framework.
- Reuse existing project infrastructure.
- Keep the runtime lightweight and entirely client-side.
- Keep Music Lab separate from the player-facing game UI.
- Validate generated music automatically, but preserve human creative judgment.
- Ensure future composer agents can work independently without editing core engine code.
- Prioritize a working end-to-end music production workflow over sophisticated but unneeded features.

**The ultimate goal is a musical production pipeline in which LLM agents compose structured chiptune patterns, automated tools validate them, a human curator evaluates them in Music Lab, and the game dynamically assembles the approved material into an evolving, continuous soundtrack.**
