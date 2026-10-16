# Agent journal (implementation log for handoff)

Purpose: concise notes for any agent continuing this build. Read this first, then
`docs/implementation_progress.md` (per-task RED/GREEN facts), then the phase file
of the next task. Keep entries short; newest progress at the bottom of each section.

## Standing decisions (deviations / interpretations of the plan)

- D1 (P00) Tooling from a previous agent was found complete but uncommitted; verified
  green (check, build, `node tools/acceptance/run.mjs` 37/37) and committed as P00.
- D2 (art) No human pixel artist available. Production art is authored as **text pixel
  maps / small procedural TS drawing scripts** under `art/` and exported by a node
  script to `public/assets/` PNG + atlas JSON (single export path, generated output).
  This satisfies "editable sources + export command, no proprietary editor".
  Visual quality still needs a human check (P11.2) — recorded as not verified.
- D3 (commits) One commit per phase (user instruction), not per task.

## Unexpected findings

- F1 The `rtk` hook rewrites `npm run lint` into a filtered command that lints the acceptance
  fixtures and reports bogus errors. Run checks as `rtk proxy npm run check` (exit code is truth).
- F2 P00 fixture `tools/acceptance/fixtures/types/invalid-command-union.ts` used
  `case 'primaryAction'` as the *invalid* variant; once P01 added that real command the fixture
  compiled cleanly. Changed the case to `'launchRockets'` (intent unchanged: invalid variant).

## Progress log

- 2026-10-16: P00 verified + committed. Next: P01.
- 2026-10-16: P01 done (RNG, createRun, runtime clock, step/commands, store, lifecycle).
  35 game tests. Snapshot currently `{ run }`; plan: add view models in P02.2 and keep UI
  off the raw run.
