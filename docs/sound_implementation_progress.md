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

## S03 — Music Director and four temporary demos

Status: **done** (headless; human listening of the motif/transition still pending)

- S03.1 `src/music/{director,library}.ts`, `tests/music/director.test.ts`, `tests/music/helpers/fakeBackend.ts` (Tone-like lookahead fake: commit 48 ticks before the start, audible at the start). RED 9/9 vs stubs. GREEN: start once; era and arrangement are separate request dimensions applied only at phrase boundaries; last request wins; pause updates the desired state without moving the clock; `stop` is the only reset. Library = per-era banks of normalized versions under a candidate policy (`approved` exact keys / `demo` / `all`); invalid versions are never playable. Empty bank: era policy keep-current (labelled `fallback`) or silence (a silent phrase keeps the clock); Lab-only `demoFallback` labels the true source era. Mutation check: disabling request replacement fails 5 tests; dropping the fallback label fails 1.
- S03.2 transitions. **Finding (journal F9):** Tone `Draw` never fires offline and depends on animation frames, so the port gained `onCommit` (audio clock) which now drives scheduling; `onAudible` is UI only. The "request after commit" test was tightened to "only the uncommitted phrase after the boundary is replaced". Tempo is a phrase property applied by the backend at the start tick (`bpm.setValueAtTime`), never by a transport reset. Optional stinger via director `transitions` (validated library pattern; occupies its own ticks; a missing one is skipped). Real Tone offline render (`tests/browser/music-transition.spec.ts`): 120→100 BPM exactly at the boundary, ticks monotonic, sound continues.
- S03.3 `music/patterns/{discovery,singularity}/*-demo-{a,b}.v1.json` (generated once by a scratch script, then committed as data), `tests/music/demoPatterns.test.ts` (RED 3/6 before the data). C major I–vi–IV–V / I–IV–V–I and C Phrygian i–bII–VI–i / i–bvii–bII–i, motif 3-5-6-5 (E-G-A-G, Eb-G-Ab-G), differing in register/rhythm/density; `demo:true`, CC0, motif `demo-main@1`, nothing approved. `music:validate`: 4 patterns, 0 errors, 12 warnings (intended neighbour/passing tones). `DEFAULT_BOUNDARY_RULES` (tonic→tonic, dominant→tonic): both banks compatible in every order.
- S03.4 `src/music/previewTimeline.ts`, `tests/music/previewTimeline.test.ts`: six eras × 2 phrases = 96 s; acceleration/orchestration show `demo-fallback` from Discovery and recursion/self-improvement from Singularity; BPM change recomputes the duration from ticks; a driver requests the next stage on each audio-clock commit (director `onCommit`), then ends in silence. Approved mode with no approvals stays silent (never inherits the fallback). Real Tone render of the whole timeline (`music-evolution.spec.ts`): all 12 phrases audible, peak < 1, silence after a ≤1.5 s release.

Exit: `test:music` 84/84, `test:music-browser` 12/12, `test:game` 332/332, `test:browser` 30/30, `npm run check` OK, build within budgets (Tone still outside game chunks).
Not verified (needs a person): listening to the motif and the Discovery→Singularity transition. Next: S04 (Music Lab).

## S04 — Music Lab in the main build

Status: **done** (headless Chromium desktop/390 px; no human listening, no real phone)

- S04.1 `music-lab/index.html`, `src/music-lab/{main.ts,App.svelte,sources.ts,labController.ts,components/}`, Vite multi-page `build.rollupOptions.input` (game + Lab) and `build.manifest`. `tools/reportSize.ts` now walks the manifest from `index.html` (static + dynamic imports, skipping the lazy audio loader) and **fails the build** if the game page can reach any `music-lab`/`reviewStore` module or if `dist/music-lab/index.html` is missing. Game initial JS 230 KiB gzip; Lab page 78 KiB; Tone loader chunk 83 KiB loads only on PLAY. Production Lab sources: eras/presets/arrangements/motif + `*-demo-*` patterns only (dev serves the full corpus); the published approved pack joins in S06. `npm run dev:music-lab`.
- Director gained `setLibrary` (one director per Lab document serves all modes; applies at the next replaceable boundary) and `tempoOverride` (audition-only BPM in the plan; the file is untouched). RED 2/2 first.
- `labController.ts` (RED 9/9 vs a stub): Single loops the pinned version, a selection applies on the boundary, the audible key is reported only through the backend's audible notification; hard-invalid versions list their errors and never load audio; Random is approved-only (honestly 0 before reviews) with an explicit demo toggle and a visible demo label (5 simulated minutes, no immediate repeats, no NEXT); Transition alternates A/B via the director's commit hook and warns ("Lab audition only") about disallowed boundaries or clock mismatches; Evolution uses the S03 timeline driver, shows fallback stages, stops on the first silent boundary after the last stage; any mode switch stops the old schedule (0 fake entries). Volume shares `vibecoder.audio.v1`. Two test mistakes corrected (a selection before the commit point does replace the next phrase; Random correctly refuses to play with no approvals).
- Browser: `tests/browser/lab.spec.ts` (production preview, 6 tests): game page fetches no Lab/Tone/pattern chunk; opening the Lab creates no game save and no audio; Single/Random/Transition/Evolution play through Tone in Chromium; 390 px has no horizontal overflow in any mode; keyboard can reach PLAY; volume survives mode switches. `tests/browser/music-lab-dev.spec.ts` (dev server) lists the four demos. Screenshots reviewed at 1100 and 390 px (fixed an invisible badge colour).

