import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../src/music/core/catalog';
import { checkBankCompatibility, DEFAULT_BOUNDARY_RULES } from '../../src/music/core/compatibility';
import { analyzePattern } from '../../src/music/core/validation';
import { createLibrary } from '../../src/music/library';
import { readRepository } from '../../tools/music/sources';

const DEMO_KEYS = [
  'discovery-demo-a@1',
  'discovery-demo-b@1',
  'singularity-demo-a@1',
  'singularity-demo-b@1',
];

describe('temporary demo patterns', () => {
  const { catalog, diagnostics } = buildCatalog(readRepository('music'));

  it('the repository catalog has no hard errors', () => {
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
  });

  it('contains exactly the four demo revisions, honestly labelled', () => {
    const demos = catalog.patterns.filter((p) => p.demo);
    expect(demos.map((p) => `${p.id}@${p.revision}`).sort()).toEqual(DEMO_KEYS);
    for (const p of demos) {
      expect(p.license).toBe('CC0-1.0');
      expect(p.motifRef).toEqual({ id: 'demo-main', revision: 1 });
      expect(JSON.stringify(p)).not.toMatch(/approved/i);
    }
    expect(catalog.motifs.get('demo-main')?.status).toBe('demo');
  });

  it('every demo passes ranges, polyphony and bounds', () => {
    for (const p of catalog.patterns) {
      const { normalized, diagnostics: d } = analyzePattern(p, catalog);
      expect(
        d.filter((x) => x.level === 'error'),
        p.id,
      ).toEqual([]);
      expect(normalized).not.toBeNull();
    }
  });

  it('Discovery is C major and Singularity C Phrygian on one shared clock', () => {
    const keys = Object.fromEntries(
      catalog.patterns.map((p) => [p.id, `${p.key.tonic} ${p.key.mode}`]),
    );
    expect(keys['discovery-demo-a']).toBe('C major');
    expect(keys['discovery-demo-b']).toBe('C major');
    expect(keys['singularity-demo-a']).toBe('C phrygian');
    expect(keys['singularity-demo-b']).toBe('C phrygian');
    const clocks = new Set(
      createLibrary(catalog, { candidates: 'demo' })
        .all()
        .map((p) => `${p.bpm}|${p.bars}|${p.stepsPerBar}`),
    );
    expect([...clocks]).toEqual(['120|4|16']);
  });

  it('each era bank is compatible in every order, including bag rollover', () => {
    const library = createLibrary(catalog, { candidates: 'demo' });
    for (const era of ['discovery', 'singularity']) {
      expect(library.bank(era)).toHaveLength(2);
      expect(checkBankCompatibility(library.bank(era), DEFAULT_BOUNDARY_RULES)).toEqual([]);
    }
  });

  it('nothing is approved: the production policy plays no demo', () => {
    expect(createLibrary(catalog, { candidates: 'approved', approved: new Set() }).all()).toEqual(
      [],
    );
  });
});
