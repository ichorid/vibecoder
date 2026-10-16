import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { behaviorRunnerReady, skipUnlessBehaviorRunner, fileExists, readText } from '../lib/bootstrap.mjs';
import { requirementById } from '../requirements.mjs';

function tag(id) {
  return `[${requirementById(id).id}] ${requirementById(id).summary}`;
}

describe('P00.3–P00.4 rule bootstrap (post-P00.1)', () => {
  const gate = behaviorRunnerReady();

  it(tag('P00.3-01'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const layer =
      fileExists('tools/eslint-rules/layer-imports.js') ||
      fileExists('tools/eslint-rules/layer-imports.mjs') ||
      fileExists('tools/eslint-rules/layer-imports.ts');
    assert.ok(layer);
  });

  it(tag('P00.3-02'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const scripts = JSON.parse(readText('package.json')).scripts ?? {};
    assert.ok(scripts['test:rules']);
  });

  it(tag('P00.4-01'), (t) => {
    if (!skipUnlessBehaviorRunner(t, gate)) return;
    const rules = [
      'tools/eslint-rules/no-ambient-game-time.js',
      'tools/eslint-rules/no-raw-content-in-ui.js',
      'tools/eslint-rules/owned-scheduling.js',
    ];
    for (const rel of rules) {
      const ok =
        fileExists(rel) ||
        fileExists(rel.replace('.js', '.mjs')) ||
        fileExists(rel.replace('.js', '.ts'));
      assert.ok(ok, rel);
    }
  });
});
