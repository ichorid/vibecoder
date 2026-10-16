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
  /** Raised surfaces the cat jumps onto instead of walking through the air (feet y, x range). */
  readonly catSurfaces?: readonly {
    readonly y: number;
    readonly minX: number;
    readonly maxX: number;
  }[];
  /** Short phrase for the canvas's accessible scene description. */
  readonly description: string;
  /** The last framing: the room and cat are visually gone at this scale. */
  readonly final?: boolean;
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

/** A cluster centre on a ring around the origin (angle in degrees, 0 = right, 90 = down). */
function polar(radius: number, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  return { x: Math.round(Math.cos(a) * radius), y: Math.round(Math.sin(a) * radius) };
}

/** A grid of one motif (repeated machinery), deterministic so reloads rebuild it identically. */
function grid(
  cx: number,
  cy: number,
  scale: number,
  sprite: string,
  cols: number,
  rows: number,
  spacing: number,
): Placement[] {
  const placements: Placement[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      placements.push({
        sprite,
        x: Math.round(cx + (c - (cols - 1) / 2) * spacing * scale),
        y: Math.round(cy + (r - (rows - 1) / 2) * spacing * scale),
        scale,
      });
    }
  }
  return placements;
}

/** Segments along a rectangle's border: a frame of subsystems around everything inside. */
function frameOf(half: number, sprite: string, scale: number, perSide: number): Placement[] {
  const placements: Placement[] = [];
  for (let i = 0; i < perSide; i += 1) {
    const t = -half + (2 * half * (i + 0.5)) / perSide;
    placements.push({ sprite, x: Math.round(t), y: -half, scale });
    placements.push({ sprite, x: Math.round(t), y: half, scale });
    placements.push({ sprite, x: -half, y: Math.round(t), scale });
    placements.push({ sprite, x: half, y: Math.round(t), scale });
  }
  return placements;
}

interface LateSpec {
  readonly technologyId: TechnologyId;
  readonly width: number;
  readonly at: Point;
  readonly placements: readonly Placement[];
  readonly links: readonly string[];
  readonly lodSprite: string;
  readonly description: string;
  readonly final?: boolean;
}

function late(spec: LateSpec): WorldAddition {
  return {
    id: `world-${spec.technologyId}`,
    technologyId: spec.technologyId,
    envelope: frame(spec.width),
    anchor: spec.at,
    placements: spec.placements,
    links: spec.links.map((to) => ({ to })),
    lodSprite: spec.lodSprite,
    catSpots: [],
    description: spec.description,
    ...(spec.final ? { final: true } : {}),
  };
}

const C13 = polar(1150, 200);
const C14 = polar(1450, 320);
const C15 = polar(1800, 70);
const C16 = polar(2250, 150);
const C17 = polar(2800, 260);
const C19 = polar(4500, 40);
const C20 = polar(5600, 120);
const C21 = polar(7000, 220);
const C22 = polar(8700, 300);
const C23 = polar(11_000, 60);
const C24 = polar(13_500, 160);
const C25 = polar(17_000, 240);
const C26 = polar(21_000, 330);
const C27 = polar(26_000, 100);

