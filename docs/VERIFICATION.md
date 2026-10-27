# Verification and engineering handoff

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
