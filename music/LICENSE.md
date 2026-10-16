# Music licensing

The game's code is licensed under Apache-2.0 (`../LICENSE`). **That license does not cover
musical works.** Every composition file declares its own license in its `license` field:

| License     | Meaning                  | Requirement                                                                             |
| ----------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `CC0-1.0`   | Public-domain dedication | none                                                                                    |
| `CC-BY-4.0` | Attribution              | an `attribution` field naming the author (the validator rejects CC BY files without it) |

Current material:

- `motif/demo-main.json` and the four `patterns/*/*-demo-*.v1.json` files are **temporary demo
  material** written for this repository's infrastructure stage, dedicated under `CC0-1.0`. They
  are labelled `demo: true` / motif `status: "demo"` and are not the approved soundtrack.
- `patterns/*/rpg-*.v1.json` are adapted from **"15 Melodic RPG Chiptunes" by Aureolus_Omicron**
  (<https://opengameart.org/content/15-melodic-rpg-chiptunes>), dedicated under `CC0-1.0`; the
  source MIDI files are kept in `sources/rpgchip/`. CC0 needs no credit; each file still names
  the author in `attribution`, and the material is never presented as original work.
- `patterns/*/cy-*.v1.json` are adapted from public-domain / CC0 tracker modules (The Mod Archive
  "Public Domain" licence, and OpenGameArt CC0); author, title and link for each are in
  `sources/cyber/README.md` and in every file's `attribution`. The modules are kept unmodified
  in `sources/cyber/`.
- Era, preset, arrangement and schema files are configuration and are covered by Apache-2.0
  with the code.

Only submit material you created or have the right to license this way; third-party melodies
are never presented as original work. The published pack (`src/music/data/pack.*.json`) carries
each included revision's license, attribution and content hash.
