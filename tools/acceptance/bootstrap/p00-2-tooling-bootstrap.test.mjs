import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileExists, readText, BOOTSTRAP_MARKER } from '../lib/bootstrap.mjs';
import { requirementById } from '../requirements.mjs';

function tag(id) {
  return `[${requirementById(id).id}] ${requirementById(id).summary}`;
}

describe(`P00.2 tooling bootstrap (${BOOTSTRAP_MARKER})`, () => {
  it(tag('P00.2-01'), () => {
    assert.ok(fileExists('tsconfig.json'), 'tsconfig.json');
    assert.ok(fileExists('tsconfig.game.json'), 'tsconfig.game.json');
    const game = JSON.parse(readText('tsconfig.game.json'));
    const types = game.compilerOptions?.types ?? [];
    const lib = game.compilerOptions?.lib ?? [];
    const combined = [...types, ...lib].join(' ');
    assert.doesNotMatch(combined, /dom/i, 'game tsconfig must not pull DOM lib/types');
    assert.doesNotMatch(combined, /node/i, 'game tsconfig must not pull Node ambient types');
  });

  it(tag('P00.2-02'), () => {
    assert.ok(fileExists('eslint.config.js') || fileExists('eslint.config.mjs'));
    const prettier =
      fileExists('.prettierrc') ||
      fileExists('.prettierrc.json') ||
      fileExists('prettier.config.js') ||
      fileExists('prettier.config.mjs');
    assert.ok(prettier, 'prettier config');
  });

  it(tag('P00.2-03'), () => {
    assert.ok(fileExists('package.json'));
    const pkg = JSON.parse(readText('package.json'));
    const scripts = pkg.scripts ?? {};
    for (const name of ['check:types', 'lint', 'format:check', 'check', 'build']) {
      assert.ok(scripts[name], `npm script ${name}`);
    }
  });

  it(tag('P00.2-04'), () => {
    assert.ok(fileExists('src/game/types.ts'), 'src/game/types.ts');
    const src = readText('src/game/types.ts');
    assert.match(src, /RunStatus/, 'RunStatus contract');
    assert.match(src, /playing.*ended|ended.*playing/, 'RunStatus literals');
  });
});
