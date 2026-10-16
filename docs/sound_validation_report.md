# Sound validation report (S08/S09)

Build: the S08 commit (parent `c142958`). Packages: tone 15.1.22, tonal 6.4.2, ajv 8.17.1.
Environment: Linux, headless Chromium 1228 (Playwright 1.61.1). **No human listener and no phone
were available.** Automated evidence (fake scheduler, offline renders, short live renders) is
listed separately from listening, which has **not** been done.

## Automated evidence

| Area | Evidence | Kind |
| --- | --- | --- |
| 30-minute schedule: exact boundaries, ≤ 2 phrases ahead, era/arrangement changes, pause/resume | `tests/music/long-session.test.ts` (225 phrases) | fake scheduler |
| 100 start/pause/stop + library switches leave nothing scheduled | `long-session.test.ts`, S02 lifecycle cycles | fake + offline |
| 2 minutes of real Tone playback: ≤ 3 phrases, ≤ 8 voices, scheduled events not growing, no clipping | `tests/browser/music-long.spec.ts` | offline render |
| Voice banks of presets unused for a whole phrase are released | `music-long.spec.ts` (realtime context) | live render |
| Interrupted / suspended context → "tap to resume"; the tap resumes without a second player | `audioController.test.ts`, `sound.spec.ts` (context `suspend()` as stand-in) | unit + browser |
| Late async load after dispose never revives audio | `audioController.test.ts` | unit |
| Import floods / oversized files refused before expensive work; unknown fields are schema errors | `tests/music/importLimits.test.ts`, `candidates.test.ts`, `reviews.test.ts` | unit |
| Quota failures keep stored data; clipboard refusal → Markdown file; conflicting import keeps the playing version | `reviews.test.ts`, `candidates.test.ts`, `lab-prompt.spec.ts`, `labReviews.test.ts` | unit + browser |
| Over-budget arrangement (voices + 1 SFX > 8) is a catalog error | `catalog.test.ts` | unit |
| Loudest legal mix (7 voices + care SFX, volume 1) peaks below the −1 dBFS limiter threshold | `music-backend.spec.ts` | offline render |
| First game screen loads no Tone/Lab; the Sound gesture adds 137 KiB gzip of audio JS (budget 250 KiB); demo JSON 22 KiB (budget 100 KiB) | `tools/reportSize.ts` (fails the build over budget), `lab.spec.ts`, `sound.spec.ts` | build + network |

## Findings fixed during S08

- Voice banks were never released during play (only on pause/stop): instruments grew with every
  preset used (6 after four era changes). Now freed at the next phrase boundary once neither the
  current nor the previous phrase uses them.
- Releasing inside an **offline** render erased every earlier note of that instrument, because
  Tone runs all transport callbacks before rendering audio. Release therefore happens only in
  realtime contexts; offline renders keep instruments (bounded by the preset catalog).
- An OS-interrupted context left the status at "playing". The controller now watches the
  context state (`statechange`) and asks for a tap; any later tap (not the Sound switch) resumes.

## Listening (S08.5) — not done

Required: ≥ 10 minutes of continuous listening (Random sequence, intra/cross-era transitions,
mute/resume, repeated modes) on a named device/browser, noting gaps, clicks, stuck notes,
clipping, tempo stability and repetitiveness. **Blocked**: no human listener in this session.
The fake 30-minute scheduler and offline renders do not replace it.

## Mobile audio (S08.2 device checklist) — not done

iOS Safari and Android Chrome: first unlock, screen lock with sound on, app switch, incoming
call, return to the game, mute in background. **Blocked**: no phone available.

## S09 — music workflow acceptance

Build: the S09 commit (parent `5de56ed`), after a clean `npm ci`. All gates green: `check`,
`test:rules` 3/3, `test:game` 377/377, `test:music` 174/174, `music:check-types`,
`music:validate` (4 patterns, 0 errors, 12 warnings), build within budgets,
`test:music-browser` 18/18, `test:browser` 61/61. No private API, credential, editor or backend
is needed.

### S09.1 production walkthrough (executed, headless)

