# Art sources and export

All game art is authored as TypeScript in this directory and exported by one command:

```bash
npm run art:export   # writes public/assets/ (generated; never edit by hand)
npm run art:check    # fails if public/assets/ is stale (part of npm run check:content)
```

- `lib/` — pixel canvas, shapes with automatic outline, 3×5 font, deterministic PNG encoder,
  shelf packer. No proprietary editor is needed.
- `palette.ts` — named colors with `light` and `dark` variants. Every sprite is drawn once per
  theme from the same source (theme never depends on progression).
- `sprites/` — world/DOM animations: the cat (poses → frames; `cat-round-*` overfed variants),
  room, programmer, and the reusable machine kit (`kit-*` detailed, `lod-*` compact icons).
- `illustrations/` — one 128×96 illustration per technology plus the two memorial photos.
- `social.ts` — link-preview art for `index.html`: the 1200×630 Open Graph card (`social/og.png`)
  and the cat favicon/apple-touch-icon, composed from the sprites above.

## Atlas contract (`vibe-atlas/1`)

`sprites-<theme>.json` next to `sprites-<theme>.png`:

```json
{
  "format": "vibe-atlas/1",
  "image": "sprites-light.png",
  "size": { "w": 512, "h": 256 },
  "frames": { "cat-idle-0": { "x": 0, "y": 0, "w": 24, "h": 18 } },
  "animations": { "cat-idle": { "frames": ["cat-idle-0", "cat-idle-1"], "frameMs": 600 } }
}
```

Frames of one animation are contiguous left-to-right (DOM sprites step through them with CSS).
`src/content/atlas.ts` validates this contract and adapts it to Pixi's spritesheet schema; the
same tag animates identically on the canvas and in DOM. A developer preview of any sprites:
`npx vite-node tools/art/preview.ts -- out.png 4 cat-`.
