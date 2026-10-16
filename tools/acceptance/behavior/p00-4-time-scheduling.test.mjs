import path from 'node:path';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorRunnerReady, skipUnlessBehaviorRunner, fileExists } from '../lib/bootstrap.mjs';
import { FIXTURES_ROOT } from '../lib/paths.mjs';
import { loadRuleTester, loadLocalRule, runRuleFixtures } from '../lib/rule-tester.mjs';
import { requirementById } from '../requirements.mjs';

function tag(id) {
  return `[${requirementById(id).id}] ${requirementById(id).summary}`;
}

const AMBIENT = 'tools/eslint-rules/no-ambient-game-time.js';
const RAW_UI = 'tools/eslint-rules/no-raw-content-in-ui.js';
const SCHED = 'tools/eslint-rules/owned-scheduling.js';

function readFixture(rel) {
  return fs.readFileSync(path.join(FIXTURES_ROOT, rel), 'utf8');
}

function rulePath(base) {
  return (
    fileExists(base) ||
    fileExists(base.replace('.js', '.mjs')) ||
    fileExists(base.replace('.js', '.ts'))
  );
}

describe('P00.4 time, RNG, scheduling', () => {
  const gate = behaviorRunnerReady();

  it(tag('P00.4-01'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    assert.ok(rulePath(AMBIENT), 'no-ambient-game-time rule');
    assert.ok(rulePath(RAW_UI), 'no-raw-content-in-ui rule');
    assert.ok(rulePath(SCHED), 'owned-scheduling rule');
  });

  it(tag('P00.4-02'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule(AMBIENT);
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    const invalidFixtures = [
      'invalid-game-date-now.ts',
      'invalid-content-new-date.ts',
      'invalid-game-math-random.ts',
      'invalid-game-crypto.ts',
      'invalid-content-performance.ts',
      'invalid-content-set-timeout.ts',
    ];

    runRuleFixtures(rt.RuleTester, 'vibe/no-ambient-game-time', rule.rule, {
      valid: [
        {
          code: readFixture('eslint/ambient-time/valid-game-explicit-args.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/ambient-time/valid-game-explicit-args.ts'),
        },
      ],
      invalid: invalidFixtures.map((name) => ({
        code: readFixture(`eslint/ambient-time/${name}`),
        filename: path.join(FIXTURES_ROOT, 'eslint/ambient-time', name),
        errors: [{ message: /time|random|Date|performance|timer|forbidden|ambient/i }],
      })),
    });
  });

  it(tag('P00.4-03'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule(SCHED);
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/owned-scheduling', rule.rule, {
      valid: [
        {
          code: readFixture('eslint/owned-scheduling/valid-runtime-interval.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/owned-scheduling/valid-runtime-interval.ts'),
        },
        {
          code: readFixture('eslint/owned-scheduling/valid-renderer-ticker.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/owned-scheduling/valid-renderer-ticker.ts'),
        },
      ],
      invalid: [
        {
          code: readFixture('eslint/owned-scheduling/invalid-ui-needs-interval.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/owned-scheduling/invalid-ui-needs-interval.ts'),
          errors: [{ message: /schedul|interval|timeout|runtime|forbidden/i }],
        },
      ],
    });
  });

  it(tag('P00.4-04'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule(RAW_UI);
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/no-raw-content-in-ui', rule.rule, {
      valid: [
        {
          code: readFixture('eslint/raw-content-ui/valid-ui-projection.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/raw-content-ui/valid-ui-projection.ts'),
        },
      ],
      invalid: [
        {
          code: readFixture('eslint/raw-content-ui/invalid-ui-manifest-reexport.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/raw-content-ui/invalid-ui-manifest-reexport.ts'),
          errors: [{ message: /content|manifest|catalog|forbidden|raw/i }],
        },
      ],
    });
  });

  it(tag('P00.4-05'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const ambient = loadLocalRule(AMBIENT);
    const sched = loadLocalRule(SCHED);
    if (!ambient.ready) {
      t.skip(ambient.reason);
      return;
    }
    if (!sched.ready) {
      t.skip(sched.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/no-ambient-game-time', ambient.rule, {
      valid: [
        {
          code: readFixture('eslint/ambient-time/valid-app-seed.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/ambient-time/valid-app-seed.ts'),
        },
      ],
      invalid: [],
    });
  });

  it(tag('P00.4-06'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const raw = loadLocalRule(RAW_UI);
    if (!raw.ready) {
      t.skip(raw.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/no-raw-content-in-ui', raw.rule, {
      valid: [
        {
          code: readFixture('eslint/raw-content-ui/valid-ui-read-model.ts'),
          filename: path.join(FIXTURES_ROOT, 'eslint/raw-content-ui/valid-ui-read-model.ts'),
        },
      ],
      invalid: [],
    });
  });
});
