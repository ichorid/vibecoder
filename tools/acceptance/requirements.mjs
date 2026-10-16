/**
 * P00 requirement registry — each entry is linked from acceptance tests via reqId().
 */

/** @typedef {{ id: string, area: 'P00.1'|'P00.2'|'P00.3'|'P00.4', summary: string, kind: 'bootstrap'|'behavior' }} Requirement */

/** @type {Requirement[]} */
export const REQUIREMENTS = [
  // P00.1 bootstrap
  { id: 'P00.1-01', area: 'P00.1', kind: 'bootstrap', summary: 'package.json with reproducible dependency pins' },
  { id: 'P00.1-02', area: 'P00.1', kind: 'bootstrap', summary: 'lockfile committed for npm ci' },
  { id: 'P00.1-03', area: 'P00.1', kind: 'bootstrap', summary: 'Node major recorded (.nvmrc or equivalent)' },
  { id: 'P00.1-04', area: 'P00.1', kind: 'bootstrap', summary: 'Vite + Svelte 5 app shell (no SvelteKit)' },
  { id: 'P00.1-05', area: 'P00.1', kind: 'bootstrap', summary: 'index.html shows VIBE CODER branding' },
  { id: 'P00.1-06', area: 'P00.1', kind: 'bootstrap', summary: 'PixiJS 8 declared; GSAP/pixi-viewport absent' },
  { id: 'P00.1-07', area: 'P00.1', kind: 'bootstrap', summary: 'Vitest and ESLint RuleTester wired for later fixtures' },
  { id: 'P00.1-08', area: 'P00.1', kind: 'bootstrap', summary: 'AGENTS.md short project map with TDD and commands' },
  { id: 'P00.1-09', area: 'P00.1', kind: 'bootstrap', summary: 'npm run build succeeds after npm ci' },
  { id: 'P00.1-10', area: 'P00.1', kind: 'bootstrap', summary: 'Core scaffold files exist (vite, svelte config, main, App)' },

  // P00.2 strict TS and linters
  { id: 'P00.2-01', area: 'P00.2', kind: 'bootstrap', summary: 'tsconfig base + tsconfig.game.json without DOM/Node ambient types' },
  { id: 'P00.2-02', area: 'P00.2', kind: 'bootstrap', summary: 'eslint.config.js flat config + prettier integration' },
  { id: 'P00.2-03', area: 'P00.2', kind: 'bootstrap', summary: 'scripts: check:types, lint, format:check, check, build' },
  { id: 'P00.2-04', area: 'P00.2', kind: 'bootstrap', summary: 'src/game/types.ts declares RunStatus domain contract' },
  { id: 'P00.2-05', area: 'P00.2', kind: 'behavior', summary: 'invalid command union fails typecheck in isolated fixture' },
  { id: 'P00.2-06', area: 'P00.2', kind: 'behavior', summary: 'document access in pure game fixture fails typecheck' },
  { id: 'P00.2-07', area: 'P00.2', kind: 'behavior', summary: 'any, non-null assertion, floating promise, @ts-ignore rejected' },
  { id: 'P00.2-08', area: 'P00.2', kind: 'behavior', summary: 'strict compiler options enabled per architecture §11' },
  { id: 'P00.2-09', area: 'P00.2', kind: 'behavior', summary: 'valid Svelte component with typed props passes svelte-check' },
  { id: 'P00.2-10', area: 'P00.2', kind: 'behavior', summary: 'npm run lint reports zero warnings on authored sources' },

  // P00.3 import boundaries
  { id: 'P00.3-01', area: 'P00.3', kind: 'bootstrap', summary: 'tools/eslint-rules/layer-imports rule module exists' },
  { id: 'P00.3-02', area: 'P00.3', kind: 'bootstrap', summary: 'npm run test:rules executes local rule fixtures' },
  { id: 'P00.3-03', area: 'P00.3', kind: 'behavior', summary: 'game/ cannot import Pixi, Svelte, or persistence adapter' },
  { id: 'P00.3-04', area: 'P00.3', kind: 'behavior', summary: 'ui/ cannot import game/commands or raw game internals' },
  { id: 'P00.3-05', area: 'P00.3', kind: 'behavior', summary: 'forbidden import via alias, re-export, or static import() is caught' },
  { id: 'P00.3-06', area: 'P00.3', kind: 'behavior', summary: 'content/ type-only import from game contract is allowed' },

  // P00.4 time, RNG, scheduling
  { id: 'P00.4-01', area: 'P00.4', kind: 'bootstrap', summary: 'custom rules: no-ambient-game-time, no-raw-content-in-ui, owned-scheduling' },
  { id: 'P00.4-02', area: 'P00.4', kind: 'behavior', summary: 'game/content reject Date, performance, Math.random, crypto, timers' },
  { id: 'P00.4-03', area: 'P00.4', kind: 'behavior', summary: 'ui cannot create gameplay interval/timeout for needs' },
  { id: 'P00.4-04', area: 'P00.4', kind: 'behavior', summary: 'ui cannot import content manifest via re-export barrel' },
  { id: 'P00.4-05', area: 'P00.4', kind: 'behavior', summary: 'valid: seed in app, runtime owns gameplay timer, renderer presentation ticker' },
  { id: 'P00.4-06', area: 'P00.4', kind: 'behavior', summary: 'valid: ui reads projection only; no raw catalog in views' },
];

/** @param {string} id */
export function requirementById(id) {
  const req = REQUIREMENTS.find((r) => r.id === id);
  if (!req) throw new Error(`Unknown requirement id: ${id}`);
  return req;
}
