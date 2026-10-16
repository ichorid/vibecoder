import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorRunnerReady, skipUnlessBehaviorRunner, readText, fileExists } from '../lib/bootstrap.mjs';
import { typecheckFixture } from '../lib/typecheck.mjs';
import { npmRun } from '../lib/exec.mjs';
import { requirementById } from '../requirements.mjs';

function tag(id) {
  return `[${requirementById(id).id}] ${requirementById(id).summary}`;
}

const STRICT_FLAGS = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
  'noFallthroughCasesInSwitch',
  'noUnusedLocals',
  'noUnusedParameters',
  'verbatimModuleSyntax',
];

describe('P00.2 TypeScript and lint behavior', () => {
  const gate = behaviorRunnerReady();

  it(tag('P00.2-08'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    assert.ok(fileExists('tsconfig.json'));
    const base = JSON.parse(readText('tsconfig.json'));
    const opts = base.compilerOptions ?? {};
    for (const flag of STRICT_FLAGS) {
      assert.equal(opts[flag], true, `compilerOptions.${flag} must be true`);
    }
  });

  it(tag('P00.2-05'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const result = typecheckFixture('invalid-command-union.ts', 'expectError');
    if (!result.ran) {
      t.skip(result.reason);
      return;
    }
    assert.ok(result.ok, `expected type error for invalid command union\n${result.output}`);
  });

  it(tag('P00.2-06'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const result = typecheckFixture('game-uses-document.ts', 'expectError');
    if (!result.ran) {
      t.skip(result.reason);
      return;
    }
    assert.ok(result.ok, `expected type error for document in game\n${result.output}`);
  });

  it(tag('P00.2-07'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const cases = [
      'lint-any.ts',
      'lint-non-null.ts',
      'lint-floating-promise.ts',
      'lint-ts-ignore.ts',
    ];
    for (const fixture of cases) {
      const eslint = npmRun('lint', ['--', `tools/acceptance/fixtures/types/${fixture}`]);
      assert.notEqual(
        eslint.status,
        0,
        `eslint should reject ${fixture}\n${eslint.stdout}\n${eslint.stderr}`,
      );
    }
  });

  it(tag('P00.2-10'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const lint = npmRun('lint');
    assert.equal(lint.status, 0, `lint must be zero warnings\n${lint.stdout}\n${lint.stderr}`);
    assert.doesNotMatch(`${lint.stdout}${lint.stderr}`, /warning/i);
  });

  it(tag('P00.2-09'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const types = npmRun('check:types');
    assert.equal(types.status, 0, `check:types should pass with valid Svelte\n${types.stdout}`);
  });
});
