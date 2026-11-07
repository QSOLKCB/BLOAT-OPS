# Roadmap after the v0.1.0 vertical slice

1. Human playtesting: movement feel, enemy accuracy, ammunition economy, accessibility and actual mission duration. The initial target is 5–10 minutes for a first run; that duration has not been established by human testing. The perfect-aim regression controller completes much faster.
2. Character presentation: skeletal hand attachments, correct gun placement through attack/stun poses, stronger enemy silhouettes, and geometry/animation reduction with visual comparisons.
3. Encounter depth: distinct manager support tactics, controlled summoner hazards, more flanking routes and optional secrets. Preserve hard population limits.
4. Enterprise Solutions Architect: **implemented** (two phases, explicit stun resistance, bounded adds). Its health, volley timing and adds still need human playtesting alongside the rest of the combat loop.
5. Checkpoints and validated replay import/export UI: **implemented** with in-session objective checkpoints, export, strict import validation, headless verification and playback. Persisting checkpoints across sessions remains open.
6. Additional runtime evidence: native GPU performance on representative desktops, Firefox/WebKit, and Windows/Linux comparisons. No cross-platform bitwise-determinism claim without evidence.
7. Input expansion: standard **gamepad support implemented** (gameplay and menus). Broader rebinding, physical-controller verification and touch remain open.

No date, tag or immutable release is created by this plan. Every implementation PR requires its own review.
