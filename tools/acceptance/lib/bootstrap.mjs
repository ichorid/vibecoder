import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.mjs';

export const BOOTSTRAP_MARKER = 'bootstrap-gate';

/**
 * @param {string} relativePath from repository root
 */
export function repoFile(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

/**
 * @param {string} relativePath
 */
export function fileExists(relativePath) {
  return fs.existsSync(repoFile(relativePath));
}

/**
 * @param {string} relativePath
 */
export function readText(relativePath) {
  return fs.readFileSync(repoFile(relativePath), 'utf8');
}

/**
 * @returns {{ ready: boolean, missing: string[], packageJson: object|null }}
 */
export function bootstrapInventory() {
  const requiredPaths = [
    'package.json',
    'index.html',
    'vite.config.ts',
    'svelte.config.js',
    'src/main.ts',
    'src/app/App.svelte',
    '.gitignore',
    'AGENTS.md',
  ];

  const missing = requiredPaths.filter((p) => !fileExists(p));

  const lockCandidates = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
  const hasLock = lockCandidates.some((p) => fileExists(p));
  if (!hasLock) missing.push('lockfile (package-lock.json or equivalent)');

  const nodeVersionFile = ['.nvmrc', '.node-version'].find((p) => fileExists(p));
  if (!nodeVersionFile) missing.push('.nvmrc or .node-version');

  let packageJson = null;
  if (fileExists('package.json')) {
    packageJson = JSON.parse(readText('package.json'));
  }

  return {
    ready: missing.length === 0,
    missing,
    packageJson,
    nodeVersionFile: nodeVersionFile ?? null,
    hasLock,
  };
}

/**
 * Minimal toolchain present so behavior checks may run (not necessarily green).
 */
export function behaviorRunnerReady() {
  const inv = bootstrapInventory();
  if (!inv.ready || !inv.packageJson) return { ready: false, reason: BOOTSTRAP_MARKER };

  const scripts = inv.packageJson.scripts ?? {};
  const deps = { ...inv.packageJson.dependencies, ...inv.packageJson.devDependencies };
  const needs = ['eslint', 'typescript', 'vitest'];
  const missingDeps = needs.filter((name) => !deps[name]);
  if (missingDeps.length > 0) {
    return { ready: false, reason: `${BOOTSTRAP_MARKER}: devDependencies ${missingDeps.join(', ')}` };
  }

  const needsScripts = ['lint', 'check:types', 'test:rules'];
  const missingScripts = needsScripts.filter((s) => !scripts[s]);
  if (missingScripts.length > 0) {
    return { ready: false, reason: `${BOOTSTRAP_MARKER}: scripts ${missingScripts.join(', ')}` };
  }

  if (!fileExists('eslint.config.js') && !fileExists('eslint.config.mjs')) {
    return { ready: false, reason: `${BOOTSTRAP_MARKER}: eslint.config.js` };
  }

  return { ready: true, reason: null };
}

/**
 * @param {import('node:test').TestContext} t
 * @param {{ ready: boolean, reason: string|null }} gate
 */
/**
 * @returns {boolean} false when the test was skipped
 */
export function skipUnlessBehaviorRunner(t, gate) {
  if (!gate.ready) {
    t.skip(gate.reason ?? BOOTSTRAP_MARKER);
    return false;
  }
  return true;
}