const lateAdditions: readonly WorldAddition[] = [
  late({
    technologyId: 'context-management',
    width: 3250,
    at: C13,
    placements: grid(C13.x, C13.y, 8, 'kit-memory', 2, 3, 30),
    links: ['world-manager-agent', 'world-parallel-agents'],
    lodSprite: 'lod-memory',
    description: 'context buffers stack up',
  }),
  late({
    technologyId: 'persistent-memory',
    width: 4060,
    at: C14,
    placements: [
      ...grid(C14.x, C14.y, 9, 'kit-memory', 3, 2, 28),
      ...cluster(C14.x, C14.y + 260, 9, [['kit-core', -13, 0]]),
    ],
    links: ['world-context-management', 'world-reviewer'],
    lodSprite: 'lod-memory',
    description: 'a memory bank glows',
  }),
  late({
    technologyId: 'model-routing',
    width: 5080,
    at: C15,
    placements: [
      ...cluster(C15.x, C15.y, 12, [['kit-router', -11, -8]]),
      ...grid(C15.x, C15.y + 220, 6, 'kit-node', 5, 1, 24),
    ],
    links: ['world-persistent-memory', 'world-manager-agent', 'world-worktrees'],
    lodSprite: 'lod-router',
    description: 'a router splits the traffic',
  }),
  late({
    technologyId: 'token-optimization',
    width: 6350,
    at: C16,
    placements: [
      ...cluster(C16.x, C16.y, 14, [
        ['kit-gear', -16, -8],
        ['kit-gear', 2, -8],
      ]),
      ...grid(C16.x, C16.y + 260, 7, 'kit-packet', 6, 2, 14),
    ],
    links: ['world-model-routing', 'world-context-management'],
    lodSprite: 'lod-gear',
    description: 'token compressors grind',
  }),
  late({
    technologyId: 'local-servers',
    width: 7940,
    at: C17,
    placements: grid(C17.x, C17.y, 12, 'kit-server', 6, 1, 24),
    links: ['world-token-optimization', 'world-persistent-memory'],
    lodSprite: 'lod-server',
    description: 'a ring of server racks hums',
  }),
  late({
    technologyId: 'custom-harness',
    width: 9900,
    at: { x: 0, y: -3400 },
    placements: frameOf(3400, 'kit-pipeline', 16, 6),
    links: ['world-local-servers', 'world-model-routing', 'world-token-optimization'],
    lodSprite: 'lod-pipeline',
    description: 'a harness frame encloses everything so far',
  }),
  late({
    technologyId: 'meta-harness',
    width: 12_400,
    at: C19,
    placements: [
      ...frameOf(4400, 'kit-server', 20, 4),
      ...cluster(C19.x, C19.y, 22, [['kit-manager', -10, -10]]),
    ],
    links: ['world-custom-harness', 'world-local-servers'],
    lodSprite: 'lod-manager',
    description: 'an outer harness supervises the inner one',
  }),
  late({
    technologyId: 'evaluations',
    width: 15_500,
    at: C20,
    placements: [
      ...grid(C20.x, C20.y, 22, 'kit-gauge', 3, 2, 26),
      ...grid(C20.x, C20.y + 900, 18, 'kit-test', 4, 1, 22),
    ],
    links: ['world-meta-harness', 'world-reviewer'],
    lodSprite: 'lod-gauge',
    description: 'evaluation dials score everything',
  }),
  late({
    technologyId: 'workflow-optimization',
    width: 19_400,
    at: C21,
    placements: grid(C21.x, C21.y, 26, 'kit-gear', 4, 3, 22),
    links: ['world-evaluations', 'world-custom-harness'],
    lodSprite: 'lod-gear',
    description: 'optimizer gears turn',
  }),
  late({
    technologyId: 'self-improvement',
    width: 24_200,
    at: C22,
    placements: [
      ...cluster(C22.x, C22.y, 60, [['kit-core', -13, -13]]),
      ...grid(C22.x, C22.y, 24, 'kit-loop', 5, 5, 40),
    ],
    links: ['world-workflow-optimization', 'world-meta-harness', 'world-evaluations'],
    lodSprite: 'lod-core',
    description: 'a recursive core rewrites itself',
  }),
  late({
    technologyId: 'self-driving-repositories',
    width: 30_300,
    at: C23,
    placements: [
      ...grid(C23.x, C23.y, 30, 'kit-pipeline', 4, 6, 40),
      ...grid(C23.x + 2600, C23.y, 24, 'kit-agent', 4, 6, 40),
    ],
    links: ['world-self-improvement', 'world-workflow-optimization'],
    lodSprite: 'lod-pipeline',
    description: 'repository pipelines ship on their own',
  }),
  late({
    technologyId: 'product-management',
    width: 37_800,
    at: C24,
    placements: [
      ...cluster(C24.x, C24.y, 70, [['kit-chart', -10, -8]]),
      ...grid(C24.x, C24.y + 1800, 30, 'kit-node', 8, 2, 30),
    ],
    links: ['world-self-driving-repositories', 'world-evaluations'],
    lodSprite: 'lod-chart',
    description: 'a product node decides what ships',
  }),
  late({
    technologyId: 'marketing',
    width: 47_300,
    at: C25,
    placements: grid(C25.x, C25.y, 40, 'kit-megaphone', 5, 4, 30),
    links: ['world-product-management', 'world-self-driving-repositories'],
    lodSprite: 'lod-megaphone',
    description: 'growth links shout outward',
  }),
  late({
    technologyId: 'finance',
    width: 59_100,
    at: C26,
    placements: [
      ...grid(C26.x, C26.y, 44, 'kit-chart', 5, 3, 28),
      ...grid(C26.x, C26.y + 2400, 36, 'kit-office', 6, 2, 32),
    ],
    links: ['world-marketing', 'world-product-management'],
    lodSprite: 'lod-chart',
    description: 'a finance subsystem counts the money',
  }),
  late({
    technologyId: 'executive-agents',
    width: 73_900,
    at: C27,
    placements: [
      ...cluster(C27.x, C27.y, 120, [['kit-executive', -9, -10]]),
      ...grid(C27.x, C27.y + 3600, 50, 'kit-executive', 7, 2, 30),
    ],
    links: ['world-finance', 'world-marketing', 'world-meta-harness'],
    lodSprite: 'lod-executive',
    description: 'executive agents sit at the top of the hierarchy',
  }),
  late({
    technologyId: 'autonomous-company',
    width: 92_400,
    at: { x: 0, y: 0 },
    placements: [
      ...frameOf(30_000, 'kit-office', 160, 8),
      ...frameOf(20_000, 'kit-core', 120, 6),
      ...grid(0, -38_000, 90, 'kit-node', 12, 1, 60),
      ...grid(0, 38_000, 90, 'kit-node', 12, 1, 60),
    ],
    links: [
      'world-executive-agents',
      'world-finance',
      'world-self-driving-repositories',
      'world-custom-harness',
    ],
    lodSprite: 'lod-core',
    description: 'an immense computational organization runs itself',
    final: true,
  }),
];

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
    { sprite: 'programmer-typing', x: -36, y: -20 },
  ],
  links: [],
  lodSprite: 'lod-terminal',
  // The desk top (desk at x −38, 104 wide, top surface at y 10), inset so paws stay on it.
  catSurfaces: [{ y: 10, minX: -34, maxX: 62 }],
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
  ...lateAdditions,
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
