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

## Working safely

Inspect `git status` before edits. Stage only task files. Do not revert unrelated changes.
