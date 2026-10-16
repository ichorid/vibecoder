# VIBE CODER — agent map

Handoff journal: [docs/agent_journal.md](docs/agent_journal.md). Design sources: [docs/initial_design.md](docs/initial_design.md), [docs/architecture.md](docs/architecture.md), [docs/implementation_plan.md](docs/implementation_plan.md).

## Boundaries

- `src/game/` and `src/content/` are pure TypeScript (no DOM, Node, Pixi, Svelte).
- `src/ui/` — Svelte views and read models only.
- `src/world/` — Pixi presentation.
- `src/app/` — composition, runtime clock, dispatch wiring.
- `src/persistence/` — save adapter only.

## Commands

| Command                 | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `npm ci`                | Reproducible install (lockfile)         |
| `npm run dev`           | Vite dev server                         |
| `npm run build`         | Production bundle                       |
| `npm run check`         | Types, lint, format, custom rules       |
| `npm run check:types`   | `svelte-check` + pure game `tsc`        |
| `npm run lint`          | ESLint (zero warnings)                  |
| `npm run test:rules`    | Local ESLint rule fixtures              |
| `npm run test:game`     | Vitest: rules, scenarios, components    |
| `npm run test:browser`  | Playwright vs production preview        |
| `npm run check:content` | Catalog, assets, art up to date         |
| `npm run art:export`    | Regenerate `public/assets/` from `art/` |

## TDD

Follow [implementation_plan.md](docs/implementation_plan.md) §2: one behavior RED → minimal GREEN → refactor. Do not weaken acceptance tests.

## Authored vs generated

- **Authored:** `src/`, `tools/eslint-rules/`, `tools/type-fixtures/`, configs.
- **Generated:** `dist/`, `node_modules/`, `public/assets/` (from `art/` via `npm run art:export`; never edit).

## Versioning (SemVer)

`package.json` `version` is the single source of the game version; the page title and the header
show it (`src/app/version.ts`, `vite.config.ts`). Never hard-code it elsewhere. The save
`schemaVersion` is a separate number and does not follow the game version.

Bump **once per release**, in the commit that goes to `release` (pushing `release` deploys GitHub
Pages), at the highest level any change since the last `v*` tag needs:

| Bump  | While 0.x (now)                                                                        | From 1.0.0                                                                  |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| MAJOR | never — going to 1.0.0 is the owner's decision                                         | an existing save no longer loads, or a shipped feature/ending is removed    |
| MINOR | new features, content, eras, endings, balance; save schema bumps; anything that breaks | new features, content, eras, endings, balance; save schema bumps (migrated) |
| PATCH | fixes, art/text/sound polish, performance, refactors with no player-visible change     | same                                                                        |

Docs, tests, CI and tooling alone need no bump and no release. To release:

1. `git log --oneline $(git describe --tags --abbrev=0)..HEAD` — what is unreleased; pick the level.
2. `npm version <patch|minor|major> --no-git-tag-version` — updates `package.json` and
   `package-lock.json` together (never edit the version by hand).
3. Commit both as `Release vX.Y.Z` (body: one line per player-visible change), then
   `git tag -a vX.Y.Z -m vX.Y.Z`.
4. `git push origin main vX.Y.Z && git push origin main:release` (fast-forward only).

Never move, reuse or delete a pushed tag, and never lower the version.

## Working safely

Inspect `git status` before edits. Stage only task files. Do not revert unrelated changes.
