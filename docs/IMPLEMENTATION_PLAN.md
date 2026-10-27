# BLOAT-OPS-001 implementation plan

Baseline: QSOLKCB/QwakeTF `a1f7dbbd2dc34bb29b179042eb22cfe4bd411815` (main).
Target base: QSOLKCB/BLOAT-OPS `496e178615a900931541f1dc8b5c10e73cf1057e` (main).
Development branch: `codex/bloat-ops-001`.

1. Retain QwakeTF's brush world/collision, player movement, WebGL2 renderer, model parser, lightmapping, positional audio and navigation. Keep mission logic separate from its CTF/class systems. Upstream uses fixed steps already, but gameplay and cosmetics share unseeded random calls: the new game layer must own seeded randomness.
2. Build an original sequential industrial mission, two distinct enemy roles, two weapons, bounded encounters, supplies, core shutdown, extraction and restart.
3. Implement SHITPOSTER charge, deterministic stun, interrupted wind-ups, immunity, recovery, cooldown and readable feedback.
4. Prepare verified CC0 Quaternius assets offline for the existing animated alias renderer; use selected BSD-3-Clause LibreQuake industrial textures. Retain notices and asset hashes.
5. Add BLOAT-OPS UI, settings and accessibility controls. Separate rendering effects from state transitions.
6. Verify geometry/navigation, combat, state-machine edges, recorded replay digests, browser gameplay/resources, offline build and measured performance.
7. Open one implementation PR with evidence and request Codex review of its final commit. No main push, upstream modification, merge, tag or release.
