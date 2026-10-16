# Composition guide

For human and agent composers. The rules here are what `npm run music:validate` and the Lab
check; `npm run music:prompt -- --era <id>` turns them into a self-contained task.

## The data contract

- One pattern = one JSON file `patterns/<era>/<id>.v<revision>.json` valid against
  `PATTERN_SCHEMA.json` (`schemaVersion: 1`, no unknown fields).
- **Time is in steps**, never milliseconds: an era's clock (e.g. 120 BPM, 4/4, 4 bars × 16 steps
  = 64 steps = 8 s) is shared by every pattern of the bank. Events: `{ "type": "note", "step",
"length", "pitch", "velocity"? }` or `{ "type": "drum", "step", "length", "sound":
"kick"|"snare"|"hat" }`. A note may end exactly on the last step, never after it.
- `harmony` spans cover the whole pattern without gaps or overlaps; chords are Tonal names (`C`,
  `Am`, `Bbm`, `G7`…). Non-chord and chromatic tones are **warnings**: fine when intended.
- Tracks are roles: `lead`, `bass`, `arp`, `percussion`. Each role has the preset range and
  polyphony of the era's default arrangement (run `music:prompt` to see them). Out-of-range notes
  and monophonic overlaps are errors. At most 8 voices sound at once.
- `boundary`: enter on `tonic`; exit on `tonic` or `dominant`, so any two patterns of the bank can
  follow each other in any order (the shuffle-bag plays each once per cycle).
- `motifRef` names the shared motif; transform it recognisably (mode, register, rhythm, density).
- `energy` 0–1 describes intensity; `metadata.description` / `metadata.composer` are notes for
  people and do not affect the content hash.
- `license`: `CC0-1.0`, or `CC-BY-4.0` with `attribution`. `demo: true` only for temporary demos.

## Versions and reviews

Never edit a file that has been reviewed: add `revision + 1` as a new file. Reviews are separate
records keyed by `id@revision#sha256` of the canonical payload (pattern without `metadata` + era +
motif + era default arrangement + presets of the roles you use). Composers never approve their own
work; a human does in the Lab.

## Similarity

`music:validate` compares patterns of one bank: identical music under two IDs is an **error**;
an unchanged revision and near variants (same rhythm, pitch-class distribution and contour) are
**warnings**. Sharing the motif is expected and is never enough to be flagged.

## Checklist before handing back

```sh
npm run music:validate -- --era <id>   # exit 0, every warning read
npm run test:music
npm run dev:music-lab                  # listen: Single, then Transition against neighbours
```
