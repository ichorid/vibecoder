/**
 * Dev utility (not a test): render demo contact sheets to PNG for looking at the generator.
 * Usage: npx vite-node tools/demoSheet.ts -- [--mode seeds|lineage|anim|webs] [--seed 1]
 *        [--count 24] [--step 0.4] [--out demo-sheet.png]
 * `seeds`: first demos of consecutive seeds; `lineage`: demos 1…count of one run (each the
 * judge's pick after the last); `anim`: one demo over time, `--step` seconds apart (trails
 * included); `webs`: first demos that came out as web forms.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { firstDemo, genomeOf } from '../src/demo/judge';
import { createDemoCanvas, DEMO_H, DEMO_W, drawDemo } from '../src/demo/raster';
import { subSeed } from '../src/demo/rng';

const args = process.argv.slice(2).filter((a) => a !== '--');
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? (args[i + 1] as string) : fallback;
};
const mode = flag('mode', 'seeds');
const seed = Number(flag('seed', '1'));
const count = Number(flag('count', '24'));
const out = flag('out', 'demo-sheet.png');
const step = Number(flag('step', '0.4'));

const frames: Uint32Array[] = [];
if (mode === 'seeds') {
  for (let i = 0; i < count; i++) {
    const c = createDemoCanvas(firstDemo(subSeed(seed, i)).genome);
    drawDemo(c, 3, { trails: false });
    frames.push(c.rgba.slice());
  }
} else if (mode === 'lineage') {
  const seeds = Array.from({ length: count }, (_, i) => ({
    seed: subSeed(seed, 1000 + i),
    pick: null,
  }));
  const t0 = performance.now();
  for (let n = 1; n <= count; n++) {
    const c = createDemoCanvas(genomeOf(seeds.slice(0, n)));
    drawDemo(c, 3, { trails: false });
    frames.push(c.rgba.slice());
  }
  console.log(`lineage: ${((performance.now() - t0) / count).toFixed(1)} ms per demo`);
} else if (mode === 'webs') {
  for (let i = 0; frames.length < count && i < 5000; i++) {
    const { genome } = firstDemo(subSeed(seed, i));
    if (genome.root.child.prim === 'ball' || genome.root.child.kind !== 'layers') continue;
    const c = createDemoCanvas(genome);
    drawDemo(c, 3, { trails: false });
    frames.push(c.rgba.slice());
  }
} else {
  // 25 frames per second, one picture every `step` seconds
  const c = createDemoCanvas(firstDemo(seed).genome);
  const every = Math.max(1, Math.round(step * 25));
  for (let f = 0; f < count * every; f++) {
    drawDemo(c, f / 25);
    if (f % every === every - 1) frames.push(c.rgba.slice());
  }
}

// Grid of frames, 2× zoom, 2 px gaps.
const cols = 4,
  zoom = 2,
  gap = 2;
const rows = Math.ceil(frames.length / cols);
const w = cols * (DEMO_W * zoom + gap),
  h = rows * (DEMO_H * zoom + gap);
const raw = Buffer.alloc((w * 3 + 1) * h, 40);
for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
frames.forEach((rgba, k) => {
  const ox = (k % cols) * (DEMO_W * zoom + gap),
    oy = Math.floor(k / cols) * (DEMO_H * zoom + gap);
  for (let y = 0; y < DEMO_H * zoom; y++) {
    for (let x = 0; x < DEMO_W * zoom; x++) {
      const c = rgba[Math.floor(y / zoom) * DEMO_W + Math.floor(x / zoom)] ?? 0;
      const o = (oy + y) * (w * 3 + 1) + 1 + (ox + x) * 3;
      raw[o] = c & 255;
      raw[o + 1] = (c >> 8) & 255;
      raw[o + 2] = (c >> 16) & 255;
    }
  }
});

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 255] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(`wrote ${out} (${frames.length} frames)`);
