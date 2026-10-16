/**
 * Dev utility for P11.3 (not a test): measure the production preview in headless Chromium.
 * Usage: npx vite-node tools/measure.ts   (preview running on 127.0.0.1:4173)
 *
 * Desktop headless numbers (software GL) are NOT phone measurements; they show regressions
 * and orders of magnitude only. GPU memory is estimated from live atlas/render-target sizes.
 * Transfer sizes come from `npm run build` (vite preview sends no content-length when gzipping).
 */
import { chromium } from '@playwright/test';
import { progressedRun, saveText } from '../tests/browser/fixtures';

const URL = 'http://127.0.0.1:4173/';
const browser = await chromium.launch();

async function measure(label: string, save: string | null, seconds = 6) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.addInitScript((text) => {
    if (text) localStorage.setItem('vibe-coder.save', text);
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__long.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  }, save);
  const t0 = Date.now();
  await page.goto(URL);
  await page.getByTestId('primary-action').waitFor();
  const interactiveMs = Date.now() - t0;
  await page.getByTestId('world-canvas').waitFor();
  await page.waitForTimeout(1500);
  const result = await page.evaluate(async (s) => {
    const deltas: number[] = [];
    let last = performance.now();
    await new Promise<void>((resolve) => {
      const end = last + s * 1000;
      const frame = (t: number) => {
        deltas.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    deltas.sort((a, b) => a - b);
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="world-canvas"]');
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      frames: deltas.length,
      p50: deltas[Math.floor(deltas.length * 0.5)] ?? 0,
      p95: deltas[Math.floor(deltas.length * 0.95)] ?? 0,
      canvas: canvas ? [canvas.width, canvas.height] : null,
      sprites: canvas?.dataset.sprites ?? null,
      heapMiB: memory ? memory.usedJSHeapSize / 1048576 : null,
      longTasks: (window as unknown as { __long: number[] }).__long,
    };
  }, seconds);
  const [w = 0, h = 0] = result.canvas ?? [];
  // Resident GPU estimate: one 512×256 RGBA atlas per loaded theme + the drawing buffer.
  const atlasBytes = 512 * 256 * 4;
  const backBuffer = w * h * 4 * 2;
  console.log(
    JSON.stringify({
      label,
      interactiveMs,
      rafIntervalMs: {
        p50: +result.p50.toFixed(1),
        p95: +result.p95.toFixed(1),
        frames: result.frames,
      },
      longTasks: result.longTasks.length,
      longestTaskMs: Math.round(Math.max(0, ...result.longTasks)),
      canvas: result.canvas,
      sprites: result.sprites,
      jsHeapMiB: result.heapMiB === null ? null : +result.heapMiB.toFixed(1),
      gpuEstimateMiB: +((atlasBytes + backBuffer) / 1048576).toFixed(2),
    }),
  );
  await context.close();
}

await measure('cold start', null);
await measure('late world (28 technologies)', saveText(progressedRun(28)));
await browser.close();
