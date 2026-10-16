import type { Palette } from '../palette';
import { catSprites, type SpriteFrames } from './cat';
import { kitSprites } from './kit';
import { roomSprites } from './room';

export type { SpriteFrames };

/** Every world/DOM sprite animation, drawn for one palette. */
export function allSprites(pal: Palette): SpriteFrames[] {
  return [...roomSprites(pal), ...catSprites(pal), ...kitSprites(pal)];
}
