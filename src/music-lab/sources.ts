/**
 * Music sources bundled into the Lab page. The dev server serves the full repository corpus for
 * composers; a production build carries only the temporary demo patterns (published approved
 * packs join in S06). Raw drafts, rejected files and review comments never become public assets.
 */
import type { MusicSources } from '../music/core/catalog';

type Glob = Record<string, () => Promise<unknown>>;

const shared = {
  eras: import.meta.glob('/music/eras/*.json', { import: 'default' }),
  presets: import.meta.glob('/music/presets/*.json', { import: 'default' }),
  arrangements: import.meta.glob('/music/arrangements/*.json', { import: 'default' }),
  motifs: import.meta.glob('/music/motif/*.json', { import: 'default' }),
};

const patterns: Glob = import.meta.env.DEV
  ? import.meta.glob('/music/patterns/**/*.json', { import: 'default' })
  : import.meta.glob('/music/patterns/**/*-demo-*.json', { import: 'default' });

async function loadAll(glob: Glob): Promise<unknown[]> {
  const files = Object.entries(glob).sort(([a], [b]) => a.localeCompare(b));
  return Promise.all(files.map(([, load]) => load()));
}

export async function loadLabSources(): Promise<MusicSources> {
  const [eras, presets, arrangements, motifs, list] = await Promise.all([
    loadAll(shared.eras),
    loadAll(shared.presets),
    loadAll(shared.arrangements),
    loadAll(shared.motifs),
    loadAll(patterns),
  ]);
  return { eras, presets, arrangements, motifs, patterns: list };
}
