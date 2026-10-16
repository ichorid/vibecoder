import path from 'node:path';
import fs from 'node:fs';
import { run } from './exec.mjs';
import { FIXTURES_ROOT } from './paths.mjs';
import { fileExists } from './bootstrap.mjs';

/**
 * Run tsc on an acceptance fixture project when implementer adds tools/type-fixtures harness.
 * Falls back to a minimal generated tsconfig in fixtures/types when only per-file fixtures exist.
 *
 * @param {string} fixtureRel path under tools/acceptance/fixtures/types
 * @param {'expectError'|'expectClean'} expectation
 */
export function typecheckFixture(fixtureRel, expectation) {
  const fixtureAbs = path.join(FIXTURES_ROOT, 'types', fixtureRel);
  if (!fs.existsSync(fixtureAbs)) {
    return { ran: false, reason: `missing fixture ${fixtureRel}` };
  }

  if (fileExists('tools/type-fixtures/tsconfig.acceptance.json')) {
    const relFromRepo = path.join('tools/acceptance/fixtures/types', fixtureRel);
    const result = run('npx', [
      'tsc',
      '-p',
      'tools/type-fixtures/tsconfig.acceptance.json',
      '--pretty',
      'false',
    ]);
    const combined = `${result.stdout}\n${result.stderr}`;
    const mentionsFile = combined.includes(path.basename(fixtureRel));
    if (expectation === 'expectError') {
      return {
        ran: true,
        ok: result.status !== 0 && mentionsFile,
        output: combined,
        status: result.status,
      };
    }
    return {
      ran: true,
      ok: result.status === 0,
      output: combined,
      status: result.status,
    };
  }

  const stubConfig = path.join(FIXTURES_ROOT, 'types', 'tsconfig.stub.json');
  const perFileConfig = {
    extends: '../../../tsconfig.game.json',
    include: [fixtureRel],
    compilerOptions: { noEmit: true },
  };

  if (!fileExists('tsconfig.game.json')) {
    return { ran: false, reason: 'bootstrap-gate: tsconfig.game.json' };
  }

  fs.mkdirSync(path.dirname(stubConfig), { recursive: true });
  fs.writeFileSync(stubConfig, JSON.stringify(perFileConfig, null, 2));

  const result = run('npx', ['tsc', '-p', stubConfig, '--pretty', 'false']);
  const combined = `${result.stdout}\n${result.stderr}`;

  if (expectation === 'expectError') {
    return {
      ran: true,
      ok: result.status !== 0,
      output: combined,
      status: result.status,
    };
  }
  return {
    ran: true,
    ok: result.status === 0,
    output: combined,
    status: result.status,
  };
}
