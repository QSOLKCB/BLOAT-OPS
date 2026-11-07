# Verification and engineering handoff

## v0.2.0 candidate: engine update, controllers, checkpoints, replays and the Architect (7 November 2026)

Local checks on a Linux x64 container with Node v22.23.4 (CI uses Node 24.22.1) and headless Chromium 153 with SwiftShader. Read remote CI and Codex review status on the PR for its exact final commit. No deployment is claimed.

### Executed checks

- `node tools/check.mjs`: 36 syntax checks, 30 asset hashes, and **9 imported engine files match `docs/UPSTREAM_IMPORT.json`**. This last check is new; a deliberate one-byte edit to `pmove.js` made it fail.
- `node --test tests/*.test.mjs`: **36 passed, 0 failed**. New suites:
  - `input.test.mjs`: deadzone, neutral arming, controller swap, edges, menu repeat and clock pacing. The clock test fails on the previous clock: 1,200 zero-tick and 1,200 two-tick frames per minute at 60 Hz.
  - `checkpoint.test.mjs`: restores through JSON at every 150th tick and every objective boundary, with identical raw state on every later tick. It also covers replay validation and verification.
  - Boss tests in `simulation.test.mjs`.
- `node tools/build.mjs`: the standalone build has 23 modules, 29 embedded resources, 7,111,172 bytes.
- `node tools/browser-check.cjs`: **HTTP and offline both passed**, with zero console errors, WebGL error 0 and replay digest `bf71e949` in Chromium (equal to Node).
- `node tools/benchmark.mjs`: 2,814 ticks; mean 0.012–0.021 ms per tick; p95 0.030–0.055 ms; startup 82.8 ms.

### Engine update: exactness and measurements

- `tools/parity-ab.mjs` replayed the v0.1.0 mission fixture through `fe5928e` and the updated engine in one Node process, before the boss changed the mission. The raw unrounded snapshot hash was **identical after every tick**, and the simulation was **1.21×** faster (median 37.3 → 30.9 ms over 7 alternating runs).
- `tools/render-ab.cjs` rendered 18 frames (3 replay states × 6 views) **byte-identical** to `fe5928e`, before and after the boss work.
  - Frustum culling was active in those views: brush draws fell from 21 to 5–15 and model draws from 3 to 1–3.
  - Render CPU time in SwiftShader showed **no reliable change**: two runs measured 0.178 → 0.149 ms and 0.164 → 0.172 ms per frame. No native-GPU measurement exists.

### Controllers, checkpoints and replays (Chromium, scripted standard gamepad)

- **Controller:**
  - the first D-pad press focused BEGIN OPERATION with a visible ring;
  - A held through the start did not jump;
  - the sticks moved the player (+136 units) and turned the view;
  - two RT presses fired exactly two pistol shots;
  - Start paused and resumed, B resumed, and a `gamepaddisconnected` event paused;
  - the pause menu reached settings and returned via the pad.
- **Timing caveat:** with 90 ms presses, one B press was missed between SwiftShader frames. 250 ms presses passed. Real 60 Hz hardware polls every 16 ms.
- **Replay and checkpoint flows:**
  - a keyboard run exported from the pause screen validated and reproduced its digest in Node;
  - a checkpoint saved at the first objective restored after defeat with an identical digest;
  - the mission fixture imported as **REPLAY VERIFIED** and played back;
  - a file with an unknown input field was rejected with the input index and could not be watched.

### Golden replay change (explained)

The Architect intentionally changes the mission. `tools/record-fixture.mjs` produces normal inputs only and never overrides state. It now targets extraction at stage 7 and falls back to pistol presses if rifle ammunition runs out.

The new fixture is a victory at **2,814 ticks** with 30 kills (27 + Architect + 2 adds), 207 shots, 24 damage taken, 3 activations and 5 stuns. Final digest `bf71e949`, input SHA-256 recorded in the fixture. Snapshot version 3 adds `phase2` only for enemies that have it.

### Not verified

Physical controllers, human boss balance and mission duration, Firefox/WebKit, native-GPU performance, real-browser offline reload of checkpoints (they are in-session only), and audible output.

---

Local checks executed 27 October 2026 (Australia/Adelaide) for the pistol/rifle/grenade update. Read remote CI and review status on the PR for its exact current commit. No new deployment is claimed by these local results.

## Executed checks

