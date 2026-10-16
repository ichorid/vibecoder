import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIREMENTS } from '../requirements.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listTestSources(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTestSources(full));
    } else if (entry.name.endsWith('.test.mjs')) {
      out.push(full);
    }
  }
  return out;
}

describe('P00 requirements registry coverage', () => {
  it('every requirement id appears in at least one acceptance test tag', () => {
    const sources = listTestSources(ROOT).filter((p) => !p.includes('/meta/'));
    const combined = sources.map((p) => fs.readFileSync(p, 'utf8')).join('\n');
    const missing = REQUIREMENTS.filter((req) => !combined.includes(`'${req.id}'`) && !combined.includes(`"${req.id}"`));
    assert.deepEqual(
      missing.map((m) => m.id),
      [],
      `requirements without test linkage: ${missing.map((m) => m.id).join(', ')}`,
    );
  });
});
