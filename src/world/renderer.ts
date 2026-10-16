/**
 * Pixi presentation: one Application for the app lifetime, a stable root container moved by the
 * camera, authored clusters built from the sprite atlas, connectors with a few moving signals,
 * per-cluster LOD and the wandering world cat. All animation runs on the owned ticker. It never
 * dispatches game commands or decides gameplay facts.
 */
import {
  AnimatedSprite,
  Application,
  Assets,
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Spritesheet,
  TextureSource,
  type Texture,
  type Ticker,
} from 'pixi.js';
import { toPixiSheet, type AtlasData } from '../content/atlas';
import {
  presentAdditions,
  ROOM_ADDITION,
  sceneEnvelope,
  withRoomExtras,
  worldAdditions,
  type Placement,
  type WorldAddition,
} from '../content/world';
import {
  CAMERA_TRANSITION_MS,
  fitEnvelope,
  hugBounds,
  interpolateCamera,
  type Camera,
} from './camera';
import type { RendererPort, WorldProjection, WorldTap } from './host';
import { catLod, clusterLod, projectedSize, type CatLod, type ClusterLod } from './lod';
import { planScene } from './scenePlan';
import { hopPosition, planCatPath, type PathStep } from './catPath';
import { coversCat } from './catDepth';
import { clipToBox } from './linkGeometry';
import {
  clampView,
  IDENTITY_VIEW,
  isAdjusted,
  panBy,
  shownCamera,
  zoomAt,
  type UserView,
} from './viewControl';

export interface RendererOptions {
  /** URL of the atlas JSON for a theme; the PNG sits next to it. */
  atlasUrl(theme: WorldProjection['theme']): string;
}

const ADDITIONS = new Map<string, WorldAddition>(
  [ROOM_ADDITION, ...worldAdditions].map((a) => [a.id, a]),
);
const REVEAL_MS = 900;
const DOT_COLORS = [0x3fe0e8, 0xffd166, 0x9d8cff, 0xff7ab6, 0x5ef08a, 0x59b7ff];
const BACKGROUND = { light: 0xefe2c2, dark: 0x111735 };
const LINK_COLOR = { light: 0x6b5a45, dark: 0x5ef0c0 };

interface Cluster {
  readonly addition: WorldAddition;
  readonly detail: Container;
  readonly compact: Sprite | null;
  readonly dot: Graphics;
  readonly bounds: { x: number; y: number; w: number; h: number };
  /** Copies of the placements that can stand in front of the cat, drawn above the cat layer. */
  readonly front: Container;
  readonly covers: readonly { placement: Placement; original: AnimatedSprite; copy: Sprite }[];
  lod: ClusterLod | null;
  revealStart: number | null;
}

interface Signal {
  readonly sprite: Sprite;
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
  phase: number;
}

interface LoadedSheet {
  readonly sheet: Spritesheet;
  readonly frameMs: ReadonlyMap<string, number>;
}

async function loadSheet(url: string): Promise<LoadedSheet> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`atlas ${url}: ${response.status}`);
  const atlas = (await response.json()) as AtlasData;
  const imageUrl = new URL(atlas.image, new URL(url, window.location.href)).toString();
  const texture = await Assets.load<Texture>(imageUrl);
  texture.source.scaleMode = 'nearest';
  const sheet = new Spritesheet(texture, toPixiSheet(atlas));
  await sheet.parse();
  const frameMs = new Map(Object.entries(atlas.animations).map(([tag, a]) => [tag, a.frameMs]));
  return { sheet, frameMs };
}

