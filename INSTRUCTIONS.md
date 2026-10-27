# Field instructions

BLOAT is the fictional Bureau of Legacy Architecture and Operational Transformation. Its factory manufactures computational waste. Your assignment is to shut it down and leave alive.

| Input | Action |
|---|---|
| WASD / mouse | Move / aim |
| Space / Shift | Jump / sprint |
| Left mouse button | Click once per semi-auto shot; hold for rifle AUTO fire |
| Right mouse button | Rifle equipped: launch one arcing 40mm grenade per press |
| B | Toggle the rifle between AUTO and SEMI |
| 1 / 2 / wheel | Select pistol / acquired rifle, or cycle |
| Q, held | Precision aim: narrower field of view, lower movement speed, tighter rifle spread |
| F | SHITPOSTER MODE; rebind to G, V or T in settings |
| E, held | Operate a nearby relay or the core for two continuous seconds |
| Escape | Pause; simulation stops completely |
| P | Toggle performance counters |

You start with the **PATCH-9**, a semi-auto pistol (30 damage). Each left-button press fires once, with no artificial semi-auto cooldown. Holding the button does not repeat. Quick down/up clicks between frames are retained and consumed by the 60 Hz simulation, with a safety bound of eight presses per tick.

Clear intake security, then walk over the **Dependency Remover** rifle in the intake room before collecting the firmware. It arrives with 180 rifle rounds and eight grenades and is automatically equipped. Its fictional select-fire mechanism defaults to **AUTO**: hold LMB for one 24-damage round every seven ticks. Press **B** for **SEMI**, where each click fires one round. The HUD shows the selected mode. The rifle cannot be selected or fired before pickup.

With the rifle equipped, **RMB** launches its integral **40mm grenade** along a gravity-curved arc. Aim higher for distant targets. It detonates on impact or after a three-second fuse, with up to 115 splash damage. Each press requests one launch; holding RMB does not repeat. The launcher has a 52-tick cooldown and a separate grenade reserve, displayed on the HUD. It is unavailable while holding the pistol. Grenade speed/gravity are tuned in game units, not a real-world ballistics simulation.

Solid geometry blocks shots and blast visibility. Explosions can hurt you at reduced strength. There is no reload input; rounds are drawn directly from reserves. Weapon and mode changes, click counts, grenade gravity and pickup ownership are included in deterministic replay state. Pause/restart clears pending browser clicks; restart restores the pistol-only loadout.

**Telemetry Harvesters** are fast, lightly protected projectile attackers. **Middleware Managers** move more slowly, have more health and fire heavier projectiles over a longer range. Their attack pose telegraphs a shot; keep moving and use cover. Red bolts are hostile. Supplies restore health and available ammunition reserves once; kills return pistol rounds before the rifle pickup, then rifle rounds.

Clear intake security and follow the amber objective marker to recover the firmware. This unlocks SHITPOSTER MODE and fills its meter. At 100 charge, activate it to suspend visible enemies within 470 world units (about 12 displayed metres). It interrupts pending attacks, stuns for three seconds, shows an electronic reaction and floating insults, and produces a four-second disruption effect. It costs the full meter and has a 15-second cooldown. Stunned targets have six seconds of immunity after recovery. Damage, kills and relay objectives refill charge. A nearby wall can protect enemies from the pulse. Holding the key cannot repeatedly trigger it.

Survive the ambush, then clear the middleware hall and hold E at both relay consoles. Clear core security and hold E at the BLOAT Core console. Defeat all three finite reinforcement waves before the extraction gate opens. Enter the amber extraction beacon to win. The HUD arrow and small floor plan track progress. Closed security gates block players, projectiles and disruption visibility.

Health reaching zero ends the run. **Restart mission** starts again in the engineering bay with the same seed. There are no mid-mission checkpoints or save files in this slice. Settings persist locally where browser storage is available.

Settings can lower audio volume to zero, reduce disruption/flashing effects, and turn off camera recoil and movement bob. Recoil animation remains visible on the weapon. Desktop keyboard/mouse play is the supported interaction mode.
