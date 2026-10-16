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
import {
  contextManagement,
  localServers,
  modelRouting,
  persistentMemory,
  tokenOptimization,
} from './infrastructure';
import { managerAgent, parallelAgents, worktrees } from './orchestration';
import {
  autonomousCompany,
  executiveAgents,
  finance,
  marketing,
  productManagement,
  selfDrivingRepositories,
} from './organizations';
import {
  customHarness,
  evaluations,
  metaHarness,
  selfImprovement,
  workflowOptimization,
} from './recursive';

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
  'tech-context-management': contextManagement,
  'tech-persistent-memory': persistentMemory,
  'tech-model-routing': modelRouting,
  'tech-token-optimization': tokenOptimization,
  'tech-local-servers': localServers,
  'tech-custom-harness': customHarness,
  'tech-meta-harness': metaHarness,
  'tech-evaluations': evaluations,
  'tech-workflow-optimization': workflowOptimization,
  'tech-self-improvement': selfImprovement,
  'tech-self-driving-repositories': selfDrivingRepositories,
  'tech-product-management': productManagement,
  'tech-marketing': marketing,
  'tech-finance': finance,
  'tech-executive-agents': executiveAgents,
  'tech-autonomous-company': autonomousCompany,
};

export function renderIllustration(id: string): PixelCanvas {
  const draw = ILLUSTRATIONS[id];
  if (!draw) throw new Error(`no illustration ${id}`);
  const c = createCanvas(ILLUSTRATION.w, ILLUSTRATION.h);
  draw(c, light);
  return c;
}
