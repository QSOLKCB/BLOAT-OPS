# BLOAT-OPS engineering invariants

- Correctness outranks speed. Keep the runtime vanilla HTML/CSS/JavaScript/WebGL2, static and offline-capable; no telemetry or external runtime services.
- Work on a development branch. Do not push main, merge your own PR, or create tags/releases without explicit maintainer authorization. Never modify QwakeTF upstream as part of this repository's work.
- Preserve the recorded upstream import, Apache notices, asset licences and exact source hashes. New external assets require verified permissions, source records and hash updates.
- Authoritative gameplay uses 60 Hz ticks and its explicit PRNG. Rendering, audio, wall-clock time and cosmetic randomness must not change gameplay state. Preserve stun interruption, recovery, immunity and cooldown regressions.
- Keep populations, projectiles, particles, event queues and recordings bounded. Report measured workload/environment with performance claims.
- Run `node tools/check.mjs`, `node --test tests/*.test.mjs`, `node tools/build.mjs` and the Chromium browser checks for gameplay/runtime changes. Never suppress a failing check or claim an unexecuted test passed. Golden replay changes need an explained behaviour or serialization change.
- Keep source as the authority; standalone output is rebuilt and tested. Production deployment is main-only after required checks.
- Request Codex review of the exact final PR commit where available. Fix findings and seek review again after changed commits. Each PR earns its own review; previous approval is not transferable.
