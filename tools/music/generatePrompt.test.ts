import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { generatePrompt } from './promptLib';

const cli = (...args: string[]) =>
  spawnSync('npx', ['vite-node', 'tools/music/generatePrompt.ts', '--', ...args], {
    encoding: 'utf8',
  });

describe('music:prompt', () => {
  it('builds a complete era prompt from the template, the catalog and the rules', async () => {
    const result = await generatePrompt({ root: 'music', era: 'singularity', template: 'era' });
    if (!result.ok) throw new Error(result.error);
    const text = result.value;
    expect(text).toMatch(/Era composer template/);
    expect(text).toMatch(/Singularity \(`singularity`\)/);
    expect(text).toMatch(/C phrygian/);
    expect(text).toContain('music/patterns/singularity/');
    expect(text).toContain('music/reports/singularity.md');
    expect(text).toMatch(/Existing versions in this era[\s\S]*singularity-demo-a@1/);
    expect(text).toMatch(/Format example/);
    expect(text).toMatch(/TEMPORARY DEMO/);
    expect(text).toMatch(/practice/i);
    expect(text).toMatch(/Do not edit the motif, the schema/);
    expect(text).not.toMatch(/(update|change|rewrite) the motif/i);
  });

  it('the lead template asks for motif candidates and a human review, not a final score', async () => {
    const result = await generatePrompt({ root: 'music', era: 'discovery', template: 'lead' });
    if (!result.ok) throw new Error(result.error);
    expect(result.value).toMatch(/Lead composer template/);
    expect(result.value).toMatch(/motif candidates/i);
    expect(result.value).toMatch(/six.*transformations/i);
    expect(result.value).toMatch(/human review/i);
    expect(result.value).toMatch(/pending motif drafts under `music\/motif\/`/);
  });

  it('rejects an unknown era with a nonzero exit', () => {
    const run = cli('--era', 'baroque');
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/unknown era/i);
  });

  it('prints the prompt for a known era', () => {
    const run = cli('--era', 'discovery');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/# Composer task: Discovery/);
  });
});
