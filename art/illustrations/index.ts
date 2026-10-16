import { createCanvas, type PixelCanvas } from '../lib/canvas';
import { light } from '../palette';
import { ILLUSTRATION, type Illustration } from './common';
import {
  autonomousEdits,
  persistentInstructions,
  ralphLoop,
  reviewer,
  terminalAgent,
  toolPermissions,
} from './agentic';
import { aiNativeIde, autocomplete, generatedSnippets } from './manual';
import { managerAgent, parallelAgents, worktrees } from './orchestration';

/** Technology illustrations by illustration ID (the file is `technologies/<id without tech->.png`). */
export const ILLUSTRATIONS: Readonly<Record<string, Illustration>> = {
  'tech-autocomplete': autocomplete,
  'tech-generated-snippets': generatedSnippets,
  'tech-ai-native-ide': aiNativeIde,
  'tech-terminal-agent': terminalAgent,
  'tech-autonomous-edits': autonomousEdits,
  'tech-tool-permissions': toolPermissions,
  'tech-persistent-instructions': persistentInstructions,
  'tech-ralph-loop': ralphLoop,
  'tech-reviewer': reviewer,
  'tech-parallel-agents': parallelAgents,
  'tech-worktrees': worktrees,
  'tech-manager-agent': managerAgent,
};

export function renderIllustration(id: string): PixelCanvas {
  const draw = ILLUSTRATIONS[id];
  if (!draw) throw new Error(`no illustration ${id}`);
  const c = createCanvas(ILLUSTRATION.w, ILLUSTRATION.h);
  draw(c, light);
  return c;
}