Exit: `test:music` 95/95, `test:music-browser` 13/13, `test:browser` 36/36, `test:game` 332/332, `npm run check` OK, build within budgets.
Not verified: real listening; mobile Safari/Android audio unlock. Settings link already points to `/music-lab/`; the Game→Lab handoff (save/pause) is S07. Next: S05 (reviews).

## S05 — human review, versions and JSON exchange

Status: **done** (headless Chromium; no real reviewer session yet)

- S05.1 `src/music/core/canonical.ts` (pure: sorted-key canonical JSON; review payload = pattern minus `metadata` + era + motif + era default arrangement + presets of the roles the pattern actually uses — rules documented in the file header), `src/music/hash.ts` (SHA-256 via Web Crypto; no fallback hash outside a secure origin — `HashUnavailableError`). `tests/music/contentHash.test.ts` RED 3/5 (2 "unchanged" cases passed trivially against constant stubs; after GREEN, mutations "hash all presets" and "keep metadata" each fail them). Browser↔Node parity: `tests/browser/music-hash.spec.ts` (Chromium Web Crypto = node:crypto over the same canonical bytes).
- S05.2 `src/music-lab/reviews.ts` (pure book of frozen records keyed `id@rev#hash`; rating 1–5 optional; approve refused for hard-invalid payloads; stale = decision for another payload of the same id@rev; `approvedKeys` only for matching hashes), `src/music-lab/reviewStore.ts` (key `vibecoder.music-reviews.v1`; drafts persisted; unreadable data reported and **locked** until an explicit reset; quota errors keep the in-memory decision). `tests/music/reviews.test.ts` RED (all) → 11/11.
- S05.3 one envelope decoder (`decodeReviewEnvelope`: 2 MiB limit before parsing, Ajv review schema per record) for file/clipboard/CLI; `mergeImport` idempotent for identical decisions, explicit `conflicts` otherwise (no timestamp wins); `resolveConflict` keep-local/use-import. Feedback rendered as text (browser test checks no markup).
- S05.4 Lab: SHA-256 per entry (async `ready()`), review panel (rating, feedback draft, APPROVE/REVISE/REJECT, stale notice), status filter (view only), A/B = Transition mode with any two versions. Random approved bank = exact current approvals, swapped in through `director.setLibrary` at the next replaceable boundary. `tests/music/labReviews.test.ts` (written after the implementation, 8/8 first run; mutations "ignore hash in approvedKeys" and "don't refresh the playing bank" each fail a test).
- S05.5 `src/music-lab/candidates.ts`: local candidate import (single object or array; 2 MiB file / 256 KiB pattern limits; structural + catalog checks; same id@rev with different music → conflict against installed or local versions; identical → idempotent), key `vibecoder.music-candidates.v1`, quota-safe; export of any version as editable JSON; remove. `tests/music/candidates.test.ts` RED → 5/5. Production preview `tests/browser/lab-review.spec.ts`: import → play → rate/feedback/approve → reload → approved Random bank → export reviews; conflicting/broken imports leave the 4 installed versions; game save untouched.

Exit: `test:music` 124/124, `test:music-browser` 14/14, `test:browser` 38/38, `test:game` 332/332, `npm run check` OK, build within budgets (Lab page 85 KiB gzip; game unchanged).
Next: S06 (CLI similarity/buildPack/prompt formatter, composer templates, README/COMPOSITION_GUIDE, licenses).
