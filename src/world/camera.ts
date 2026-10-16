/**
 * Camera math (pure): fit an authored framing envelope to the canvas, map world to screen
 * (`screen = (world - center) × zoom + viewportCenter`), and interpolate between framings with
 * one named easing (zoom in log space so each step of zoom-out feels even).
 */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Camera {
  readonly centerX: number;
  readonly centerY: number;
  /** CSS pixels per world unit. */
  readonly zoom: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export function fitEnvelope(envelope: Rect, viewport: Viewport): Camera {
  return {
    centerX: envelope.x + envelope.w / 2,
    centerY: envelope.y + envelope.h / 2,
    zoom: Math.min(viewport.width / envelope.w, viewport.height / envelope.h),
  };
}

export function worldToScreen(
  point: { readonly x: number; readonly y: number },
  camera: Camera,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (point.x - camera.centerX) * camera.zoom + viewport.width / 2,
    y: (point.y - camera.centerY) * camera.zoom + viewport.height / 2,
  };
}

/** The one easing used for camera transitions. */
export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export function interpolateCamera(from: Camera, to: Camera, t: number): Camera {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const e = easeInOut(t);
  return {
    centerX: from.centerX + (to.centerX - from.centerX) * e,
    centerY: from.centerY + (to.centerY - from.centerY) * e,
    zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e),
  };
}

/** Duration of an authored camera transition. */
export const CAMERA_TRANSITION_MS = 1600;
