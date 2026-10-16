# Sound implementation progress

Facts per task (ID, files, RED, GREEN, unverified). Plan: `docs/sound_implementation_plan.md`.

## S00 — schemas, validator, boundaries

Status: **done**

### S00.1 pattern schema and TS

Files: `music/PATTERN_SCHEMA.json` (draft 2020-12, no unknown fields, `$defs` for note/drum events), `src/music/core/schema.ts` (Ajv 8.17.1 `Ajv2020`), `src/music/data/patterns.generated.ts` (generated), `tools/music/generateTypes.ts`, `tests/music/schema.test.ts`, `vitest.music.config.ts`, `tsconfig.music.json`, scripts `test:music`, `music:types`, `music:check-types`.
Dependencies: tone 15.1.22, tonal 6.4.2, ajv 8.17.1, json-schema-to-typescript 15.0.4 (dev).
RED: 4/5 failed against an accept-all stub. GREEN: valid note+drum passes; wrong schemaVersion, unknown field, negative length, fractional step, pitch on a drum, velocity > 1 rejected with instance paths. `music:check-types` regenerates in memory (Prettier-formatted) and fails if stale, then type-checks the pure music core without DOM/Node types. Finding: the generator does not understand `prefixItems` — time signature became an explicit `{numerator, denominator}` object.

### S00.2 era, preset, arrangement, motif, review contracts

Files: `music/schemas/{era,preset,arrangement,motif,review}.schema.json`, `src/music/core/{catalog,review}.ts`, six eras (`music/eras/`), eleven presets of the four families, ten arrangements, `music/motif/demo-main.json` (status `demo`), `tests/music/{fixtures,catalog}.test.ts`.
RED: 9/10 failed against stubs. GREEN: unknown preset family, out-of-bounds envelope, invalid range pitch, polyphony > 4, unknown role/era/motif/preset/arrangement refs, CC BY without attribution, review-in-pattern, >1 024 events (before semantics), invalid review status/rating/hash all rejected.

### S00.3 semantics through Tonal and CLI

Files: `src/music/core/validation.ts`, `tests/music/semantics.test.ts`, `tools/music/{validate,validateLib,sources}.ts`, `validate.test.ts`, fixture corpora `tests/music/corpus/{ok,warn,bad}`.
RED: 7/9 failed against a stub. GREEN: unknown chord/mode, pitch outside the role preset range, monophonic overlap (touching allowed), event crossing the pattern end (ending exactly on it allowed), overlapping/gapped harmony are hard errors; velocity 0 is not a voice; non-chord and chromatic tones are warnings; normalization resolves era defaults. `npm run music:validate [-- --era id] [-- --root dir]` exits 1 only on errors; warnings printed separately; `--era` limits the corpus and rejects unknown eras. (CLI tests written after the CLI.)

### S00.4 audio import/scheduling lints

Files: `tools/eslint-rules/audio-boundaries.js`, `audio.rules.test.ts`, `owned-scheduling.js` (member-call timers), `eslint.config.js`.
RED: both new RuleTester suites failed against a no-op rule. GREEN: Tone only in `src/music/backend/`; music core uses no browser/storage globals and no backend/Svelte/game imports; game never imports music; ui/app never import the Lab or review store; `window.setTimeout`/`globalThis.setInterval` outside the owners are reported.

### Exit gate

`npm run check` (now incl. `music:check-types`, `music:validate`) OK; `test:music` 28/28; `test:rules` 3/3; `test:game` 332/332; build unchanged (no audio in the game bundle). Nothing sounds yet.
Next: S01.1.

## S01 — musical time, shuffle-bag, phrase plan

Status: **done**

