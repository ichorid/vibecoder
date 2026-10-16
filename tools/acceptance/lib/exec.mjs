import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './paths.mjs';

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ env?: Record<string, string> }} [options]
 */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

/**
 * @param {string} script npm script name
 * @param {string[]} extraArgs
 */
export function npmRun(script, extraArgs = []) {
  return run('npm', ['run', script, ...extraArgs]);
}

/**
 * @param {string} relPath under repo root
 */
export function runEslintOnFiles(relPaths) {
  return run('npx', ['eslint', '--no-error-on-unmatched-pattern', ...relPaths]);
}
