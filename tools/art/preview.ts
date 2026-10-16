/** Dev utility: write a scaled preview sheet of given sprite tags. `vite-node tools/art/preview.ts -- out.png scale` */
import { writeFileSync } from 'node:fs';
import { createCanvas } from '../../art/lib/canvas';
import { encodePng } from '../../art/lib/png';
import { allSprites } from '../../art/sprites';
import { light, dark } from '../../art/palette';

const [out = 'preview.png', scaleArg = '4', filter = ''] = process.argv
  .slice(2)
  .filter((a) => a !== '--');
const scale = Number(scaleArg);
const rows = [light, dark].flatMap((pal) => allSprites(pal).filter((s) => s.tag.includes(filter)));
const width = Math.max(...rows.map((s) => s.frames.reduce((w, f) => w + f.width + 2, 0)));
const height = rows.reduce((h, s) => h + Math.max(...s.frames.map((f) => f.height)) + 2, 0);
const sheet = createCanvas(width * scale, height * scale);
sheet.rect(0, 0, sheet.width, sheet.height, '#777777');
let y = 0;
for (const sprite of rows) {
  let x = 0;
  for (const frame of sprite.frames) {
    for (let fy = 0; fy < frame.height; fy += 1) {
      for (let fx = 0; fx < frame.width; fx += 1) {
        const px = frame.get(fx, fy);
        if ((px[3] ?? 0) > 0)
          sheet.rect((x + fx) * scale, (y + fy) * scale, scale, scale, [
            px[0] ?? 0,
            px[1] ?? 0,
            px[2] ?? 0,
            255,
          ]);
      }
    }
    x += frame.width + 2;
  }
  y += Math.max(...sprite.frames.map((f) => f.height)) + 2;
}
writeFileSync(out, encodePng(sheet));
console.log(`wrote ${out} (${rows.length} sprites)`);