- S01.1 `src/music/core/timing.ts`, `tests/music/timing.test.ts`. RED 4/5 against stubs. GREEN: PPQ 192, 4/4, 16 steps → 48 ticks/step, 3 072 ticks and 8 s per phrase; 3/4 and 6/8 counted in quarter notes; unrepresentable grids are errors (no rounding); note ending on the boundary allowed; tempo override policy (single audition / era boundary yes, bank only at equal tempo).
- S01.2 `src/music/core/{shuffleBag,random}.ts`, `shuffleBag.test.ts`. RED 5/5. GREEN: each candidate once per bag, no repeat across bag boundaries for ≥2 candidates (40 seeds), reproducible and JSON-serializable state, singleton repeats, empty → `unavailable`, candidate change rebuilds without removed versions. Music has its own mulberry32.
- S01.3 weights (already satisfied by the S01.2 weighted permutation — tests passed on first run), `src/music/core/compatibility.ts`, `weights.test.ts`. RED for compatibility 2/2. GREEN: weights order without duplicates (heavier first in 140+/200 seeds), weight 0 excluded, invalid weights ignored; bank check rejects clock mismatch and disallowed exit→entry pairs across all ordered pairs (rollover), even in the same key.
- S01.4 `src/music/core/phrasePlanner.ts`, `phrasePlanner.test.ts`. RED 4/4. GREEN: absolute ticks with a shared phrase start, disabled/unassigned/silent events dropped and counted, per-role polyphony and global cap 8, source untouched; 30-minute (225-phrase) fake schedule keeps exact boundaries with ≤2 live phrases. One test assumed event order and was corrected.

Exit: `test:music` 49/49; `npm run check` OK. Not yet: anything audible (S02).
Next: S02.1.

## S02 — Tone backend and lifecycle

Status: **done** (headless Chromium only; no listening, no mobile yet)

- S02.1 spike: Tone 15.1.22 — ticks notation `'<n>i'`, audio-time callback argument, `transport.clear`, `Tone.Offline` confirmed. **Finding:** importing Tone creates the global AudioContext immediately, so Tone is only ever loaded with `import()` after the player turns sound on (`src/music/backend/loader.ts`). `npm run test:music-browser` runs real-Tone specs against a dev-server fixture (`tests/music/browser/`, not in the production build).
- S02.2 `src/music/backend/instruments.ts`: pulse/triangle (Synth or bounded FMSynth), arp (PolySynth with preset polyphony), noise kit (Membrane/Noise synths), optional filter/distortion/detune from bounded presets; music and SFX buses → master gain → limiter. RED: every render failed at first with "cannot connect to an AudioNode belonging to a different audio context" — lazily created voices used Tone's global (online) context during offline rendering; fixed by constructing every node with the backend's captured context. Then: mute-before-start leaked a 20 ms ramp and velocity 0 sounded → instant level when stopped, zero-velocity events skipped. A 7-voice full-velocity mix peaked at 2.0 → fixed headroom on the music bus (0.28); the limiter is insurance only.
- S02.3 scheduling: absolute ticks, per-phrase IDs, commit flag set by the phrase-start callback, Draw notification at the audible start; sustained-support fixture shows no dip across the phrase seam.
- S02.4 pause/resume/stop/dispose: pause ramps to 0, pauses the transport and disposes the voice bank (queued notes cannot sound); resume re-attacks notes still in progress for their remaining ticks; stop clears and rewinds; 100 schedule/start/pause/resume/stop cycles leave 0 events/voices/instruments/phrases; dispose idempotent. Verified by offline renders (silent windows during pause, sound after resume, nothing after stop).
- S02.5 `src/music/{public,preferences}.ts`, `tests/music/audioController.test.ts` (RED 6/7 vs stubs), browser gesture test. States off/loading/needsGesture/playing/unavailable/error; rejected unlock → needsGesture (no unhandled rejection); a slow import that outlived user activation asks for another tap; volume and sound choice persisted under `vibecoder.audio.v1` (unlock not persisted); corrupt prefs → defaults, game save untouched; mute pauses scheduling. Browser: no AudioContext and no Tone request before the gesture; `running` after the click.

Exit: `test:music` 56/56, `test:music-browser` 10/10, `npm run check` OK, game build unchanged (Tone not in any game chunk yet).
Not verified: listening quality, mobile unlock. Next: S03.1.
