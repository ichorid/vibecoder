import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { light } from '../palette';
import { ILLUSTRATION, type Illustration } from './common';
import { aiNativeIde, autocomplete, generatedSnippets } from './manual';

/** Technology illustrations by illustration ID (the file is `technologies/<id without tech->.png`). */
export const ILLUSTRATIONS: Readonly<Record<string, Illustration>> = {
  'tech-autocomplete': autocomplete,
  'tech-generated-snippets': generatedSnippets,
  'tech-ai-native-ide': aiNativeIde,
};

export function renderIllustration(id: string): PixelCanvas {
  const draw = ILLUSTRATIONS[id];
  if (!draw) throw new Error(`no illustration ${id}`);
  const c = createCanvas(ILLUSTRATION.w, ILLUSTRATION.h);
  draw(c, light);
  return c;
}
