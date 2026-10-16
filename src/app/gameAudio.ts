/**
 * The game's lazy audio graph: Tone backend, director and the published pack. Imported with
 * `import()` only after the player turns Sound on (importing Tone creates an AudioContext).
 * Production plays the approved pack; a dev server may opt into the demo pack explicitly with
 * `VITE_MUSIC_PACK=demo`. An empty bank stays silent — demos never stand in for approval.
 */
import { loadToneBackend } from '../music/backend/loader';
import { createDirector } from '../music/director';
import { libraryFromPack, type MusicPack } from '../music/pack';
import type { GameAudio } from './musicBinding';

export async function loadGameAudio(seed: number): Promise<GameAudio> {
  const module =
    import.meta.env.DEV && import.meta.env.VITE_MUSIC_PACK === 'demo'
      ? await import('../music/data/pack.demo.json')
      : await import('../music/data/pack.approved.json');
  const pack = module.default as unknown as MusicPack;
  const { backend, unlock } = loadToneBackend();
  return {
    director: createDirector({ backend, library: libraryFromPack(pack), seed }),
    unlock,
    patterns: pack.manifest.length,
  };
}
