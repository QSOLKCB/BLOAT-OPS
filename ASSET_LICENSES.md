# Asset provenance and permissions

The code is Apache-2.0. Assets retain their own licences. Nothing here grants rights to commercial Quake/Team Fortress data. No commercial game data, Quaternius paid pack, Poly Haven asset or unverified discovery-directory item is shipped.

## Integrated models — Quaternius / CC0 1.0

Verified against each official pack page and its actual downloadable `License.txt`. The original notices are retained under `assets/licenses/`. The women's pack currently supplies a notice labelled “Ultimate Modular Males”; its CC0 terms are preserved verbatim, and the women's official page independently identifies CC0.

| Pack / author | Selected original | Runtime asset | Usage |
|---|---|---|---|
| [Ultimate Guns / Quaternius](https://quaternius.com/packs/ultimategun.html) | `AssaultRifle_1.obj` + `.mtl` | `rifle.mdl`, `.pal`, `.json` | Dependency Remover, first-person and held enemy weapon |
| Same gun pack | `Shotgun_4.obj` + `.mtl` | `cannon.mdl`, `.pal`, `.json` | Fictional explosive Refactor Cannon, first-person and held enemy weapon |
| [Ultimate Modular Men / Quaternius](https://quaternius.com/packs/ultimatemodularcharacters.html) | `Swat.gltf` | `harvester.mdl`, `.pal`, `.json` | Telemetry Harvester, animated |
| [Ultimate Modular Women / Quaternius](https://quaternius.com/packs/ultimatemodularwomen.html) | `Suit.gltf`, local input name `SuitWoman.gltf` | `manager.mdl`, `.pal`, `.json` | Middleware Manager, animated |

Licence: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Credit is given voluntarily; no endorsement is implied. These are actual downloaded meshes, not stand-in geometric characters. The converter preserves material colours, joins character parts and samples `Idle_Gun`, `Run`, `Gun_Shoot`, `HitRecieve` and `Death` animations. Stun holds the sampled hit-reaction pose. The existing engine's compact animated MDL format was selected instead of introducing a new browser glTF skeletal loader. Position quantization error is recorded per model. Original gun source files are included; complete glTF originals are available from the exact public URLs and SHA-256 receipts in the manifest.

## Integrated textures — LibreQuake / BSD-3-Clause

All seven textures were copied byte-for-byte from QwakeTF commit `a1f7dbbd2dc34bb29b179042eb22cfe4bd411815`, whose bundled LibreQuake notice specifies BSD-3-Clause for models, textures, sounds and graphics. No LibreQuake QuakeC, `progs.dat`, `pop.lmp` or other GPL game code is imported.

| Runtime name | Upstream filename |
|---|---|
| `concrete.png` | `t_wall2a.png` |
| `floor.png` | `treadplatemetal.png` |
| `wall.png` | `t_wall1a.png` |
| `ceiling.png` | `t_metalsheeta.png` |
| `steel.png` | `met_gry_flat.png` |
| `server.png` | `comp1_1.png` |
| `hazard.png` | `t_trim1a.png` |

Copyright © 2019–2023 Contributors to the LibreQuake project. All rights reserved. The full BSD conditions and disclaimer are in [COPYING](assets/licenses/librequake/COPYING), with [CREDITS](assets/licenses/librequake/CREDITS) and the original [licence scope notice](assets/licenses/librequake/README-IMPORTANT-LICENCE-INFO). These must accompany redistributed source and binary/standalone builds. The standalone embeds the complete notice and exposes it from Credits.

## Original content

Factory brush geometry, signage, interface, effect textures, pickup geometry and synthetic Web Audio effects were created for BLOAT-OPS under the code's Apache-2.0 licence. They are procedural code-native content, not external image or sound imports. No external fonts or runtime hotlinks are required.

## Receipts

[assets/manifest.json](assets/manifest.json) records original authors, exact public source links, original input sizes/SHA-256 values, converted/runtime sizes/SHA-256 values and conversion notes. [assets/sources.json](assets/sources.json) records aliases. `node tools/check.mjs` verifies the retained assets against this manifest. Full model and texture loading is additionally checked in a browser; a missing required asset aborts startup visibly.
