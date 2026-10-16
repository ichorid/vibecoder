/**
 * Player camera control on top of the automatic framing (pure). The automatic camera still
 * hugs the scene and animates discoveries; the player's view is a zoom factor and a pan offset
 * applied to it, clamped so the scene can never be lost.
 */
import type { Camera, Rect, Viewport } from './camera';

export interface UserView {
  /** Multiplies the automatic zoom. */
  readonly zoom: number;
  /** World-unit offset of the view centre from the automatic centre. */
  readonly dx: number;
  readonly dy: number;
}

export const IDENTITY_VIEW: UserView = { zoom: 1, dx: 0, dy: 0 };
export const MIN_VIEW_ZOOM = 0.6;
export const MAX_VIEW_ZOOM = 6;
/**
 * However far the scene has grown, the player can always zoom in to this many CSS px per world
 * px — about twice the scale of the opening room — to look at the room up close again.
 */
export const MAX_ABSOLUTE_ZOOM = 4;

/** The largest zoom factor allowed on top of `base`. */
export function maxViewZoom(base: Camera): number {
  return Math.max(MAX_VIEW_ZOOM, MAX_ABSOLUTE_ZOOM / base.zoom);
}

export function shownCamera(base: Camera, view: UserView): Camera {
  return {
    centerX: base.centerX + view.dx,
    centerY: base.centerY + view.dy,
    zoom: base.zoom * view.zoom,
  };
}

/** Drag by a screen delta (CSS px): the scene follows the finger. */
export function panBy(view: UserView, base: Camera, screenDx: number, screenDy: number): UserView {
  const zoom = base.zoom * view.zoom;
  return { ...view, dx: view.dx - screenDx / zoom, dy: view.dy - screenDy / zoom };
}

/** Zoom by `factor` keeping the world point under (screenX, screenY) where it is. */
export function zoomAt(
  view: UserView,
  base: Camera,
  viewport: Viewport,
  screenX: number,
  screenY: number,
  factor: number,
): UserView {
  const before = shownCamera(base, view);
  const offX = screenX - viewport.width / 2;
  const offY = screenY - viewport.height / 2;
  const worldX = before.centerX + offX / before.zoom;
  const worldY = before.centerY + offY / before.zoom;
  const zoom = Math.min(maxViewZoom(base), Math.max(MIN_VIEW_ZOOM, view.zoom * factor));
  const shownZoom = base.zoom * zoom;
  return {
    zoom,
    dx: worldX - offX / shownZoom - base.centerX,
    dy: worldY - offY / shownZoom - base.centerY,
  };
}

/** Keep the view centre inside the scene so the player can always find it again. */
export function clampView(view: UserView, base: Camera, scene: Rect | null): UserView {
  if (!scene) return view;
  const cx = Math.min(scene.x + scene.w, Math.max(scene.x, base.centerX + view.dx));
  const cy = Math.min(scene.y + scene.h, Math.max(scene.y, base.centerY + view.dy));
  return { ...view, dx: cx - base.centerX, dy: cy - base.centerY };
}

export function isAdjusted(view: UserView): boolean {
  return Math.abs(view.zoom - 1) > 1e-3 || Math.abs(view.dx) > 0.5 || Math.abs(view.dy) > 0.5;
}
