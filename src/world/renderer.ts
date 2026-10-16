/**
 * Pixi presentation: one Application for the app lifetime, a stable root container, and the
 * owned presentation ticker. It never dispatches game commands or decides gameplay facts.
 * Room art here is temporary development art (replaced by the atlas in P06).
 */
import { Application, Container, Graphics, TextureSource } from 'pixi.js';
import type { RendererPort, WorldProjection } from './host';

const ROOM = { width: 176, height: 128 };

interface Palette {
  wall: number;
  floor: number;
  desk: number;
  outline: number;
  screen: number;
  code: number;
  skin: number;
  hoodie: number;
  hair: number;
  window: number;
}

const PALETTES: Record<WorldProjection['theme'], Palette> = {
  light: {
    wall: 0xe9d9b4,
    floor: 0xb98a5a,
    desk: 0x8a5a33,
    outline: 0x3b2c1f,
    screen: 0x23344a,
    code: 0x7ee2a8,
    skin: 0xf1c69a,
    hoodie: 0x46536b,
    hair: 0x5a3a22,
    window: 0xa9d8f0,
  },
  dark: {
    wall: 0x232b52,
    floor: 0x2f2a4a,
    desk: 0x4a3a5e,
    outline: 0x0b0e20,
    screen: 0x0a1028,
    code: 0x5ef0c0,
    skin: 0xd9a77e,
    hoodie: 0x39406b,
    hair: 0x2d1c12,
    window: 0x1a2a5a,
  },
};

function drawRoom(g: Graphics, p: Palette): void {
  const { width: w, height: h } = ROOM;
  const x0 = -w / 2;
  const y0 = -h / 2;
  g.clear();
  g.rect(x0, y0, w, h).fill(p.outline);
  g.rect(x0 + 2, y0 + 2, w - 4, h * 0.62).fill(p.wall);
  g.rect(x0 + 2, y0 + 2 + h * 0.62, w - 4, h * 0.38 - 4).fill(p.floor);
  // Window and poster.
  g.rect(x0 + w - 46, y0 + 12, 32, 28).fill(p.outline);
  g.rect(x0 + w - 44, y0 + 14, 28, 24).fill(p.window);
  g.rect(x0 + 14, y0 + 12, 22, 28).fill(p.outline);
  g.rect(x0 + 16, y0 + 14, 18, 24).fill(0xd96b4a);
  // Desk.
  g.rect(x0 + 40, y0 + 70, 100, 8).fill(p.desk);
  g.rect(x0 + 44, y0 + 78, 6, 36).fill(p.desk);
  g.rect(x0 + 130, y0 + 78, 6, 36).fill(p.desk);
  // Monitor.
  g.rect(x0 + 70, y0 + 36, 48, 32).fill(p.outline);
  g.rect(x0 + 72, y0 + 38, 44, 28).fill(p.screen);
  g.rect(x0 + 90, y0 + 68, 8, 3).fill(p.outline);
  // Programmer (seated, back three-quarter view).
  g.rect(x0 + 54, y0 + 56, 22, 26).fill(p.hoodie);
  g.rect(x0 + 57, y0 + 42, 15, 15).fill(p.skin);
  g.rect(x0 + 56, y0 + 40, 17, 7).fill(p.hair);
  g.rect(x0 + 50, y0 + 82, 30, 6).fill(p.outline);
}

function drawCode(g: Graphics, p: Palette, frame: number): void {
  g.clear();
  for (let line = 0; line < 6; line += 1) {
    const length = 8 + ((line * 7 + frame) % 5) * 6;
    const visible = line < (frame % 7) + 1;
    if (visible) g.rect(-14, -24 + line * 4, Math.min(length, 40), 2).fill(p.code);
  }
}

function drawCat(g: Graphics, frame: number): void {
  const orange = 0xe8892f;
  const dark = 0x2a2017;
  g.clear();
  const x = 16;
  const y = 0;
  g.rect(x, y, 18, 8).fill(orange);
  g.rect(x + 14, y - 6, 8, 8).fill(orange);
  g.rect(x + 14, y - 8, 2, 2).fill(orange);
  g.rect(x + 20, y - 8, 2, 2).fill(orange);
  g.rect(x + 16, y - 4, 1, 1).fill(dark);
  g.rect(x + 19, y - 4, 1, 1).fill(dark);
  const tail = frame % 10 < 5 ? -4 : -2;
  g.rect(x - 4, y + tail, 4, 2).fill(orange);
  g.rect(x - 6, y + tail - 2, 2, 2).fill(orange);
}

export async function createPixiRenderer(parent: HTMLElement): Promise<RendererPort> {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const app = new Application();
  await app.init({
    width: Math.max(1, parent.clientWidth),
    height: Math.max(1, parent.clientHeight),
    backgroundAlpha: 0,
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
  const room = new Graphics();
  const code = new Graphics();
  const cat = new Graphics();
  cat.position.set(-176 / 2 + 100, -64 + 64);
  root.addChild(room, code, cat);
  app.stage.addChild(root);

  let palette = PALETTES.light;
  let frame = 0;
  let elapsed = 0;
  let catAlive = true;

  const fit = () => {
    const { width, height } = app.screen;
    const zoom = Math.max(
      1,
      Math.floor(Math.min(width / ROOM.width, height / ROOM.height) * 0.92 * 2) / 2,
    );
    root.scale.set(zoom);
    root.position.set(Math.round(width / 2), Math.round(height / 2));
  };

  const animate = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS;
    if (elapsed < 250) return;
    elapsed = 0;
    frame += 1;
    drawCode(code, palette, frame);
    if (catAlive) drawCat(cat, frame);
  };
  app.ticker.add(animate);

  drawRoom(room, palette);
  drawCode(code, palette, 0);
  drawCat(cat, 0);
  fit();

  return {
    resize(width, height) {
      app.renderer.resize(Math.max(1, width), Math.max(1, height));
      fit();
    },
    setActive(active) {
      if (active) app.ticker.start();
      else app.ticker.stop();
    },
    update(world) {
      palette = PALETTES[world.theme];
      catAlive = world.catAlive;
      drawRoom(room, palette);
      drawCode(code, palette, frame);
      cat.visible = catAlive;
      if (catAlive) drawCat(cat, frame);
      app.render();
    },
    destroy() {
      app.ticker.remove(animate);
      app.destroy({ removeView: true }, { children: true, texture: true });
    },
  };
}
