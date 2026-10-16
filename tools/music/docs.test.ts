import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const scripts = (
  JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
).scripts;

describe('music documentation', () => {
  for (const file of ['music/README.md', 'music/COMPOSITION_GUIDE.md', 'music/reviews/README.md']) {
    it(`${file} only names npm scripts that exist`, () => {
      const named = [...readFileSync(file, 'utf8').matchAll(/npm run ([a-z:-]+)/g)].map(
        (m) => m[1],
      );
      expect(named.length).toBeGreaterThan(0);
      for (const name of named)
        expect(Object.keys(scripts), `${file}: npm run ${name}`).toContain(name);
    });
  }
});
