/**
 * The single documented atlas contract ("vibe-atlas/1"), produced only by `npm run art:export`
 * (see art/README.md). Pure data helpers: validation, a Pixi spritesheet adapter, and DOM
 * animation frames, so the same tag animates identically on canvas and in DOM.
 */
export interface AtlasRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface AtlasAnimation {
  readonly frames: readonly string[];
  readonly frameMs: number;
}

export interface AtlasData {
  readonly format: 'vibe-atlas/1';
  readonly image: string;
  readonly size: { readonly w: number; readonly h: number };
  readonly frames: Readonly<Record<string, AtlasRect>>;
  readonly animations: Readonly<Record<string, AtlasAnimation>>;
}

export const ATLAS_FORMAT = 'vibe-atlas/1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** Structural and geometric checks. `imageSize` is null when the PNG file is missing. */
export function validateAtlas(
  value: unknown,
  imageSize: { width: number; height: number } | null,
): string[] {
  const problems: string[] = [];
  if (!isRecord(value)) return ['atlas is not an object'];
  if (value.format !== ATLAS_FORMAT)
    problems.push(`unsupported atlas format ${String(value.format)}`);
  if (typeof value.image !== 'string') problems.push('atlas image name missing');
  const size = isRecord(value.size) ? value.size : {};
  const w = size.w;
  const h = size.h;
  if (!isInt(w) || !isInt(h) || w <= 0 || h <= 0) problems.push('atlas size invalid');
  if (imageSize === null) problems.push(`missing image ${String(value.image)}`);
  else if (isInt(w) && isInt(h) && (imageSize.width !== w || imageSize.height !== h)) {
    problems.push(`PNG is ${imageSize.width}×${imageSize.height}, atlas says ${w}×${h}`);
  }
  const frames = isRecord(value.frames) ? value.frames : {};
  for (const [id, rect] of Object.entries(frames)) {
    if (!isRecord(rect) || !isInt(rect.x) || !isInt(rect.y) || !isInt(rect.w) || !isInt(rect.h)) {
      problems.push(`frame "${id}" is not an integer rectangle`);
      continue;
    }
    if (rect.w <= 0 || rect.h <= 0) problems.push(`frame "${id}" is empty`);
    if (
      isInt(w) &&
      isInt(h) &&
      (rect.x < 0 || rect.y < 0 || rect.x + rect.w > w || rect.y + rect.h > h)
    ) {
      problems.push(`frame "${id}" lies outside the texture`);
    }
  }
  const animations = isRecord(value.animations) ? value.animations : {};
  for (const [tag, animation] of Object.entries(animations)) {
    if (!isRecord(animation) || !Array.isArray(animation.frames)) {
      problems.push(`animation "${tag}" malformed`);
      continue;
    }
    if (animation.frames.length === 0) problems.push(`animation "${tag}" has no frames`);
    for (const frame of animation.frames) {
      if (typeof frame !== 'string' || !(frame in frames)) {
        problems.push(`animation "${tag}" references unknown frame "${String(frame)}"`);
      }
    }
    if (typeof animation.frameMs !== 'number' || !(animation.frameMs > 0)) {
      problems.push(`animation "${tag}" has a non-positive duration`);
    }
  }
  return problems;
}

export interface PixiSheetData {
  frames: Record<
    string,
    {
      frame: AtlasRect;
      sourceSize: { w: number; h: number };
      spriteSourceSize: AtlasRect;
    }
  >;
  animations: Record<string, string[]>;
  meta: { image: string; size: { w: number; h: number }; scale: number };
}

/** Our contract → Pixi's spritesheet schema (they are not assumed identical). */
export function toPixiSheet(atlas: AtlasData): PixiSheetData {
  const frames: PixiSheetData['frames'] = {};
  for (const [id, rect] of Object.entries(atlas.frames)) {
    frames[id] = {
      frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      sourceSize: { w: rect.w, h: rect.h },
      spriteSourceSize: { x: 0, y: 0, w: rect.w, h: rect.h },
    };
  }
  const animations: PixiSheetData['animations'] = {};
  for (const [tag, animation] of Object.entries(atlas.animations)) {
    animations[tag] = [...animation.frames];
  }
  return { frames, animations, meta: { image: atlas.image, size: { ...atlas.size }, scale: 1 } };
}

export interface DomAnimation {
  readonly frames: readonly AtlasRect[];
  readonly frameMs: number;
}

/** Frames of one tag for DOM sprites (CSS background positions). */
export function domAnimation(atlas: AtlasData, tag: string): DomAnimation {
  const animation = atlas.animations[tag];
  if (!animation) return { frames: [], frameMs: 1000 };
  return {
    frames: animation.frames.flatMap((id) => {
      const rect = atlas.frames[id];
      return rect ? [rect] : [];
    }),
    frameMs: animation.frameMs,
  };
}
