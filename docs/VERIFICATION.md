# Verification and engineering handoff

Local verification completed 27 October 2026 (Australia/Adelaide). This document reports executed checks. Remote CI and reviewer approval must be read from the PR for its exact current commit; local success is not a substitute for either. No live GitHub Pages deployment is claimed.

## Executed checks

| Check | Result | Retained evidence |
|---|---|---|
| JavaScript syntax and model/texture integrity | Passed; all runtime models parse, frame/triangle counts match metadata and required textures load | [Static log](evidence/static-checks.txt) |
| Asset provenance hashes | 30 retained asset/notice/source metadata files matched SHA-256 and size | [Manifest](../assets/manifest.json) |
| Headless regressions | 18 passed, 0 failed | [Test log](evidence/simulation-tests.txt) |
| Geometry and navigation | All mission/spawn positions valid, all objectives reachable, graph edges validated | Simulation tests; 174 static brushes, 704 navigation nodes, 4,582 edges |
| Weapon behaviour | Rifle damage/cadence/ammo, cannon travel/splash/ammo, cover blocking and projectile cap passed | Simulation tests |
| SHITPOSTER behaviour | Unlock, charge, interrupted attacks, frozen stun interval, recovery/firing, immunity, cooldown, distance/visibility and held-key checks passed | Simulation tests; browser rebound-key check |
| Mission outcomes | Ordered firmware/ambush/relay/core/waves/extraction and terminal defeat/victory passed | Simulation tests; browser victory and defeat screens |
| Full mission without shortcuts | 2,588 input ticks; 27 kills; 3 activations; 4 stunned targets; 8 damage taken; victory | [Retained inputs](../tests/fixtures/mission-replay.json) |
| HTTP browser | Passed under `/BLOAT-OPS/`; controls, settings, models, movement, firing, pause, rebound ability, replay, restart and defeat | [Browser report](evidence/browser.json) |
| Offline browser | Passed via file launcher to standalone, with HTTP(S) blocked; same gameplay checks | Browser report; no external runtime requests |
| Browser console/resources | Zero console errors, failed requests or missing resources in both modes; WebGL error 0 | Browser report |
| Standalone build | 21 source modules embedded; 6,640,831-byte artifact tested | [Artifact receipt](evidence/standalone.json) |

The initial movement test accidentally advanced the mission while trying to assert a closed gate; the fixture was corrected to remain at the firmware stage. Browser tests also caught and fixed initial pointer-lock camera movement, late pointer-lock capture over a terminal UI, and source `file:` module preloading before standalone redirection. These checks remain in the test suite.

## Reproducibility boundary

The full retained command stream has SHA-256 `5b6c121cdfd37c3f3837e959232fe9c95eed186475f3fb726fbbcc221a6a63a0` and final quantized state digest **`72545eaf`**. Every 300-tick checkpoint is retained. The controller that produced it uses movement, aiming, firing, ability and interaction commands only; it never edits the authoritative player, enemy or objective state. Unit/browser boundary fixtures do directly arrange controlled states, and are separate from this full playthrough.

Node repeats the raw state exactly, as does Chromium when replayed twice. Node and Chromium also match the quantized checkpoint digests. An investigated raw cross-runtime mismatch was one final player-coordinate difference of `5.684341886080802e-14`; status, tick count and combat totals were identical. Digests round fractional numbers to `1e-6`; they are regression checksums, not cryptographic identity proofs. No cross-platform bitwise floating-point guarantee is made.

## Performance environment and workload

Reported container CPU: **AMD EPYC 9V74 80-Core Processor**, Linux x64, 9 reported logical CPUs / 8 available to the process, 9.73 GiB reported memory. Shared virtual environment; no CPU pinning. Node **v24.22.1**. Local browser driver: Playwright **1.62.1** using the installed Chromium headless shell **134.0.6998.35**, ANGLE Vulkan **SwiftShader** software rendering. CI installs its own pinned Playwright 1.56.1 Chromium build on Ubuntu 24.04 and reruns the suite.

Five measured headless runs after one warm-up replayed all 2,588 ticks. Mean simulation step cost ranged from **0.0226–0.0322 ms**; per-run p95 ranged from **0.0458–0.0708 ms**. Startup geometry/navigation measured **197 ms** in that shared-container sample. [Raw measurements](evidence/performance.json) include maxima and all runs. These are headless simulation figures, not browser frame-rate claims.

For the browser, 90 deterministic renders of the four-enemy ambush at **1440×900**, including HUD and `gl.finish()`, measured mean render-call costs of **1.88 ms** over HTTP and **2.00 ms** offline. Per-mode p95 values were **0.40 ms** and **2.20 ms**, respectively; one-time costs can raise the mean above the p95 in a small sample. These are bounded render-call measurements, not end-to-end display FPS or native-GPU certification. Startup to ready was **639 ms** HTTP and **763 ms** offline in this sample. All raw values and renderer strings are retained in the browser report.

## Implemented scope and limits

The game is playable from initial menu through extraction, with two functioning weapons, two distinct animated enemy roles, real stun/recovery, supplies, mission gating, seven finite encounters, pause/restart, victory/defeat, settings, resource provenance and offline packaging. Low-level QwakeTF systems are identified in [the architecture](../ARCHITECTURE.md); models and textures are itemized in [asset licences](../ASSET_LICENSES.md).

Remaining work: human playtesting and balance, establishing the intended 5–10 minute first-run duration, improved skeletal gun attachments, native hardware and additional browser verification, mid-mission checkpoints, optional boss/summoner and broader input support. The perfect-aim regression controller completes in about 43 seconds of simulation time, so it is not evidence for typical human mission length. Characters are baked pose animations rather than runtime modular skeletal assemblies. No boss, summoner, multiplayer, cloud service, runtime glTF loader or proprietary game assets are claimed.

Next milestones are in [ROADMAP.md](../ROADMAP.md). Proposed v0.1.0 release text is in [RELEASE_NOTES.md](../RELEASE_NOTES.md). The maintainer remains the final merge, tag, release and deployment authority.
