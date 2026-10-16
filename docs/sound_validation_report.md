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
