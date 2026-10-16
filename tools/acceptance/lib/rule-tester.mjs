import path from 'node:path';
import { createRequire } from 'node:module';
import { REPO_ROOT } from './paths.mjs';
import { fileExists } from './bootstrap.mjs';

const require = createRequire(import.meta.url);

/**
 * @returns {{ ready: boolean, reason?: string, RuleTester?: typeof import('eslint').RuleTester, Linter?: typeof import('eslint').Linter }}
 */
export function loadRuleTester() {
  if (!fileExists('package.json')) {
    return { ready: false, reason: 'bootstrap-gate: package.json' };
  }
  try {
    const { RuleTester } = require('eslint');
    return { ready: true, RuleTester };
  } catch {
    return { ready: false, reason: 'bootstrap-gate: eslint not installed' };
  }
}

/**
 * @param {string} ruleModuleRel e.g. tools/eslint-rules/layer-imports.js
 */
export function loadLocalRule(ruleModuleRel) {
  const candidates = [
    ruleModuleRel,
    ruleModuleRel.replace(/\.js$/, '.mjs'),
    ruleModuleRel.replace(/\.js$/, '.ts'),
  ];
  for (const rel of candidates) {
    if (!fileExists(rel)) continue;
    const abs = path.join(REPO_ROOT, rel);
    try {
      const mod = require(abs);
      const rule = mod.default ?? mod.rule ?? mod;
      const ruleId = rule.meta?.name ?? path.basename(rel, path.extname(rel));
      return { ready: true, rule, ruleId: `vibe/${ruleId.replace(/^layer-imports.*/, 'layer-imports')}` };
    } catch (err) {
      return { ready: false, reason: `rule load failed: ${rel}: ${err.message}` };
    }
  }
  return { ready: false, reason: `bootstrap-gate: missing ${ruleModuleRel}` };
}

/**
 * @param {import('eslint').RuleTester} RuleTester
 * @param {string} ruleId
 * @param {import('eslint').Rule.RuleModule} rule
 * @param {{ valid: import('eslint').RuleTester.ValidTestCase[], invalid: import('eslint').RuleTester.InvalidTestCase[] }} cases
 * @param {import('eslint').Linter.Config} [config]
 */
export function runRuleFixtures(RuleTester, ruleId, rule, cases, config = {}) {
  let parser;
  try {
    parser = require('@typescript-eslint/parser');
  } catch {
    parser = undefined;
  }

  const tester = new RuleTester({
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ...(parser ? { parser } : {}),
      parserOptions: { ecmaFeatures: { jsx: false } },
    },
  });

  tester.run(ruleId, rule, {
    valid: cases.valid,
    invalid: cases.invalid,
  });
}