- **24 simulation tests passed**, zero failures: geometry/navigation, collision, deterministic replay, AI, stun recovery, objectives and terminal states, plus pistol click/hold/batched-press behaviour, rifle pickup/ownership and select fire, grenade gravity/impact/fuse/ammo/cooldown, and pistol switching preserving automatic rifle cadence. [Full test log](evidence/simulation-tests.txt).
- **30 JavaScript syntax checks and 30 asset hashes passed**; all models/textures parsed. [Static log](evidence/static-checks.txt).
- Chromium HTTP `/BLOAT-OPS/` and standalone `file:` browser checks passed, with HTTP(S) blocked offline. Real keyboard/mouse checks cover quick clicks, held pistol, unavailable rifle selection, pickup, automatic fire, B selector, semi-auto hold, RMB grenades, pause, rebound stun key, full replay victory, restart and defeat. Complete NOTICE text remains tested in both modes.
- No console/resource errors or external runtime requests; WebGL error zero. [Browser report](evidence/browser.json).
- Standalone rebuilt and tested: **6,646,305 bytes**, 21 source modules, 29 embedded resources. [Hash receipt](evidence/standalone.json).
- [Pistol screenshot](screenshots/pistol.png) and [rifle screenshot](screenshots/combat.png) were captured from the tested HTTP application and visually inspected.

## Replay revision and deterministic boundary

The gameplay change deliberately replaces the old cannon/held-rifle input fixture. Snapshot and recording schema version 2 adds owned-rifle state, rifle mode, press counts, trigger latches, launcher cooldown and grenade gravity. The development controller uses normal inputs to clear intake with the pistol, collect the rifle, fire grenades, complete objectives and extract. It does not override gameplay state. Individual unit/browser fixtures separately arrange boundaries for focused checks.

Current retained input SHA-256: `9dd1ec04652f860a332d38223d4c1659325d3df6806184852a5936a2f2e4b8df`. Final quantized digest: **`9a07e324`**. Victory at **2,367 ticks** (39.45 simulated seconds), 27 kills, 141 shots, 24 damage taken, 3 ability activations and 5 stunned targets. Every 300-tick checkpoint is retained. The prior fixture and evidence remain in git history; this is an intentional gameplay revision, not a digest-only update to conceal a failure.

Raw snapshots repeat exactly within tested Node and within tested Chromium; fractional digest values are rounded to 1e-6 for cross-runtime comparison. Cross-platform bitwise floating-point determinism is not claimed. Fast input queues are bounded to eight presses per simulation tick; pause/restart discards pending browser presses.

## Performance environment and limits

Shared Linux x64 container, AMD EPYC 9V74 (9 reported logical CPUs, 8 available), 9.73 GiB reported RAM, Node v24.22.1. Local Playwright 1.62.1 drives Chromium headless shell 134.0.6998.35 with ANGLE Vulkan SwiftShader software rendering. CI separately uses pinned Playwright 1.56.1 on Ubuntu 24.04.

Five complete-mission headless runs after warm-up averaged **0.0195–0.0393 ms/tick**. Startup geometry/navigation: 95.6 ms. Raw [performance data](evidence/performance.json) retains p95 and maxima. Browser measurements use 90 render calls plus HUD and gl.finish at 1440×900 on a replayed encounter: HTTP mean 1.92 ms, offline mean 2.31 ms. These are bounded workload measurements, not end-to-end FPS, comparative optimization claims or native-GPU certification.

Human balance, the intended 5–10 minute first-run duration, Firefox/WebKit/native GPU coverage and improved enemy weapon attachment remain unverified. The perfect-aim controller is not representative of human playtime. The new pistol/launcher meshes are original simple brush geometry; the rifle retains the verified Quaternius mesh. No reload system, boss, summoner, checkpoints, multiplayer, touch or gamepad support is claimed. See [instructions](../INSTRUCTIONS.md), [architecture](../ARCHITECTURE.md), [licences](../ASSET_LICENSES.md), [roadmap](../ROADMAP.md) and [proposed release notes](../RELEASE_NOTES.md).

## Enemy weapon attachment correction

The renderer no longer overlays a separate rifle/shotgun at each enemy's torso. The Harvester keeps the pistol already present in its licensed source mesh. The Manager now includes that same CC0 pistol, transferred in the offline converter using named skeleton joints and the pistol's original inverse bind matrices. Its original body normalization is preserved. Both weapons interpolate with the character's sampled poses, including stun and death.

All six pinned conversion inputs were checked against the existing source SHA-256 receipts. Only the Manager's converted model, palette and metadata changed; its manifest receipts and combined provenance were updated. The Manager adds 1,040 triangles and 322,768 MDL bytes. No gameplay or replay fixture changed.

Local validation: syntax/model/hash checks, all 24 unit tests, standalone build, and Chromium HTTP/offline integration checks. The mission replay remains `9a07e324`. Both enemy types were visually inspected at idle, run, attack, stun and death poses in Chromium; [attack-pose capture](screenshots/enemy-weapons.png) shows the weapons in their hands without the torso overlays. The capture is an arranged visual fixture, not a new gameplay replay.
