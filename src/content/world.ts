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
