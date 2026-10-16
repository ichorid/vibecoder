import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES_ROOT } from '../lib/paths.mjs';

const REQUIRED_FIXTURES = [
  'types/invalid-command-union.ts',
  'types/game-uses-document.ts',
  'types/valid-game-run-status.ts',
  'svelte/ValidTypedProps.svelte',
  'eslint/layer-imports/invalid-ui-alias-reexport.ts',
  'eslint/layer-imports/valid-content-type-only.ts',
  'eslint/ambient-time/invalid-game-crypto.ts',
  'eslint/owned-scheduling/valid-runtime-interval.ts',
  'eslint/raw-content-ui/invalid-ui-manifest-reexport.ts',
];

describe('P00 acceptance fixture catalog', () => {
  it('ships TS/Svelte/ESLint fixtures for post-bootstrap verification', () => {
    for (const rel of REQUIRED_FIXTURES) {
      assert.ok(fs.existsSync(path.join(FIXTURES_ROOT, rel)), rel);
    }
  });
});
