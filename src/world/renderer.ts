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
  Sprite,
  Spritesheet,
  TextureSource,
  type Texture,
  type Ticker,
} from 'pixi.js';
import { toPixiSheet, type AtlasData } from '../content/atlas';
import { ROOM_ADDITION, sceneEnvelope, worldAdditions, type WorldAddition } from '../content/world';
import { CAMERA_TRANSITION_MS, fitEnvelope, interpolateCamera, type Camera } from './camera';
import type { RendererPort, WorldProjection } from './host';
import { catLod, clusterLod, projectedSize, type CatLod, type ClusterLod } from './lod';
import { planScene } from './scenePlan';

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
  root.addChild(links, clusterLayer, signalLayer, catLayer);
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
    for (const placement of addition.placements) {
      const sprite = makeSprite(placement.sprite);
      if (!sprite) continue;
      const scale = placement.scale ?? 1;
      sprite.position.set(placement.x, placement.y);
      sprite.scale.set(scale);
      detail.addChild(sprite);
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
    clusters.set(addition.id, {
      addition,
      detail,
      compact,
      dot,
      bounds,
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
        if (!clusters.has(link.to)) continue;
        const to = anchorOf(link.to);
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

  // ---- The world cat (cosmetic movement; its alive/dead fact comes from the projection). ----
  let catSprite: AnimatedSprite | null = null;
  const catDot = new Graphics();
  catLayer.addChild(catDot);
  let catTag = '';
  let catLevel: CatLod | null = null;
  const catPosition = { x: 30, y: 10 };
  let catTarget: { x: number; y: number } | null = null;
  let catRestUntil = 0;

  function setCatTag(tag: string): void {
    if (tag === catTag && catSprite) return;
    catTag = tag;
    catSprite?.destroy();
    catSprite = makeSprite(tag);
    if (catSprite) {
      catSprite.anchor.set(0.5, 1);
      catLayer.addChild(catSprite);
    }
  }

  function catSpots(): { x: number; y: number }[] {
    return [...clusters.values()].flatMap((c) => [...c.addition.catSpots]);
  }

  function updateCat(deltaMs: number): void {
    const cat = projection?.cat;
    const px = projectedSize(18, camera.zoom);
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
    if (cat.presentation === 'sick' || cat.presentation === 'critical') {
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
    if (catTarget) {
      const dx = catTarget.x - catPosition.x;
      const dy = catTarget.y - catPosition.y;
      const distance = Math.hypot(dx, dy);
      const step = (14 * deltaMs) / 1000;
      if (distance <= step) {
        catPosition.x = catTarget.x;
        catPosition.y = catTarget.y;
        if (cat.presentation === 'normal') {
          catTarget = null;
          catRestUntil = now + 3000 + random() * 6000;
        }
      } else {
        catPosition.x += (dx / distance) * step;
        catPosition.y += (dy / distance) * step;
        pose = 'walk';
        if (catSprite) catSprite.scale.x = dx < 0 ? -1 : 1;
      }
    } else if (cat.presentation === 'normal' && now < catRestUntil && catRestUntil - now > 4000) {
      pose = 'sleep';
    }
    setCatTag(`cat-${round}${pose}`);
    catSprite?.position.set(catPosition.x, catPosition.y);
    if (catDot.visible) {
      const size = (catLevel === 'cluster' ? 3 : 1) / camera.zoom;
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

  function targetCamera(): Camera {
    return fitEnvelope(sceneEnvelope(envelopeIds), viewport());
  }

  function applyCamera(): void {
    const { width, height } = viewport();
    root.scale.set(camera.zoom);
    root.position.set(
      width / 2 - camera.centerX * camera.zoom,
      height / 2 - camera.centerY * camera.zoom,
    );
  }

  function updateClusters(): void {
    for (const cluster of clusters.values()) {
      const size = projectedSize(Math.max(cluster.bounds.w, cluster.bounds.h), camera.zoom);
      cluster.lod = clusterLod(size, cluster.lod);
      cluster.detail.visible = cluster.lod === 'detail';
      if (cluster.compact) {
        cluster.compact.visible = cluster.lod === 'compact';
        cluster.compact.scale.set(Math.max(0.01, 12 / (8 * camera.zoom)));
      }
      cluster.dot.visible = cluster.lod === 'dots';
      cluster.dot.scale.set(2 / camera.zoom);
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

  function reconcile(): void {
    if (!projection) return;
    const plan = planScene(new Set(clusters.keys()), projection, active);
    for (const id of plan.build) {
      const addition = ADDITIONS.get(id);
      if (addition) buildCluster(addition, false);
    }
    if (plan.reveal) {
      const addition = ADDITIONS.get(plan.reveal);
      if (addition) buildCluster(addition, !projection.reducedMotion);
    }
    if (plan.build.length > 0 || plan.reveal) rebuildLinks();
    const firstFraming = envelopeIds.length === 0 && clusters.size <= plan.build.length + 1;
    const changed = plan.envelopeIds.join() !== envelopeIds.join();
    envelopeIds = plan.envelopeIds;
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
    data.zoom = camera.zoom.toFixed(3);
    data.theme = theme;
    data.transition = transition ? 'running' : 'idle';
    data.ticker = app.ticker.started ? 'running' : 'stopped';
    let sprites = 0;
    for (const cluster of clusters.values()) sprites += cluster.detail.children.length;
    data.sprites = String(sprites);
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
      signal.sprite.visible = camera.zoom * signal.sprite.scale.x > 0.6;
    }
    if (transition) {
      const t = (now - transition.startedAt) / CAMERA_TRANSITION_MS;
      camera = interpolateCamera(transition.from, targetCamera(), t);
      if (t >= 1) transition = null;
    }
    applyCamera();
    updateClusters();
    updateCat(ticker.deltaMS);
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
    clusters.clear();
    for (const id of ids) {
      const addition = ADDITIONS.get(id);
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
      publishState();
      app.render();
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
