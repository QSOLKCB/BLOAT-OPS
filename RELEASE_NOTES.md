# Proposed v0.2.0 — Architecture Review

Controller play, a boss, exact checkpoints and validated replays, plus an engine performance update from QwakeTF. This is proposed release text; no version tag or release has been created.

- **Enterprise Solutions Architect:** a two-phase boss after the restructuring waves. It fires fanned volleys, and SHITPOSTER stuns it for only one second. At half health it escalates with faster, wider volleys and two reinforcements. Extraction opens only after it falls.
- **Controller support:** play with any standard-layout controller, with analog movement and aim, triggers, bumpers and Start to pause. It also drives every menu (D-pad or stick, A select, B back) and has its own sensitivity and invert settings. Buttons held through a menu never act, and unplugging a controller pauses.
- **Checkpoints:** completing an objective saves an exact checkpoint for the session. Restart from it on the pause or defeat screen with the same health, ammunition and enemies.
- **Replays:** export a run as a file. Verify or watch a replay from the mission brief: files from other builds, incomplete recordings and malformed inputs are rejected with the reason and never played.
- **Smoother 60 Hz pacing:** rounded browser frame timestamps no longer make one frame in three run no simulation step.
- **Engine update from QwakeTF:** faster collision and pathfinding, fewer GPU uploads, and off-screen models skipped. The simulation is about 1.2× faster on the original mission with identical raw state on every tick, and Chromium frames are byte-identical.
- The retained mission replay was re-recorded for the boss: a victory at 2,814 ticks with 30 kills, digest `bf71e949`. Snapshot version 3 records the boss phase.

Human playtesting of the boss, physical controllers, Firefox/WebKit and native-GPU performance remain unverified. See [verification](docs/VERIFICATION.md).

---

# Proposed v0.1.0 — The Dependency Factory

Initial playable single-player BLOAT-OPS vertical slice. **Your dependencies have been terminated.** This is proposed release text; no version tag or release has been created.

- Original five-sector industrial mission with intake security, firmware recovery, a corporate ambush, two relay objectives, BLOAT Core shutdown, three finite reinforcement waves and extraction.
- Responsive Quake-style movement adapted from QwakeTF, with jumping, strafing, sprinting, precision aim and collision-backed security gates.
- Starting PATCH-9 semi-auto pistol, later Dependency Remover rifle pickup with selectable semi/full-auto fire, and right-click arcing 40mm grenade launcher. Separate ammunition, collision/splash damage, recoil, preserved hit feedback and original synthesized sounds.
- Two animated enemy roles: Telemetry Harvester and Middleware Manager, using genuine CC0 Quaternius character meshes. The rifle uses a CC0 Quaternius mesh; the pistol and under-barrel launcher use original lightweight 3D geometry. Selected industrial textures retain LibreQuake BSD-3-Clause notices.
- SHITPOSTER MODE: combat/objective charge, configurable activation key, actual area stun, interrupted attacks, recovery, immunity and cooldown, plus disruption effects and floating insults.
- Customized HUD, objective guidance, performance counters, pause/restart, victory/defeat screens, local settings, reduced effects and optional camera motion.
- Seeded 60 Hz gameplay, isolated cosmetic effects, retained complete-mission input replay and checkpoint digests. Exact raw replay repeatability within tested runtimes; quantized state-digest checks between tested Node and Chromium. No cross-platform bitwise claim.
- Static repository-prefix deployment and a tested self-contained offline HTML build. CI gates GitHub Pages deployment on tested main after maintainer merge.

See [verification](docs/VERIFICATION.md) for executed tests and measurements. The slice has 27 enemies and no boss, summoner, mid-mission checkpoint, multiplayer, touch/gamepad controls or certified Firefox/WebKit support. Human playtime and broader hardware performance remain to be measured. Enemy weapons currently use approximate attachment transforms.
