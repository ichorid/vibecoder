/**
 * Authored world composition. One coordinate system with the original room at (0, 0); each
 * technology adds a cluster of kit motifs around what exists and a strictly larger portrait
 * framing envelope. Hierarchy here is presentation only (dependencies live in the catalog).
 */
import type { TechnologyId } from '../game/ids';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Placement {
  /** Animation tag in the sprite atlas. */
  readonly sprite: string;
  /** Top-left corner in world units. */
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
}

export interface WorldAddition {
  readonly id: string;
  readonly technologyId: TechnologyId | null;
  /** Camera framing once this addition exists (portrait 3:4, strictly growing). */
  readonly envelope: Rect;
  /** Where connectors attach. */
  readonly anchor: Point;
  readonly placements: readonly Placement[];
  readonly links: readonly { readonly to: string }[];
  /** Compact LOD icon tag and where the cat may wander once this exists. */
  readonly lodSprite: string;
  readonly catSpots: readonly Point[];
  /** Short phrase for the canvas's accessible scene description. */
  readonly description: string;
}

/** Portrait framing centered on (cx, cy) with the given width. */
function frame(w: number, cx = 0, cy = 0): Rect {
  const h = (w * 4) / 3;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

type Item = readonly [sprite: string, dx: number, dy: number];

/** Placements of kit motifs around a cluster centre, all at one scale. */
function cluster(cx: number, cy: number, scale: number, items: readonly Item[]): Placement[] {
  return items.map(([sprite, dx, dy]) => ({
    sprite,
    x: cx + dx * scale,
    y: cy + dy * scale,
    scale,
  }));
}

export const ROOM_ADDITION: WorldAddition = {
  id: 'room',
  technologyId: null,
  envelope: frame(204),
  anchor: { x: 0, y: 0 },
  placements: [
    { sprite: 'room-back', x: -88, y: -64 },
    { sprite: 'room-desk', x: -38, y: 6 },
    { sprite: 'room-monitor', x: 2, y: -25 },
    { sprite: 'cat-bowl', x: 50, y: 46 },
    { sprite: 'programmer-typing', x: -30, y: -12 },
  ],
  links: [],
  lodSprite: 'lod-terminal',
  // Feet positions: next to the keyboard on the desk, by the bowl, on the rug, by the chair.
  catSpots: [
    { x: 30, y: 10 },
    { x: 40, y: 54 },
    { x: -58, y: 52 },
    { x: -12, y: 58 },
  ],
  description: 'A programmer types at a desk in a cozy room',
};

export const worldAdditions: readonly WorldAddition[] = [
  {
    id: 'world-autocomplete',
    technologyId: 'autocomplete',
    envelope: frame(236),
    anchor: { x: 82, y: -84 },
    placements: [
      { sprite: 'kit-node', x: 64, y: -96 },
      { sprite: 'kit-node', x: 86, y: -104 },
      { sprite: 'kit-packet', x: 52, y: -82 },
      { sprite: 'kit-packet', x: 78, y: -88 },
    ],
    links: [{ to: 'room' }],
    lodSprite: 'lod-node',
    catSpots: [],
    description: 'ghostly suggestions hover near the monitor',
  },
  {
    id: 'world-generated-snippets',
    technologyId: 'generated-snippets',
    envelope: frame(290, 0, -14),
    anchor: { x: -40, y: -124 },
    placements: [
      { sprite: 'kit-scroll', x: -74, y: -138 },
      { sprite: 'kit-scroll', x: -50, y: -150 },
      { sprite: 'kit-scroll', x: -26, y: -140 },
      { sprite: 'kit-packet', x: -30, y: -100 },
      { sprite: 'kit-packet', x: -60, y: -110 },
    ],
    links: [{ to: 'room' }, { to: 'world-autocomplete' }],
    lodSprite: 'lod-scroll',
    catSpots: [],
    description: 'generated snippets float above the room',
  },
  {
    id: 'world-ai-native-ide',
    technologyId: 'ai-native-ide',
    envelope: frame(392, 0, -10),
    anchor: { x: -150, y: -10 },
    placements: [
      { sprite: 'kit-terminal', x: -176, y: -30 },
      { sprite: 'kit-terminal', x: -176, y: 0 },
      { sprite: 'kit-terminal', x: 128, y: -20 },
      { sprite: 'kit-gear', x: 150, y: 14 },
      { sprite: 'kit-agent', x: -168, y: 34 },
    ],
    links: [{ to: 'room' }, { to: 'world-generated-snippets' }],
    lodSprite: 'lod-terminal',
    catSpots: [{ x: -150, y: 24 }],
    description: 'IDE terminals and a helper bot flank it',
  },
  {
    id: 'world-terminal-agent',
    technologyId: 'terminal-agent',
    envelope: frame(500, 0, -6),
    anchor: { x: 0, y: 190 },
    placements: [
      { sprite: 'kit-terminal', x: -26, y: 176, scale: 2 },
      { sprite: 'kit-agent', x: 34, y: 180, scale: 2 },
      { sprite: 'kit-terminal', x: -200, y: 120 },
      { sprite: 'kit-terminal', x: 176, y: 120 },
      { sprite: 'kit-packet', x: -2, y: 150 },
      { sprite: 'kit-packet', x: 10, y: 120 },
    ],
    links: [{ to: 'room' }, { to: 'world-ai-native-ide' }],
    lodSprite: 'lod-agent',
    catSpots: [{ x: 10, y: 218 }],
    description: 'below it, a terminal agent runs on tokens',
  },
  {
    id: 'world-autonomous-edits',
    technologyId: 'autonomous-edits',
    envelope: frame(620),
    anchor: { x: -230, y: -250 },
    placements: cluster(-230, -250, 2, [
      ['kit-terminal', -14, -10],
      ['kit-test', -32, -8],
      ['kit-test', 14, -8],
      ['kit-loop', -10, 12],
    ]),
    links: [{ to: 'world-terminal-agent' }, { to: 'world-generated-snippets' }],
    lodSprite: 'lod-test',
    catSpots: [],
    description: 'test runners check the edits',
  },
  {
    id: 'world-tool-permissions',
    technologyId: 'tool-permissions',
    envelope: frame(760),
    anchor: { x: 260, y: -300 },
    placements: cluster(260, -300, 2, [
      ['kit-router', -11, -20],
      ['kit-gauge', -30, 4],
      ['kit-server', 10, -2],
      ['kit-router', -11, 12],
    ]),
    links: [{ to: 'world-autonomous-edits' }, { to: 'world-autocomplete' }],
    lodSprite: 'lod-router',
    catSpots: [],
    description: 'tool gates stand open',
  },
  {
    id: 'world-persistent-instructions',
    technologyId: 'persistent-instructions',
    envelope: frame(920),
    anchor: { x: -300, y: 300 },
    placements: cluster(-300, 300, 3, [
      ['kit-scroll', -24, -10],
      ['kit-scroll', -7, -14],
      ['kit-scroll', 10, -10],
      ['kit-node', -5, 10],
    ]),
    links: [{ to: 'world-terminal-agent' }, { to: 'world-ai-native-ide' }],
    lodSprite: 'lod-scroll',
    catSpots: [],
    description: 'instruction scrolls feed the agent',
  },
  {
    id: 'world-ralph-loop',
    technologyId: 'ralph-loop',
    envelope: frame(1120),
    anchor: { x: 330, y: 360 },
    placements: cluster(330, 360, 3, [
      ['kit-loop', -24, -10],
      ['kit-loop', 4, -10],
      ['kit-agent', -9, 12],
      ['kit-packet', -2, -16],
    ]),
    links: [{ to: 'world-persistent-instructions' }, { to: 'world-terminal-agent' }],
    lodSprite: 'lod-loop',
    catSpots: [],
    description: 'a loop machine reruns tasks forever',
  },
  {
    id: 'world-reviewer',
    technologyId: 'reviewer',
    envelope: frame(1360),
    anchor: { x: 0, y: -540 },
    placements: cluster(0, -540, 4, [
      ['kit-reviewer', -10, -8],
      ['kit-test', -30, 2],
      ['kit-test', 14, 2],
    ]),
    links: [{ to: 'world-autonomous-edits' }, { to: 'world-tool-permissions' }],
    lodSprite: 'lod-reviewer',
    catSpots: [],
    description: 'a reviewer eye watches from above',
  },
  {
    id: 'world-parallel-agents',
    technologyId: 'parallel-agents',
    envelope: frame(1700, 0, 20),
    anchor: { x: -560, y: -60 },
    placements: cluster(-560, -60, 4, [
      ['kit-agent', -9, -26],
      ['kit-agent', -30, 0],
      ['kit-agent', 12, 0],
      ['kit-node', -5, -6],
    ]),
    links: [
      { to: 'world-ralph-loop' },
      { to: 'world-persistent-instructions' },
      { to: 'world-reviewer' },
    ],
    lodSprite: 'lod-agent',
    catSpots: [],
    description: 'three agents branch off to the left',
  },
  {
    id: 'world-worktrees',
    technologyId: 'worktrees',
    envelope: frame(2100, 0, 30),
    anchor: { x: 600, y: -40 },
    placements: cluster(600, -40, 5, [
      ['kit-pipeline', -17, -24],
      ['kit-pipeline', -17, -7],
      ['kit-pipeline', -17, 10],
      ['kit-node', 20, -7],
    ]),
    links: [
      { to: 'world-parallel-agents' },
      { to: 'world-tool-permissions' },
      { to: 'world-ralph-loop' },
    ],
    lodSprite: 'lod-pipeline',
    catSpots: [],
    description: 'parallel worktree lines run to the right',
  },
  {
    id: 'world-manager-agent',
    technologyId: 'manager-agent',
    envelope: frame(2600, 0, 40),
    anchor: { x: 0, y: 900 },
    placements: cluster(0, 900, 7, [
      ['kit-manager', -10, -12],
      ['kit-agent', -36, 6],
      ['kit-agent', 18, 6],
    ]),
    links: [
      { to: 'world-parallel-agents' },
      { to: 'world-worktrees' },
      { to: 'world-terminal-agent' },
    ],
    lodSprite: 'lod-manager',
    catSpots: [],
    description: 'a crowned manager supervises from below',
  },
];

/** The framing for a set of unlocked technologies: the latest authored envelope. */
export function sceneEnvelope(unlocked: readonly string[]): Rect {
  let envelope = ROOM_ADDITION.envelope;
  for (const addition of worldAdditions) {
    if (addition.technologyId && unlocked.includes(addition.technologyId)) {
      envelope = addition.envelope;
    }
  }
  return envelope;
}

/** Additions present for a set of unlocked technologies, in authored order (room first). */
export function presentAdditions(unlocked: readonly string[]): WorldAddition[] {
  return [
    ROOM_ADDITION,
    ...worldAdditions.filter((a) => a.technologyId !== null && unlocked.includes(a.technologyId)),
  ];
}

/** Concise description of the discovered scene for the decorative canvas. */
export function describeScene(unlocked: readonly string[], catAlive: boolean): string {
  const [room, ...rest] = presentAdditions(unlocked);
  const parts = [room?.description ?? '', ...rest.map((a) => a.description)].filter(Boolean);
  const cat = catAlive ? ' An orange cat is somewhere nearby.' : '';
  return `${parts.join('; ')}.${cat}`;
}
