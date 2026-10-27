# Architecture

BLOAT-OPS imports selected engine systems from QSOLKCB/QwakeTF commit `a1f7dbbd2dc34bb29b179042eb22cfe4bd411815`. QwakeTF itself is not modified. The import receipt is [docs/UPSTREAM_IMPORT.json](docs/UPSTREAM_IMPORT.json).

## Retained engine

`src/engine/` contains brush geometry, swept hull collision and spatial queries (`world.js`), Quake-style acceleration/air control/step-slide/jump movement (`pmove.js`), vector/matrix math, WebGL2 rendering, lightmap baking, MDL parsing, positional Web Audio, and A* navigation. The renderer supports the converted models' CCW winding, reuses dynamic-light arrays and avoids evaluating world-space dynamic lights against local-space brush vertices. Audio nodes disconnect after playback. Navigation sampling is 64 units for the wider factory aisles. `defs.js` retains only collision dimensions; unseeded random helpers were removed from math.

QwakeTF's CTF rules, nine-class system, original map, bot roles, weapon inventory, UI and HUD were inspected but are not copied into the new game layer. Their team/game-specific coupling and shared unseeded random calls would complicate the mission and deterministic authority boundary. The low-level movement, collision, renderer and navigation remain the reused systems.

## Game layer

- `src/game/level.js`: five original industrial sectors, cover, lights, signs, gates, spawns, supply points and finite encounter definitions.
- `simulation.js`: authoritative tick state, player physics, damage, supplies, terminal outcomes and snapshots.
- `enemies.js`: two defined enemy roles, bounded navigation, attack wind-up, projectile firing, stun recovery and separation.
- `weapons.js`: seeded pistol/rifle spread, swept hitscan/projectile collision, splash visibility and ammunition.
- `ability.js`: charge/cost, 240-tick effect, 180-tick stun, 360-tick post-stun immunity and 900-tick cooldown.
- `objectives.js`: ordered mission state machine, two-second interactions, three finite final waves, extraction.

Every simulation tick is 1/60 second. The order is input normalization → tick increment/aim/weapon selection → player movement → ability activation → player weapon fire → enemies in stable ID order → projectiles in insertion order/damage → weapon pickup/supplies → objectives → gate state. Dead players end the update before objective progression. Timers use integer ticks. Render frames feed an accumulator; long stalls are clamped to 250 ms (15 ticks), causing deliberate slow motion instead of an unbounded catch-up loop. Pausing/blur resets the accumulator and input state.

Each simulation has independent collision visitation stamps and gate movers. Static geometry and navigation data can be reused. Render updates do not alter simulation state. Cosmetic particles use a separate seeded generator. The game layer does not call `Math.random`, `Date` or `performance`.

## Replay contract

A replay is an initial seed plus one command per simulation tick. `window.bloat.exportReplay()` returns the current run (bounded to 36,000 commands, ten minutes; a truncation flag makes longer exports explicit). The retained complete-mission fixture has no teleports, invulnerability, health overrides or objective shortcuts. Its development-only controller generates normal commands and is not included in the runtime.

Raw snapshots repeat exactly within each tested runtime. State digests use FNV-1a over a stable JSON snapshot, rounding non-integral values to **1e-6** world units/degrees before hashing. Integer IDs, counters, timers and objectives remain exact. This is a regression checksum, not a cryptographic provenance signature.

The raw Node/Chromium comparison exposed a final player-coordinate difference of approximately `5.68e-14`; the mission status, tick count and combat totals matched. Quantized checkpoint digests provide a useful equivalent-state check while the tests separately require exact raw repeatability within each runtime. Cross-platform bitwise floating-point determinism is **not** claimed. Assets and original inputs use SHA-256 for provenance.

## Presentation and assets

`main.js` connects input/UI, fixed-clock stepping, events, rendering and audio. `hud.js`, `effects.js`, `sound.js` and `assets.js` keep presentation separate. The 3D level is lightmapped once at startup and grouped by texture. World props reuse brush meshes. There are no runtime dependencies.

Quaternius glTF skins are sampled offline into 35 animation poses per character (idle, run, attack, hit reaction, death), converted to QwakeTF's compact MDL delivery format with per-model colour palettes. This avoids shipping a skeletal runtime/FBX loader. Source URLs, original file hashes, converted hashes, clip names and quantization precision are retained. Guns are converted from genuine OBJ meshes. Enemy held guns use an approximate separate transform, not skeletal hand attachments; improvements belong in the roadmap.

Limits: 32 live enemy objects, 96 projectiles, 600 cosmetic particles, 128 events per tick, capped tracers, staggered per-enemy path recomputation and bounded replay/performance history. The mission itself spawns 27 enemies across seven encounters. There is no dependency summoner or boss in v0.1.0.

## Packaging

The source is an ordinary static application with relative URLs. `tools/build.mjs` embeds modules/resources into one HTML file, constructing local Blob-module URLs. It does not transpile or use an external bundler. CI verifies both HTTP `/BLOAT-OPS/` play and the exact standalone output. Only tested main can enter the Pages deployment job after maintainer merge.

## Weapon input revision

The player begins with PATCH-9; rifle ownership is granted by the intake pickup after the initial encounter. Primary fire distinguishes held input from bounded press counts (0–8 per tick), preserving down/up events between rendered frames. `updateWeapons` owns edge inference for headless inputs, semi/auto selection and firing order (mode, primary, alternate). Semi-auto presses have no cadence delay; rifle automatic fire is tick-capped. Alternate fire requires the equipped rifle and consumes a separate reserve; projectile position uses constant-gravity integration and swept collision, with impact/fuse detonation. Snapshot version 2 records ownership, mode, trigger latches, grenade cooldown and gravity. The version-2 input fixture deliberately replaces the obsolete cannon/hold-fire recording; it is regenerated through normal input commands, never state overrides.
