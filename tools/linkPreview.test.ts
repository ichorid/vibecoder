import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPngSize } from '../art/lib/png';
import { outputs } from './art/build';

const html = readFileSync('index.html', 'utf8');
const art = outputs();

function meta(property: string): string {
  const match = new RegExp(`<meta\\s+(?:property|name)="${property}"\\s+content="([^"]*)"`).exec(
    html,
  );
  if (!match?.[1]) throw new Error(`index.html has no ${property}`);
  return match[1];
}

/** The exported PNG behind a page URL under assets/. */
function exported(url: string): { width: number; height: number } {
  const file = url.replace(/^(%SITE_URL%|\/)assets\//, '');
  const bytes = art.get(file);
  if (!bytes) throw new Error(`${url} is not an exported art file`);
  return readPngSize(bytes);
}

describe('link previews', () => {
  it('point og:image at the exported card with its real size, by absolute URL', () => {
    const image = meta('og:image');
    expect(image.startsWith('%SITE_URL%')).toBe(true);
    expect(exported(image)).toEqual({
      width: Number(meta('og:image:width')),
      height: Number(meta('og:image:height')),
    });
    expect(meta('twitter:card')).toBe('summary_large_image');
  });

  it('link the exported icons at their declared sizes', () => {
    const href = (rel: string) =>
      new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`).exec(html)?.[1];
    expect(exported(href('icon') ?? '')).toEqual({ width: 32, height: 32 });
    expect(exported(href('apple-touch-icon') ?? '')).toEqual({ width: 180, height: 180 });
  });

  it('describe the game the same way to every scraper', () => {
    expect(meta('og:description')).toBe(meta('description'));
  });
});
