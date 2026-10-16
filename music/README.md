# VIBE CODER music

Short chiptune **patterns** (JSON) are validated, reviewed by a human in the **Music Lab**, and
published as a **pack** the game plays. Code: `src/music/` (engine), `src/music-lab/` (Lab),
`tools/music/` (CLI). Design: `docs/sound_architecture.md`. How to write patterns:
[`COMPOSITION_GUIDE.md`](COMPOSITION_GUIDE.md). Licensing: [`LICENSE.md`](LICENSE.md).

## Layout

| Path                                   | Contents                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `PATTERN_SCHEMA.json`, `schemas/`      | JSON Schemas (pattern, era, preset, arrangement, motif, review)                   |
| `eras/`                                | six eras: clock, key/modes, default arrangement, empty-bank policy, demo fallback |
| `presets/`, `arrangements/`            | bounded instrument presets; role → preset mixes per era                           |
| `motif/`                               | the shared motif (currently a temporary demo)                                     |
| `patterns/<era>/<id>.v<revision>.json` | compositions; a change is a new revision file                                     |
| `reviews/`                             | review files exported from the Lab (input to the pack)                            |
| `composer-prompts/`                    | lead/era composer templates for `music:prompt`                                    |

## Workflow

```sh
npm ci                                   # install (lockfile)
npm run music:validate                   # schema + theory + bank similarity (exit 1 on errors)
npm run music:validate -- --era discovery
npm run dev:music-lab                    # Lab with the full repository corpus
npm run test:music                       # engine/tool tests
```

1. **Listen** — `npm run dev:music-lab`, or Settings → Music → Music Lab in the game (`/music-lab/`).
   Single loops one version; Random plays a bank through the game's shuffle-bag (approved only,
   or with the explicit demo toggle); Transition alternates A/B at phrase boundaries; Evolution
   plays the six eras in ~96 s and labels demo fallbacks.
2. **Import candidates** — Import / export → _Import pattern JSON_ (production Lab: stored only
   in this browser; an existing id@revision with different music is a conflict).
3. **Review** — rate 1–5, write feedback, APPROVE / REVISE / REJECT. A decision binds to the exact
   content hash; any change to the music (or to the era/motif/presets it uses) makes it stale.
4. **Export** — _Export reviews_ → save into `music/reviews/`; _Export JSON_ on a candidate → put it
   into `patterns/<era>/`.
5. **Publish** — `npm run music:pack -- --mode approved` (add `--choose id@rev` if two revisions
   of one ID are approved); commit `src/music/data/pack.approved.json`. `npm run check` fails if
   a committed pack is out of date. The demo pack: `npm run music:pack -- --mode demo`.
6. **Feedback to a composer** — _COPY FEEDBACK PROMPT_ in the Lab, or
   `npm run music:prompt -- --era <id> [--template era|lead] [--out task.md]`.

## Adding an era

1. Add `eras/<id>.json` (copy an existing one; pick `clockGroup`, key, `emptyBankPolicy`, and a
   `demoFallbackEra` for Lab previews) and at least one `arrangements/<id>-base.json`.
2. Add the era to the evolution timeline (`src/music/previewTimeline.ts`) and, for the game, to
   the technology binding (`music/binding.json`).
3. `npm run music:types && npm run music:validate && npm run test:music`.

## Technology → era (game binding)

The game sends only unlocked technology IDs to the music director; the last matching rule wins.

| Unlocked technology  | Era              |
| -------------------- | ---------------- |
| (start)              | discovery        |
| `terminal-agent`     | acceleration     |
| `parallel-agents`    | orchestration    |
| `custom-harness`     | recursion        |
| `self-improvement`   | self-improvement |
| `autonomous-company` | singularity      |

The cat's health, mood or death never changes the music.
