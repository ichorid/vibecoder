import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import layerImports from './layer-imports.js';
import noAmbientGameTime from './no-ambient-game-time.js';
import noRawContentInUi from './no-raw-content-in-ui.js';
import ownedScheduling from './owned-scheduling.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturesRoot = path.join(repoRoot, 'tools/acceptance/fixtures/eslint');

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parser: tsParser,
  },
});

function readFixture(...parts: string[]): string {
  return fs.readFileSync(path.join(fixturesRoot, ...parts), 'utf8');
}

function fixturePath(...parts: string[]): string {
  return path.join(fixturesRoot, ...parts);
}

test('local eslint rules match acceptance fixtures', () => {
  tester.run('vibe/layer-imports', layerImports, {
    valid: [
      {
        code: readFixture('layer-imports/valid-game-internal.ts'),
        filename: fixturePath('layer-imports/valid-game-internal.ts'),
      },
      {
        code: readFixture('layer-imports/valid-content-type-only.ts'),
        filename: fixturePath('layer-imports/valid-content-type-only.ts'),
      },
      {
        code: readFixture('layer-imports/valid-demo-internal.ts'),
        filename: fixturePath('layer-imports/valid-demo-internal.ts'),
      },
    ],
    invalid: [
      {
        code: readFixture('layer-imports/invalid-game-pixi.ts'),
        filename: fixturePath('layer-imports/invalid-game-pixi.ts'),
        errors: [{ message: /pixi/i }],
      },
      {
        code: readFixture('layer-imports/invalid-demo-imports-game.ts'),
        filename: fixturePath('layer-imports/invalid-demo-imports-game.ts'),
        errors: [{ message: /demo\/ is a pure engine/ }],
      },
    ],
  });

  tester.run('vibe/no-ambient-game-time', noAmbientGameTime, {
    valid: [
      {
        code: readFixture('ambient-time/valid-game-explicit-args.ts'),
        filename: fixturePath('ambient-time/valid-game-explicit-args.ts'),
      },
    ],
    invalid: [
      {
        code: readFixture('ambient-time/invalid-game-date-now.ts'),
        filename: fixturePath('ambient-time/invalid-game-date-now.ts'),
        errors: [{ message: /time|Date|forbidden|ambient/i }],
      },
      {
        code: readFixture('ambient-time/invalid-demo-math-random.ts'),
        filename: fixturePath('ambient-time/invalid-demo-math-random.ts'),
        errors: [{ message: /random/i }],
      },
    ],
  });

  tester.run('vibe/no-raw-content-in-ui', noRawContentInUi, {
    valid: [
      {
        code: readFixture('raw-content-ui/valid-ui-read-model.ts'),
        filename: fixturePath('raw-content-ui/valid-ui-read-model.ts'),
      },
    ],
    invalid: [
      {
        code: readFixture('raw-content-ui/invalid-ui-manifest-reexport.ts'),
        filename: fixturePath('raw-content-ui/invalid-ui-manifest-reexport.ts'),
        errors: [{ message: /manifest|catalog|forbidden|raw/i }],
      },
    ],
  });

  tester.run('vibe/owned-scheduling', ownedScheduling, {
    valid: [
      {
        code: readFixture('owned-scheduling/valid-runtime-interval.ts'),
        filename: fixturePath('owned-scheduling/valid-runtime-interval.ts'),
      },
    ],
    invalid: [
      {
        code: readFixture('owned-scheduling/invalid-ui-needs-interval.ts'),
        filename: fixturePath('owned-scheduling/invalid-ui-needs-interval.ts'),
        errors: [{ message: /schedul|interval|runtime|forbidden/i }],
      },
    ],
  });
});
