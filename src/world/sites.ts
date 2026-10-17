/**
 * Construction sites (docs/feature_projects.md §7.2), pure planning: what each build in
 * progress shows as scaffolding — the target technology's own placements, the next release
 * frame on the room wall, or a generic site for the system's own projects — and how far the
 * camera leans toward a site that has been built for a while (halfway, never all the way: the
 * discovery itself does the rest).
 */
import {
  ROOM_ADDITION,
  presentAdditions,
  worldAdditions,
  type Placement,
  type Rect,
} from '../content/world';
import { interpolateCamera, type Camera } from './camera';
import type { WorldSiteViewModel } from '../game/selectors';

/** Hazard yellow for sites and their LOD dot. Never orange: orange pixels are the cat. */
export const SITE_COLOR = 0xf6c945;
/** How far the camera leans toward a framed site (0 = not at all, 1 = fully). */
export const SITE_LEAN = 0.5;
/** A generic site's size in world units (the system's own projects). */
const GENERIC_SITE = 24;

export interface SitePlan {
  /** Stable key for the renderer: `<kind>:<id>`. */
  readonly key: string;
  readonly kind: WorldSiteViewModel['kind'];
  /** What the scaffolding is a silhouette of (empty: a generic site). */
  readonly placements: readonly Placement[];
  /** Where a generic site stands (top-left), used when there are no placements. */
  readonly at: { readonly x: number; readonly y: number };
  readonly progress: number;
  readonly active: boolean;
  readonly half: boolean;
  readonly framed: boolean;
}

/** Sites to draw for the projection, in the order given (unknown additions are skipped). */
export function planSites(
  sites: readonly WorldSiteViewModel[],
  technologyIds: readonly string[],
): SitePlan[] {
  const plans: SitePlan[] = [];
  for (const site of sites) {
    const base = {
      key: `${site.kind}:${site.id}`,
      kind: site.kind,
      progress: Math.min(1, Math.max(0, site.progress)),
      active: site.active,
      half: site.half,
      framed: site.framed,
    };
    if (site.kind === 'addition') {
      const addition = worldAdditions.find((a) => a.id === site.id);
      if (!addition) continue;
      plans.push({ ...base, placements: addition.placements, at: addition.anchor });
    } else if (site.kind === 'frame') {
      const slot = ROOM_ADDITION.frameSlots?.[Number(site.id) - 1];
      if (!slot) continue;
      plans.push({
        ...base,
        placements: [{ sprite: 'release-frame', x: slot.x, y: slot.y }],
        at: slot,
      });
    } else {
      // The machine building for itself: next to the newest addition.
      const newest = presentAdditions(technologyIds).at(-1) ?? ROOM_ADDITION;
      plans.push({
        ...base,
        placements: [],
        at: { x: newest.anchor.x + 8, y: newest.anchor.y - GENERIC_SITE / 2 },
      });
    }
  }
  return plans;
}

/** The generic site's rectangle. */
export function genericSiteRect(at: { readonly x: number; readonly y: number }): Rect {
  return { x: at.x, y: at.y, w: GENERIC_SITE, h: GENERIC_SITE };
}

/** The camera for a framed site: halfway from the framing without it to the one with it. */
export function leanToward(base: Camera, withSite: Camera): Camera {
  return interpolateCamera(base, withSite, SITE_LEAN);
}

/** The part of a site's bounds its scaffolding has reached (it grows bottom-up). */
export function revealedRect(bounds: Rect, progress: number): Rect {
  const h = bounds.h * Math.min(1, Math.max(0, progress));
  return { x: bounds.x, y: bounds.y + bounds.h - h, w: bounds.w, h };
}