`tests/browser/lab-workflow.spec.ts` runs the whole path in one continuous session on the
production preview: Settings → Sound on/off → Music → Music Lab (same run) → gesture unlock and
all four demos reported as sounding (> 20 notes handed to Web Audio) → Random demo sequence →
A→B Discovery/Singularity transition → Evolution (96 s, two Discovery and two Singularity
fallback labels) → import a new candidate → audition → 3★ + feedback → REVISE → REJECT →
APPROVE → reload (decision kept) → export reviews → import revision 2 (unreviewed) → re-import
reviews (idempotent) → A/B revision 1 vs 2 → COPY FEEDBACK PROMPT → back to the game: same run
ID, no catch-up. Observed defects: none in the product (one test-setup issue: a fresh game has no
save until a write is forced). Not done: hearing it.

### S09.2 author cycle without chat history

`tools/music/authorCycle.test.ts`: a new candidate file → `music:validate --era` CLI exit 0 →
content hash → exported review (a **test-only** approval, not a human decision) →
`buildPack` approved → played by the director from the pack. The Lab's prompt and
`music:prompt` CLI produce the same task text byte for byte (the CLI only prepends its
template) — **finding:** they differed in the embedded schema's whitespace; the formatter now
normalises the schema itself. `music/README.md` documents the lead → approved motif → parallel
era worktrees → coordinator integration → feedback rounds → publish workflow. No composer
assignment was run.

### S09.3 game integration

Headless (`src/app/musicRoute.test.ts`): the real binding through a 30-minute baseline run with
the demo pack — which bank sounded at each stage:

| Stage (unlock) | Status | Source bank |
| --- | --- | --- |
| Discovery (0.0 min) | playing | discovery |
| Acceleration (2.3 min) | fallback (keep-current) | discovery |
| Orchestration (10.9 min) | fallback | discovery |
| Recursion (22.6 min) | fallback | discovery |
| Self-Improvement (27.0 min) | fallback | discovery |
| Singularity (31.8 min) | playing (≤ 1 phrase after the unlock) | singularity |

The published *approved* pack is empty, so production plays nothing and says so. A neglected,
dead cat gives the same musical intents. **Blocked:** iPhone/Safari and Android/Chrome checks
(toggle, volume, first gesture, screen lock, app switch, headphones), late world + music on a
phone, the full 30-minute run listened to by a person.

### Acceptance matrix

| Requirement | Evidence | Status |
| --- | --- | --- |
| Formal JSON and TS match | `music:check-types` (generated types up to date, strict tsc) | passed |
| Hard errors separate from warnings | semantic/CLI fixtures, Lab diagnostics | passed |
| Exact ticks, continuous boundaries | planner tests, real renders (no gap at the seam) | passed (rendered); listening **blocked** |
| No-repeat / weights / seed | shuffle-bag tests, Lab Random 38-phrase run | passed |
| Era and arrangement independent | director before/after-commit tests, cross-era render | passed (rendered); listening **blocked** |
| Four convincing playable demos | four demos validate, render and play in the Lab | playable: passed; "convincing": **blocked** (human) |
| Four Lab modes | production `lab*.spec.ts`, 96 s Evolution | passed |
| Review / version / import / export | S05 tests + walkthrough | passed |
| Candidate JSON without engine change | production import + author cycle → pack → play | passed |
| Self-contained composer prompt | formatter tests, CLI = Lab text, generated era prompt read | passed |
| Future worktrees without engine change | templates/file scopes, README coordinator workflow | documented; not exercised |
| Settings sound / Music submenu / Lab in production | `sound.spec.ts`, `settings.spec.ts`, walkthrough | passed (headless) |
| No cat mood/death music reaction | binding comparative tests, full-run comparison | passed |
| Background and gesture | unit + synthetic browser cases | headless passed; iOS/Android **blocked** |
| No stuck notes / leaks / clipping | offline/live lifecycle, voice-bank release, loudest mix | rendered: passed; listening **blocked** |
| 30-minute robustness | fake 225-phrase schedule, full-run binding test | headless passed; 30-min mobile run **blocked** |
| Open-source reproducibility | clean `npm ci`, local JSON/tools, LICENSE, music/LICENSE.md, notices | passed |

**The music acceptance is not complete**: human listening (≥ 10 min), the artistic judgement of
the demos and every phone check remain blocked. The final ~60-pattern soundtrack is explicitly
deferred to the composition task described in `music/README.md`.