/** Tiny presentation-only PRNG for cosmetic choices (never gameplay randomness). */
function cosmeticRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export async function createPixiRenderer(
  parent: HTMLElement,
  options: RendererOptions,
): Promise<RendererPort> {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
    background: BACKGROUND.light,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: 'webgl',
  });
  app.ticker.maxFPS = 30;
  app.canvas.setAttribute('aria-hidden', 'true');
  app.canvas.dataset.testid = 'world-canvas';
  parent.appendChild(app.canvas);

  const root = new Container();
  const links = new Graphics();
  const clusterLayer = new Container();
  const signalLayer = new Container();
  const catLayer = new Container();
  // Tap targets on the room (poster, cat bowl) sit under the cat, so the cat wins a shared tap.
  const hitLayer = new Container();
  // Room sprites the cat can walk behind (the programmer, for a cat on the desk) are mirrored here.
  const frontLayer = new Container();
  root.addChild(links, clusterLayer, signalLayer, hitLayer, catLayer, frontLayer);
  app.stage.addChild(root);

  const sheets = new Map<WorldProjection['theme'], Promise<LoadedSheet>>();
  const sheetFor = (theme: WorldProjection['theme']) => {
    let sheet = sheets.get(theme);
    if (!sheet) {
      sheet = loadSheet(options.atlasUrl(theme));
      sheets.set(theme, sheet);
    }
    return sheet;
  };

  let loaded = await sheetFor('light');
  let sheet = loaded.sheet;
  let theme: WorldProjection['theme'] = 'light';
  let projection: WorldProjection | null = null;
  let active = false;
  let now = 0;
  const clusters = new Map<string, Cluster>();
  let signals: Signal[] = [];
  let camera: Camera = fitEnvelope(ROOM_ADDITION.envelope, {
    width: app.screen.width,
    height: app.screen.height,
  });
  let transition: { from: Camera; startedAt: number } | null = null;
  let envelopeIds: readonly string[] = [];
  const random = cosmeticRandom(7);

  /** An atlas animation as a sprite driven by the owned ticker (frame times from the atlas). */
  function makeSprite(tag: string): AnimatedSprite | null {
    const textures = sheet.animations[tag];
    if (!textures || textures.length === 0) return null;
    const sprite = new AnimatedSprite({ textures, autoUpdate: false });
    sprite.animationSpeed = 1000 / 60 / (loaded.frameMs.get(tag) ?? 500);
    sprite.gotoAndPlay(Math.floor(random() * sprite.totalFrames));
    return sprite;
  }

  function buildCluster(addition: WorldAddition, reveal: boolean): void {
    const detail = new Container();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const front = new Container();
    const covers: Cluster['covers'][number][] = [];
    for (const placement of addition.placements) {
      const sprite = makeSprite(placement.sprite);
      if (!sprite) continue;
      const scale = placement.scale ?? 1;
      sprite.position.set(placement.x, placement.y);
      sprite.scale.set(scale);
      detail.addChild(sprite);
      if (placement.coversCatAbove !== undefined) {
        const copy = new Sprite(sprite.texture);
        copy.position.copyFrom(sprite.position);
        copy.scale.copyFrom(sprite.scale);
        copy.visible = false;
        front.addChild(copy);
        covers.push({ placement, original: sprite, copy });
      }
      minX = Math.min(minX, placement.x);
      minY = Math.min(minY, placement.y);
      maxX = Math.max(maxX, placement.x + sprite.width);
      maxY = Math.max(maxY, placement.y + sprite.height);
    }
    const bounds = Number.isFinite(minX)
      ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
      : { x: addition.anchor.x, y: addition.anchor.y, w: 1, h: 1 };
    const compactTexture = sheet.animations[addition.lodSprite]?.[0];
    const compact = compactTexture ? new Sprite(compactTexture) : null;
    compact?.anchor.set(0.5);
    compact?.position.set(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    const dot = new Graphics();
    const color = DOT_COLORS[clusters.size % DOT_COLORS.length] ?? 0xffffff;
    dot.rect(-0.5, -0.5, 1, 1).fill(color);
    dot.position.set(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    const group = new Container();
    group.addChild(detail, ...(compact ? [compact] : []), dot);
    clusterLayer.addChild(group);
    frontLayer.addChild(front);
    clusters.set(addition.id, {
      addition,
      detail,
      compact,
      dot,
      bounds,
      front,
      covers,
      lod: null,
      revealStart: reveal ? now : null,
    });
  }

  function anchorOf(id: string): { x: number; y: number } {
    return ADDITIONS.get(id)?.anchor ?? { x: 0, y: 0 };
  }

  function rebuildLinks(): void {
    links.clear();
    for (const signal of signals) signal.sprite.destroy();
    signals = [];
    const packet = sheet.animations['kit-packet']?.[0];
    for (const cluster of clusters.values()) {
      const from = cluster.addition.anchor;
      const width = Math.max(1, cluster.addition.envelope.w / 160);
      for (const link of cluster.addition.links) {
        const target = clusters.get(link.to);
        if (!target) continue;
        // Into the room picture: stop at its border, never across the programmer and the cat.
        const to =
          link.to === ROOM_ADDITION.id
            ? clipToBox(from, anchorOf(link.to), target.bounds)
            : anchorOf(link.to);
        links.moveTo(from.x, from.y).lineTo(to.x, to.y);
        links.stroke({ width, color: LINK_COLOR[theme], alpha: 0.55 });
        if (packet) {
          const sprite = new Sprite(packet);
          sprite.anchor.set(0.5);
          sprite.scale.set(width);
          signalLayer.addChild(sprite);
          signals.push({ sprite, from, to, phase: random() });
        }
      }
    }
  }

  // ---- Taps on world objects: reported to the app, which turns them into game commands. ----
  const tapListeners = new Set<(tap: WorldTap) => void>();
  const emitTap = (target: WorldTap['target'], global: { x: number; y: number }) => {
    if (dragged) return;
    for (const listener of tapListeners) listener({ target, x: global.x, y: global.y });
  };
  /** World-space rectangles (room coordinates) padded for a finger. */
  const ROOM_TARGETS = {
    poster: { x: -75, y: -53, w: 32, h: 40 },
    bowl: { x: 44, y: 38, w: 26, h: 20 },
    shelf: { x: -32, y: -52, w: 44, h: 20 },
    window: { x: 32, y: -54, w: 44, h: 38 },
    monitor: { x: 2, y: -25, w: 48, h: 32 },
    plant: { x: 58, y: -14, w: 22, h: 34 },
  } as const;
  for (const [target, r] of Object.entries(ROOM_TARGETS) as [
    keyof typeof ROOM_TARGETS,
    { x: number; y: number; w: number; h: number },
  ][]) {
    const area = new Container();
    area.hitArea = new Rectangle(r.x, r.y, r.w, r.h);
    area.eventMode = 'static';
    area.cursor = 'pointer';
    area.on('pointertap', (event) => emitTap(target, event.global));
    hitLayer.addChild(area);
  }
  /** Tapping the cat plays through these poses, one per tap, each for a moment. */
  const TAP_POSES = ['pet', 'play', 'attention', 'idle'] as const;
  let tapPose = -1;
  let catOverride: { pose: string; until: number } | null = null;

  // ---- The world cat (cosmetic movement; its alive/dead fact comes from the projection). ----
  let catSprite: AnimatedSprite | null = null;
  const catDot = new Graphics();
  catLayer.addChild(catDot);
  let catTag = '';
  let catLevel: CatLod | null = null;
  const catPosition = { x: 30, y: 10 };
  let catTarget: { x: number; y: number } | null = null;
  let catRestUntil = 0;
  /** The planned walk/jump steps toward `catTarget` (replanned when the target changes). */
  let catPath: PathStep[] = [];
  let plannedFor: { x: number; y: number } | null = null;
  let hopProgress = 0;
  const HOP_MS = 450;

  function setCatTag(tag: string): void {
    if (tag === catTag && catSprite) return;
    catTag = tag;
    catSprite?.destroy();
    catSprite = makeSprite(tag);
    if (catSprite) {
      catSprite.anchor.set(0.5, 1);
      catSprite.eventMode = 'static';
      catSprite.cursor = 'pointer';
      catSprite.on('pointertap', (event) => {
        if (dragged) return;
        tapPose = (tapPose + 1) % TAP_POSES.length;
        catOverride = { pose: TAP_POSES[tapPose] ?? 'pet', until: now + 1600 };
        if (!(catPath[0]?.kind === 'jump' && hopProgress > 0)) catTarget = null;
        catRestUntil = now + 2500;
        emitTap('cat', event.global);
      });
      catLayer.addChild(catSprite);
    }
  }

  function catSpots(): { x: number; y: number }[] {
    return [...clusters.values()].flatMap((c) => [...c.addition.catSpots]);
  }

  function updateCat(deltaMs: number): void {
    const cat = projection?.cat;
    const px = projectedSize(18, shown().zoom);
    const finalFraming = [...clusters.values()].some((c) => c.addition.final === true);
    catLevel = catLod(px, cat?.alive ?? false, finalFraming, catLevel);
    catDot.visible = catLevel === 'cluster' || catLevel === 'pixel';
    if (catSprite) catSprite.visible = catLevel === 'sprite';
    if (!cat?.alive) {
      catSprite?.destroy();
      catSprite = null;
      catTag = '';
      catDot.visible = false;
      return;
    }
    const round = cat.round ? 'round-' : '';
    const room = ROOM_ADDITION.catSpots;
    let pose = 'idle';
    const tapped = catOverride && now < catOverride.until ? catOverride.pose : null;
    if (!tapped) catOverride = null;
    // A cat in mid-air lands first; taps and mood changes apply after the jump.
    const midJump = catPath[0]?.kind === 'jump' && hopProgress > 0;
    if (midJump) {
      // Keep the current target and path.
    } else if (tapped && cat.presentation !== 'sick' && cat.presentation !== 'critical') {
      pose = tapped;
      catTarget = null;
    } else if (cat.presentation === 'sick' || cat.presentation === 'critical') {
      pose = cat.presentation === 'sick' ? 'sick' : 'sleep';
      catTarget = null;
    } else if (cat.presentation === 'attentionSeeking' || cat.presentation === 'lonely') {
      catTarget = room[0] ?? null;
      pose = cat.presentation === 'lonely' ? 'lonely' : 'attention';
    } else if (cat.presentation === 'hungry') {
      catTarget = room[1] ?? null;
    } else if (!catTarget && now > catRestUntil) {
      const spots = catSpots();
      catTarget = spots[Math.floor(random() * spots.length)] ?? null;
    }
    if (!catTarget) plannedFor = null;
    if (catTarget) {
      if (plannedFor !== catTarget) {
        const surfaces = [...clusters.values()].flatMap((c) => [...(c.addition.catSurfaces ?? [])]);
        catPath = planCatPath(catPosition, catTarget, surfaces);
        plannedFor = catTarget;
        hopProgress = 0;
      }
      const stepPlan = catPath[0];
      if (!stepPlan) {
        catPosition.x = catTarget.x;
        catPosition.y = catTarget.y;
        if (cat.presentation === 'normal') {
          catTarget = null;
          catRestUntil = now + 3000 + random() * 6000;
        }
      } else if (stepPlan.kind === 'jump') {
        // Onto or off the desk: an arc in the stretched pose, never a walk through the air.
        hopProgress += deltaMs / HOP_MS;
        const at = hopPosition(stepPlan.from, stepPlan.to, hopProgress);
        catPosition.x = at.x;
        catPosition.y = at.y;
        pose = 'play';
        if (catSprite && stepPlan.to.x !== stepPlan.from.x) {
          catSprite.scale.x = stepPlan.to.x < stepPlan.from.x ? -1 : 1;
        }
        if (hopProgress >= 1) {
          catPath = catPath.slice(1);
          hopProgress = 0;
        }
      } else {
        const dx = stepPlan.to.x - catPosition.x;
        const dy = stepPlan.to.y - catPosition.y;
        const distance = Math.hypot(dx, dy);
        const step = (14 * deltaMs) / 1000;
        if (distance <= step) {
          catPosition.x = stepPlan.to.x;
          catPosition.y = stepPlan.to.y;
          catPath = catPath.slice(1);
        } else {
          catPosition.x += (dx / distance) * step;
          catPosition.y += (dy / distance) * step;
        }
        pose = 'walk';
        if (catSprite && Math.abs(dx) > 0.01) catSprite.scale.x = dx < 0 ? -1 : 1;
      }
    } else if (cat.presentation === 'normal' && now < catRestUntil && catRestUntil - now > 4000) {
      pose = 'sleep';
    }
    setCatTag(`cat-${round}${pose}`);
    catSprite?.position.set(catPosition.x, catPosition.y);
    if (catDot.visible) {
      const size = (catLevel === 'cluster' ? 3 : 1) / shown().zoom;
      catDot
        .clear()
        .rect(catPosition.x - size / 2, catPosition.y - size, size, size)
        .fill(0xe8892f);
    }
  }

  // ---- Camera, LOD, reveal. ----
  function viewport() {
    return { width: app.screen.width, height: app.screen.height };
  }

  /**
   * Hug what is built (room + framed additions); the final framing keeps its authored envelope,
   * whose emptiness is the point (the room and cat are gone at that scale).
   */
  function targetCamera(): Camera {
    const framed = [
      ROOM_ADDITION,
      ...worldAdditions.filter(
        (a) => a.technologyId !== null && envelopeIds.includes(a.technologyId),
      ),
    ];
    if (framed.some((a) => a.final)) return fitEnvelope(sceneEnvelope(envelopeIds), viewport());
    const rects = framed.flatMap((a) => {
      const cluster = clusters.get(a.id);
      return cluster ? [cluster.bounds] : [];
    });
    return fitEnvelope(hugBounds(rects) ?? sceneEnvelope(envelopeIds), viewport());
  }

  function applyCamera(): void {
    const { width, height } = viewport();
    const cam = shown();
    root.scale.set(cam.zoom);
    root.position.set(width / 2 - cam.centerX * cam.zoom, height / 2 - cam.centerY * cam.zoom);
  }

  // ---- Player camera: pinch / wheel zoom, drag to pan, double tap to fit again. ----
  let view: UserView = IDENTITY_VIEW;
  const viewListeners = new Set<(adjusted: boolean) => void>();
  /** What the player sees: the automatic framing with their zoom and pan on top. */
  function shown(): Camera {
    return shownCamera(camera, view);
  }
  function sceneRect() {
    return hugBounds([...clusters.values()].map((c) => c.bounds));
  }
  function setView(next: UserView): void {
    const was = isAdjusted(view);
    view = clampView(next, camera, sceneRect());
    if (isAdjusted(view) !== was) for (const listener of viewListeners) listener(!was);
    applyCamera();
  }
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  /** True from the moment a press turns into a drag or pinch until the next press: no tap. */
  let dragged = false;
  let lastTap = { at: -Infinity, x: 0, y: 0 };
  const local = (event: PointerEvent | WheelEvent) => {
    const r = app.canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return null;
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  app.canvas.style.touchAction = 'none';
  app.canvas.addEventListener('pointerdown', (event) => {
    const p = local(event);
    pointers.set(event.pointerId, p);
    if (pointers.size === 1) {
      downAt = p;
      dragged = false;
    } else dragged = true;
  });
  app.canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const before = spread();
    const p = local(event);
    pointers.set(event.pointerId, p);
    if (pointers.size >= 2) {
      const after = spread();
      if (before && after && before.d > 0) {
        const zoomed = zoomAt(view, camera, viewport(), after.x, after.y, after.d / before.d);
        setView(panBy(zoomed, camera, after.x - before.x, after.y - before.y));
      }
      return;
    }
    if (!dragged && downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 6) return;
    dragged = true;
    setView(panBy(view, camera, p.x - previous.x, p.y - previous.y));
  });
  const release = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId) || pointers.size > 0) return;
    const p = local(event);
    // Double tap (two quick taps close together) fits the scene again.
    if (!dragged) {
      if (now - lastTap.at < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
        setView(IDENTITY_VIEW);
        lastTap = { at: -Infinity, x: 0, y: 0 };
      } else lastTap = { at: now, ...p };
    }
  };
  app.canvas.addEventListener('pointerup', release);
  app.canvas.addEventListener('pointercancel', release);
  app.canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const p = local(event);
      setView(zoomAt(view, camera, viewport(), p.x, p.y, Math.exp(-event.deltaY * 0.0015)));
    },
    { passive: false },
  );

  function updateClusters(): void {
    hitLayer.visible = clusters.get(ROOM_ADDITION.id)?.detail.visible ?? false;
    for (const cluster of clusters.values()) {
      const size = projectedSize(Math.max(cluster.bounds.w, cluster.bounds.h), shown().zoom);
      cluster.lod = clusterLod(size, cluster.lod);
      cluster.detail.visible = cluster.lod === 'detail';
      if (cluster.compact) {
        cluster.compact.visible = cluster.lod === 'compact';
        cluster.compact.scale.set(Math.max(0.01, 12 / (8 * shown().zoom)));
      }
      cluster.dot.visible = cluster.lod === 'dots';
      cluster.dot.scale.set(2 / shown().zoom);
      if (cluster.revealStart !== null) {
        const t = Math.min(1, (now - cluster.revealStart) / REVEAL_MS);
        const group = cluster.detail.parent;
        if (group) {
          group.alpha = t;
          const s = 0.7 + 0.3 * t;
          group.scale.set(s);
          const cx = cluster.bounds.x + cluster.bounds.w / 2;
          const cy = cluster.bounds.y + cluster.bounds.h / 2;
          group.position.set(cx * (1 - s), cy * (1 - s));
        }
        if (t >= 1) cluster.revealStart = null;
      }
    }
  }

  /** The authored addition, with the room's bought extras for the current projection. */
  function additionFor(id: string): WorldAddition | undefined {
    const addition = ADDITIONS.get(id);
    return addition && id === ROOM_ADDITION.id
      ? withRoomExtras(addition, {
          releases: projection?.releases ?? 0,
          computeSlots: projection?.computeSlots ?? 0,
          plant: projection?.plant ?? 'ok',
        })
      : addition;
  }
  let framesBuilt = 0;
  let computeBuilt = 0;
  let plantBuilt = 'ok';

  function dropCluster(id: string): void {
    const cluster = clusters.get(id);
    cluster?.detail.parent?.destroy({ children: true });
    cluster?.front.destroy({ children: true });
    clusters.delete(id);
  }

  /** The cat walks behind a covering sprite: its copy shows, in step, over the cat. */
  function updateCatCover(): void {
    const catShown = catSprite?.visible === true;
    for (const cluster of clusters.values()) {
      const group = cluster.detail.parent;
      cluster.front.visible = catShown && cluster.detail.visible;
      if (!cluster.front.visible) continue;
      if (group) {
        cluster.front.alpha = group.alpha;
        cluster.front.scale.copyFrom(group.scale);
        cluster.front.position.copyFrom(group.position);
      }
      for (const cover of cluster.covers) {
        cover.copy.visible = coversCat(cover.placement, catPosition.y);
        cover.copy.texture = cover.original.texture;
      }
    }
  }

  function reconcile(): void {
    if (!projection) return;
    // A new run (or anything that un-discovers technologies): remove what no longer exists, so
    // the scene, the links, the camera and the cat start over with the run.
    const present = new Set(presentAdditions(projection.technologyIds).map((a) => a.id));
    const stale = [...clusters.keys()].filter((id) => !present.has(id));
    if (stale.length > 0) {
      for (const id of stale) dropCluster(id);
      rebuildLinks();
      envelopeIds = [];
      transition = null;
      view = IDENTITY_VIEW;
      catPosition.x = 30;
      catPosition.y = 10;
      catTarget = null;
      catPath = [];
      plannedFor = null;
    }
    // A newly shipped release or bought compute slot: rebuild the room with it in place.
    const room = clusters.get(ROOM_ADDITION.id);
    const changedRoom =
      framesBuilt !== projection.releases ||
      computeBuilt !== projection.computeSlots ||
      plantBuilt !== projection.plant;
    if (room && changedRoom) {
      dropCluster(ROOM_ADDITION.id);
      const addition = additionFor(ROOM_ADDITION.id);
      if (addition) buildCluster(addition, false);
      rebuildLinks();
    }
    framesBuilt = projection.releases;
    computeBuilt = projection.computeSlots;
    plantBuilt = projection.plant;
    const plan = planScene(new Set(clusters.keys()), projection, active);
    for (const id of plan.build) {
      const addition = additionFor(id);
      if (addition) buildCluster(addition, false);
    }
    if (plan.reveal) {
      const addition = additionFor(plan.reveal);
      if (addition) buildCluster(addition, !projection.reducedMotion);
    }
    if (plan.build.length > 0 || plan.reveal) rebuildLinks();
    const firstFraming = envelopeIds.length === 0 && clusters.size <= plan.build.length + 1;
    const changed = plan.envelopeIds.join() !== envelopeIds.join();
    envelopeIds = plan.envelopeIds;
    // A discovery reframes the scene for everyone: the player's own zoom and pan reset with it.
    if (changed && isAdjusted(view)) setView(IDENTITY_VIEW);
    if (changed) {
      if (plan.reveal && !projection.reducedMotion && !firstFraming) {
        transition = { from: camera, startedAt: now };
      } else {
        transition = null;
        camera = targetCamera();
      }
    }
  }

  /** Mirror presentation state on the canvas for browser checks (never read by gameplay). */
  function publishState(): void {
    const data = app.canvas.dataset;
    data.built = [...clusters.keys()].join(',');
    data.catLod = catLevel ?? 'none';
    data.zoom = shown().zoom.toFixed(3);
    data.view = isAdjusted(view) ? 'adjusted' : 'fit';
    data.theme = theme;
    data.transition = transition ? 'running' : 'idle';
    data.ticker = app.ticker.started ? 'running' : 'stopped';
    let sprites = 0;
    for (const cluster of clusters.values()) sprites += cluster.detail.children.length;
    data.sprites = String(sprites);
    data.releaseFrames = String(framesBuilt);
    data.computeSlots = String(computeBuilt);
    data.plant = plantBuilt;
    // Screen centres of the tap targets (CSS px on the canvas), empty when not tappable.
    const at = (x: number, y: number) => {
      const p = root.toGlobal(new Point(x, y));
      return `${Math.round(p.x)},${Math.round(p.y)}`;
    };
    const roomVisible = hitLayer.visible;
    data.hitPoster = roomVisible ? at(-59, -33) : '';
    data.hitBowl = roomVisible ? at(57, 50) : '';
    data.hitShelf = roomVisible ? at(-10, -42) : '';
    data.hitWindow = roomVisible ? at(54, -35) : '';
    data.hitMonitor = roomVisible ? at(26, -10) : '';
    data.hitPlant = roomVisible ? at(69, 6) : '';
    data.hitCat =
      catSprite?.visible && catLevel === 'sprite' ? at(catPosition.x, catPosition.y - 5) : '';
  }

  const tick = (ticker: Ticker) => {
    now += ticker.deltaMS;
    // Cosmetic animation slows while a discovery is announced; economy/cat time never does.
    const slow = projection?.pendingRevealId ? 0.35 : 1;
    const scaled = { ...ticker, deltaTime: ticker.deltaTime * slow } as Ticker;
    for (const cluster of clusters.values()) {
      if (!cluster.detail.visible) continue;
      for (const child of cluster.detail.children) {
        if (child instanceof AnimatedSprite) child.update(scaled);
      }
    }
    catSprite?.update(ticker);
    for (const signal of signals) {
      signal.phase = (signal.phase + (ticker.deltaMS * slow) / 2400) % 1;
      signal.sprite.position.set(
        signal.from.x + (signal.to.x - signal.from.x) * signal.phase,
        signal.from.y + (signal.to.y - signal.from.y) * signal.phase,
      );
      signal.sprite.visible = shown().zoom * signal.sprite.scale.x > 0.6;
    }
    if (transition) {
      const t = (now - transition.startedAt) / CAMERA_TRANSITION_MS;
      camera = interpolateCamera(transition.from, targetCamera(), t);
      if (t >= 1) transition = null;
    }
    applyCamera();
    updateClusters();
    updateCat(ticker.deltaMS);
    updateCatCover();
    publishState();
  };
  app.ticker.add(tick);

  async function setTheme(next: WorldProjection['theme']): Promise<void> {
    if (next === theme) return;
    theme = next;
    const nextSheet = await sheetFor(next);
    if (theme !== next) return;
    loaded = nextSheet;
    sheet = nextSheet.sheet;
    app.renderer.background.color = BACKGROUND[next];
    // Rebuild every cluster from the same unlocked IDs with the other palette.
    const ids = [...clusters.keys()];
    clusterLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    frontLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    clusters.clear();
    for (const id of ids) {
      const addition = additionFor(id);
      if (addition) buildCluster(addition, false);
    }
    rebuildLinks();
    catTag = '';
  }

  return {
    resize(width, height) {
      app.renderer.resize(Math.max(1, width), Math.max(1, height));
      if (!transition) camera = targetCamera();
      applyCamera();
    },
    setActive(next) {
      active = next;
      if (next) {
        app.ticker.start();
        reconcile();
      } else {
        app.ticker.stop();
      }
      publishState();
    },
    update(world) {
      projection = world;
      void setTheme(world.theme).then(() => reconcile());
      reconcile();
      updateCat(0);
      updateCatCover();
      publishState();
      app.render();
    },
    resetView() {
      setView(IDENTITY_VIEW);
    },
    onView(listener) {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    onTap(listener) {
      tapListeners.add(listener);
      return () => tapListeners.delete(listener);
    },
    onContext(listener) {
      // preventDefault lets the browser restore the context; the host then rebuilds.
      const lost = (event: Event) => {
        event.preventDefault();
        listener('lost');
      };
      const restored = () => listener('restored');
      app.canvas.addEventListener('webglcontextlost', lost);
      app.canvas.addEventListener('webglcontextrestored', restored);
      return () => {
        app.canvas.removeEventListener('webglcontextlost', lost);
        app.canvas.removeEventListener('webglcontextrestored', restored);
      };
    },
    destroy() {
      app.ticker.remove(tick);
      app.destroy({ removeView: true }, { children: true, texture: false });
    },
  };
}
