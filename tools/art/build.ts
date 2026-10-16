/** Builds every generated art file in memory (deterministic bytes). CLI: tools/art/export.ts. */
import { createCanvas } from '../../art/lib/canvas';
import { pack } from '../../art/lib/pack';
import { encodePng } from '../../art/lib/png';
import { ILLUSTRATIONS, renderIllustration } from '../../art/illustrations';
import { infiniteWeekend } from '../../art/illustrations/endings';
import { keyboardPhoto, lapPhoto } from '../../art/illustrations/memorial';
import { THEMES } from '../../art/palette';
import { allSprites } from '../../art/sprites';
import type { AtlasData } from '../../src/content/atlas';

export const OUT_DIR = 'public/assets';

export function buildAtlas(theme: keyof typeof THEMES): { png: Buffer; json: string } {
  const sprites = allSprites(THEMES[theme]);
  const strips = sprites.map((s) => ({
    id: s.tag,
    // Frames of one tag are contiguous so DOM sprites can step through them with CSS.
    w: s.frames.reduce((w, f) => w + f.width, 0),
    h: Math.max(...s.frames.map((f) => f.height)),
  }));
  const { size, placed } = pack(strips);
  const sheet = createCanvas(size.w, size.h);
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const animations: Record<string, { frames: string[]; frameMs: number }> = {};
  for (const sprite of sprites) {
    const spot = placed.find((p) => p.id === sprite.tag);
    if (!spot) throw new Error(`unplaced ${sprite.tag}`);
    let x = spot.x;
    const ids: string[] = [];
    sprite.frames.forEach((frame, i) => {
      const id = `${sprite.tag}-${i}`;
      sheet.blit(frame, x, spot.y);
      frames[id] = { x, y: spot.y, w: frame.width, h: frame.height };
      ids.push(id);
      x += frame.width;
    });
    animations[sprite.tag] = { frames: ids, frameMs: sprite.frameMs };
  }
  const atlas: AtlasData = {
    format: 'vibe-atlas/1',
    image: `sprites-${theme}.png`,
    size,
    frames,
    animations,
  };
  return { png: encodePng(sheet), json: `${JSON.stringify(atlas, null, 1)}\n` };
}

export function outputs(): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const theme of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
    const atlas = buildAtlas(theme);
    files.set(`sprites-${theme}.png`, atlas.png);
    files.set(`sprites-${theme}.json`, Buffer.from(atlas.json));
  }
  for (const id of Object.keys(ILLUSTRATIONS)) {
    files.set(`technologies/${id.replace(/^tech-/, '')}.png`, encodePng(renderIllustration(id)));
  }
  files.set('memorial/keyboard.png', encodePng(keyboardPhoto()));
  files.set('memorial/lap.png', encodePng(lapPhoto()));
  files.set('endings/infinite-weekend.png', encodePng(infiniteWeekend(true)));
  files.set('endings/infinite-weekend-nocat.png', encodePng(infiniteWeekend(false)));
  return files;
}
