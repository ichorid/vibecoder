# Cyber / demoscene tracker modules (source)

Public-domain / CC0 XM and MOD modules, unmodified, downloaded 2026-10-16.

- The Mod Archive modules are listed there as "Licensed under the Public Domain license" (the
  Creative Commons public-domain dedication); each was checked on its own module page. They are
  recorded as `CC0-1.0` in the patterns, the closest licence our schema has.
- `congusbongus-*` come from OpenGameArt, dedicated under CC0.
- Covers of other people's music were left out even when uploaded as public domain.
- No credit is required; every pattern still names its author and source in `attribution`.

| File                             | Title              | Author       | Source                                                                                    | MD5                                |
| -------------------------------- | ------------------ | ------------ | ----------------------------------------------------------------------------------------- | ---------------------------------- |
| `m0d-the-red-one.mod`            | the-red-one        | m0d          | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=53326)  | `1bcc575e48bd0dd57b88ce397be4ec91` |
| `m0n50n-l3v3l-33.xm`             | L3V3L_33           | M0n50n       | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=172183) | `06f37528b926f5863925d9fd49a662ce` |
| `drozerix-digital-rendezvous.xm` | Digital Rendezvous | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=180821) | `6e8306d6c451188265880279c170bdb9` |
| `drozerix-keygen-9000.xm`        | Keygen 9000        | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=173938) | `02b1f1dad70ea15a0b064c45468caa55` |
| `congusbongus-subterrain.xm`     | Subterrain         | congusbongus | [OpenGameArt](https://opengameart.org/node/125360)                                        | `1ba6793fdacbf9e6a65f3126807e8c70` |
| `drozerix-crush.xm`              | Crush              | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=179581) | `1613a27c819396c6d4e74b426c21a36a` |
| `m0n50n-augmented-emotions.xm`   | Augmented_Emotions | M0n50n       | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=172184) | `ef0be06e68e4fbadeb7ee98de4a0ad93` |
| `drozerix-cyber-spider.xm`       | Cyber Spider       | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=192354) | `e6b3ba7081a3e1dbaaa27a73c82e0f67` |
| `m0d-absolute-xtc.mod`           | absolute xtc       | m0d          | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=32703)  | `b469eff4815190764685bdbe1580ba39` |
| `drozerix-computer.xm`           | Computer F***!     | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=175021) | `9e5bb079842b13012c3c61a77bfee29a` |
| `drozerix-neon-techno.mod`       | Neon Techno        | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=178172) | `5e4b2a67a1ce6ab5f65ac0a511bc681c` |
| `katiecadet-bassline-techno.xm`  | Bassline Techno    | Katie Cadet  | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=175335) | `ef1a7df2b04a61eb5e36c0694c543cb7` |
| `congusbongus-midnight-drive.xm` | Midnight Drive     | congusbongus | [OpenGameArt](https://opengameart.org/content/midnight-drive)                             | `4b74008a72746e2ffc6e59b4e587f2a4` |
| `m0d-retrospective.mod`          | retrospective      | m0d          | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=65133)  | `2ce6195d55482f79cb5c112891c25794` |
| `drozerix-key-generators.xm`     | Key Generators     | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=173939) | `e91dbc23d3c78cab56447c4015aeec25` |
| `drozerix-fluxchip.xm`           | Fluxchip (skipped) | Drozerix     | [The Mod Archive](https://modarchive.org/index.php?request=view_by_moduleid&query=200310) | `e9e3b98cce8f6c655bd565c137e5da77` |

`plan.json` assigns each module to an era by measured features (major/minor and its colour,
tempo, density, drums; see each `mood`). `npm run music:import` writes the `cy-*` candidate
patterns; see `music/README.md` → "Imported CC0 songs".
