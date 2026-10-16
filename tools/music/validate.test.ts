import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { validateCorpus } from './validateLib';

const cli = (...args: string[]) =>
  spawnSync('npx', ['vite-node', 'tools/music/validate.ts', '--', ...args], { encoding: 'utf8' });

describe('music:validate', () => {
  it('passes a clean corpus with exit 0', () => {
    const run = cli('--root', 'tests/music/corpus/ok');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/1 patterns, 0 errors/);
  });

  it('reports warnings separately and still exits 0', () => {
    const report = validateCorpus('tests/music/corpus/warn');
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((w) => w.message).join()).toMatch(/F#5/);
    expect(cli('--root', 'tests/music/corpus/warn').status).toBe(0);
  });

  it('fails on hard errors with a nonzero exit and the offending pattern', () => {
    const run = cli('--root', 'tests/music/corpus/bad');
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/fixture-bad@1/);
  });

  it('limits the corpus with --era', () => {
    const discovery = validateCorpus('tests/music/corpus/bad', 'discovery');
    expect(discovery.errors).toEqual([]);
    expect(discovery.patterns).toBe(1);
    expect(validateCorpus('tests/music/corpus/bad', 'singularity').errors.length).toBeGreaterThan(
      0,
    );
    expect(validateCorpus('tests/music/corpus/bad', 'baroque').errors[0]?.message).toMatch(
      /unknown era/,
    );
  });

  it('reports exact duplicates as errors and unchanged revisions as warnings, with both IDs', () => {
    const report = validateCorpus('tests/music/corpus/dup');
    expect(report.errors.map((e) => e.message).join('\n')).toMatch(
      /fixture-copy@1 .*fixture-ok@1.*identical music/,
    );
    expect(report.warnings.map((w) => w.message).join('\n')).toMatch(
      /fixture-ok@1 .*fixture-ok@2.*identical music/,
    );
    expect(cli('--root', 'tests/music/corpus/dup').status).toBe(1);
  });

  it('the shared demo motif alone never makes the repository corpus fail', () => {
    const report = validateCorpus('music');
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((w) => /near variant|identical music/.test(w.message))).toBe(false);
  });
});
