import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorRunnerReady, skipUnlessBehaviorRunner, fileExists } from '../lib/bootstrap.mjs';
import { FIXTURES_ROOT } from '../lib/paths.mjs';
import { loadRuleTester, loadLocalRule, runRuleFixtures } from '../lib/rule-tester.mjs';
import { npmRun } from '../lib/exec.mjs';
import { requirementById } from '../requirements.mjs';

function tag(id) {
  return `[${requirementById(id).id}] ${requirementById(id).summary}`;
}

const FIXTURE = (name) => path.join(FIXTURES_ROOT, 'eslint', 'layer-imports', name);

describe('P00.3 import boundaries', () => {
  const gate = behaviorRunnerReady();

  it(tag('P00.3-01'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const exists =
      fileExists('tools/eslint-rules/layer-imports.js') ||
      fileExists('tools/eslint-rules/layer-imports.mjs') ||
      fileExists('tools/eslint-rules/layer-imports.ts');
    assert.ok(exists, 'layer-imports rule module');
  });

  it(tag('P00.3-02'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const result = npmRun('test:rules');
    assert.equal(result.status, 0, `test:rules\n${result.stdout}\n${result.stderr}`);
  });

  it(tag('P00.3-03'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule('tools/eslint-rules/layer-imports.js');
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/layer-imports', rule.rule, {
      valid: [
        { code: readFixture('valid-game-internal.ts'), filename: FIXTURE('valid-game-internal.ts') },
      ],
      invalid: [
        {
          code: readFixture('invalid-game-pixi.ts'),
          filename: FIXTURE('invalid-game-pixi.ts'),
          errors: [{ message: /pixi|forbidden|not allowed|layer/i }],
        },
        {
          code: readFixture('invalid-game-svelte.ts'),
          filename: FIXTURE('invalid-game-svelte.ts'),
          errors: [{ message: /svelte|forbidden|not allowed|layer/i }],
        },
        {
          code: readFixture('invalid-game-persistence.ts'),
          filename: FIXTURE('invalid-game-persistence.ts'),
          errors: [{ message: /persistence|storage|forbidden|layer/i }],
        },
      ],
    });
  });

  it(tag('P00.3-04'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule('tools/eslint-rules/layer-imports.js');
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/layer-imports', rule.rule, {
      valid: [{ code: readFixture('valid-ui-projection.ts'), filename: FIXTURE('valid-ui-projection.ts') }],
      invalid: [
        {
          code: readFixture('invalid-ui-game-commands.ts'),
          filename: FIXTURE('invalid-ui-game-commands.ts'),
          errors: [{ message: /game|commands|forbidden|layer/i }],
        },
      ],
    });
  });

  it(tag('P00.3-05'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule('tools/eslint-rules/layer-imports.js');
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/layer-imports', rule.rule, {
      valid: [],
      invalid: [
        {
          code: readFixture('invalid-ui-alias-reexport.ts'),
          filename: FIXTURE('invalid-ui-alias-reexport.ts'),
          errors: [{ message: /forbidden|layer|game|import/i }],
        },
        {
          code: readFixture('invalid-game-static-import.ts'),
          filename: FIXTURE('invalid-game-static-import.ts'),
          errors: [{ message: /forbidden|layer|import/i }],
        },
      ],
    });
  });

  it(tag('P00.3-06'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rt = loadRuleTester();
    if (!rt.ready) {
      t.skip(rt.reason);
      return;
    }
    const rule = loadLocalRule('tools/eslint-rules/layer-imports.js');
    if (!rule.ready) {
      t.skip(rule.reason);
      return;
    }

    runRuleFixtures(rt.RuleTester, 'vibe/layer-imports', rule.rule, {
      valid: [
        {
          code: readFixture('valid-content-type-only.ts'),
          filename: FIXTURE('valid-content-type-only.ts'),
        },
      ],
      invalid: [],
    });
  });
});

function readFixture(name) {
  return readFixtureFile(path.join('eslint', 'layer-imports', name));
}

function readFixtureFile(rel) {
  return fs.readFileSync(path.join(FIXTURES_ROOT, rel), 'utf8');
}
