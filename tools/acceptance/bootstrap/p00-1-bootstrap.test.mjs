import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapInventory,
  fileExists,
  readText,
  BOOTSTRAP_MARKER,
} from '../lib/bootstrap.mjs';
import { npmRun } from '../lib/exec.mjs';
import { requirementById } from '../requirements.mjs';

function tag(id) {
  const req = requirementById(id);
  return `[${req.id}] ${req.summary}`;
}

describe(`P00.1 bootstrap (${BOOTSTRAP_MARKER})`, () => {
  it(tag('P00.1-01'), () => {
    const inv = bootstrapInventory();
    assert.ok(fileExists('package.json'), 'package.json missing');
    assert.ok(inv.packageJson, 'package.json unreadable');
    const deps = { ...inv.packageJson.dependencies, ...inv.packageJson.devDependencies };
    assert.ok(deps.svelte, 'svelte dependency required');
    assert.ok(deps.vite || deps['@sveltejs/vite-plugin-svelte'], 'vite toolchain required');
  });

  it(tag('P00.1-02'), () => {
    const inv = bootstrapInventory();
    assert.ok(inv.hasLock, 'lockfile required for npm ci');
  });

  it(tag('P00.1-03'), () => {
    const inv = bootstrapInventory();
    assert.ok(inv.nodeVersionFile, '.nvmrc or .node-version required');
  });

  it(tag('P00.1-04'), () => {
    assert.ok(fileExists('vite.config.ts'), 'vite.config.ts');
    assert.ok(fileExists('svelte.config.js'), 'svelte.config.js');
    assert.ok(fileExists('src/main.ts'), 'src/main.ts');
    const pkg = bootstrapInventory().packageJson;
    assert.ok(pkg, 'package.json');
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.equal(allDeps['@sveltejs/kit'], undefined, 'SvelteKit must not be used');
  });

  it(tag('P00.1-05'), () => {
    assert.ok(fileExists('index.html'), 'index.html');
    const html = readText('index.html');
    assert.match(html, /VIBE\s*CODER/i, 'root shell should show VIBE CODER');
  });

  it(tag('P00.1-06'), () => {
    const inv = bootstrapInventory();
    assert.ok(inv.packageJson);
    const deps = { ...inv.packageJson.dependencies, ...inv.packageJson.devDependencies };
    const pixi = deps['pixi.js'];
    assert.ok(pixi, 'pixi.js 8.x dependency');
    assert.match(String(pixi), /^[\^~]?8\./, 'PixiJS major 8');
    assert.equal(deps.gsap, undefined);
    assert.equal(deps['pixi-viewport'], undefined);
  });

  it(tag('P00.1-07'), () => {
    const inv = bootstrapInventory();
    assert.ok(inv.packageJson);
    const deps = { ...inv.packageJson.dependencies, ...inv.packageJson.devDependencies };
    assert.ok(deps.vitest, 'vitest');
    assert.ok(deps.eslint, 'eslint for RuleTester');
  });

  it(tag('P00.1-08'), () => {
    assert.ok(fileExists('AGENTS.md'), 'AGENTS.md');
    const text = readText('AGENTS.md');
    assert.ok(text.length < 8000, 'AGENTS.md should stay short');
    assert.match(text, /implementation_plan|architecture/i, 'links to design docs');
    assert.match(text, /TDD|RED|GREEN/i, 'TDD rule mentioned');
  });

  it(tag('P00.1-10'), () => {
    const inv = bootstrapInventory();
    assert.deepEqual(inv.missing, [], `missing scaffold: ${inv.missing.join(', ')}`);
    assert.ok(fileExists('src/app/App.svelte'), 'App.svelte');
  });

  it(tag('P00.1-09'), { timeout: 120_000 }, () => {
    const inv = bootstrapInventory();
    if (!inv.ready) {
      assert.fail(`bootstrap incomplete: ${inv.missing.join(', ')}`);
    }
    const build = npmRun('build');
    assert.equal(
      build.status,
      0,
      `npm run build failed\nstdout:${build.stdout}\nstderr:${build.stderr}`,
    );
  });
});
