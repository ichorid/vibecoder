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
