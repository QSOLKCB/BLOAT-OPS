// Standard-mapping gamepad input for BLOAT-OPS (presentation/input layer; never touches simulation state).
// Gameplay sampling is adapted from QSOLKCB/QwakeTF src/input.js (FpsGamepad), menu navigation from
// QSOLKCB/ARCADE js/input.js (PadNav); deadzone and neutral re-arming originate in QSOLKCB/VANILLAJS.
// All three are Apache-2.0. The pad only produces the same per-tick commands as the keyboard and mouse.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Axis deadzone with rescaling: 0 at the zone edge, 1 at full tilt. */
export function deadzone(value, zone = 0.16) {
  if (!Number.isFinite(value) || !Number.isFinite(zone) || zone < 0 || zone >= 1) return 0;
  const m = clamp((Math.abs(value) - zone) / (1 - zone), 0, 1);
  return m === 0 ? 0 : Math.sign(value) * m;
}

// W3C "standard" layout indices.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
// Held buttons and the command field each drives while held.
export const PAD_HOLD = { fire: PAD.RT, aim: PAD.LT, secondary: PAD.RB, jump: PAD.A, interact: PAD.X, sprint: PAD.L3 };
// Edge-triggered actions: fire once per press.
export const PAD_PRESS = { fire: PAD.RT, secondary: PAD.RB, ability: PAD.LB, weapon: PAD.Y, mode: PAD.B, pause: PAD.START };
export const PAD_HELP = [
  ['Left stick', 'Move (L3 click: sprint)'], ['Right stick', 'Aim'], ['RT', 'Fire'], ['LT', 'Precision aim'],
  ['RB', 'Rifle 40mm grenade'], ['LB', 'SHITPOSTER MODE'], ['A', 'Jump'], ['X (hold)', 'Interact'],
  ['Y', 'Switch weapon'], ['B', 'Rifle fire mode'], ['Start', 'Pause / resume'],
];

export const standardPads = () => {
  try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(p => p && p.connected !== false && p.mapping === 'standard'); }
  catch { return []; }
};
const pressed = (p, i) => { const b = p.buttons[i]; return !!b && (typeof b === 'number' ? b > 0.5 : (b.pressed || b.value > 0.5)); };
const neutral = (p, zone) => p.buttons.every((_, i) => !pressed(p, i)) && p.axes.every(v => deadzone(v, zone) === 0);
const identity = pads => pads.map(p => p.index + ':' + p.id).join('|');

/**
 * Samples the first standard controller for gameplay. After connecting, a controller change or disarm()
 * (start, resume, pause, focus loss), every button and stick must return to neutral first, so a button
 * held through a menu never fires, jumps or triggers the ability.
 */
export class FpsGamepad {
  constructor() { this.ids = ''; this.armed = false; this.prev = new Set(); }
  disarm() { this.armed = false; this.prev.clear(); }
  sample(pads, { zone = 0.16 } = {}) {
    const out = { connected: pads.length > 0, armed: false, move: [0, 0], look: [0, 0], held: {}, pressed: {}, active: false, id: pads[0]?.id || '' };
    for (const k in PAD_HOLD) out.held[k] = false;
    for (const k in PAD_PRESS) out.pressed[k] = false;
    const ids = identity(pads);
    if (ids !== this.ids) { this.ids = ids; this.disarm(); }
    const pad = pads[0];
    if (!pad) return out;
    if (!this.armed) {
      // Start is exempt so a held Start can still be tracked as an edge for pause/resume.
      this.armed = pads.every(p => p.buttons.every((_, i) => i === PAD.START || !pressed(p, i)) && p.axes.every(v => deadzone(v, zone) === 0));
      this.prev = new Set(pressed(pad, PAD.START) ? [PAD.START] : []);
      if (!this.armed) return out;
    }
    out.armed = true;
    const down = new Set(); for (let i = 0; i < pad.buttons.length; i++) if (pressed(pad, i)) down.add(i);
    const axis = i => deadzone(pad.axes[i] ?? 0, zone);
    out.move = [-axis(1), axis(0)];
    out.look = [axis(3), axis(2)];
    for (const [k, i] of Object.entries(PAD_HOLD)) out.held[k] = down.has(i);
    for (const [k, i] of Object.entries(PAD_PRESS)) out.pressed[k] = down.has(i) && !this.prev.has(i);
    this.prev = down;
    out.active = down.size > 0 || out.move.some(Boolean) || out.look.some(Boolean);
    return out;
  }
}

/** Look rate in degrees per second: quadratic response for fine aim near the centre. */
export const lookRate = (deflection, sensitivity) => deflection === 0 ? 0 : Math.sign(deflection) * deflection * deflection * sensitivity * 45;

/**
 * Menu navigation: D-pad or left stick moves, A confirms, B goes back, with hold-to-repeat. Disarmed
 * whenever the menu or the connected controllers change, so a held button never selects anything.
 */
export class PadNav {
  constructor() { this.ids = ''; this.armed = false; this.prev = new Set(); this.heldSince = 0; this.lastRepeat = 0; }
  disarm() { this.armed = false; this.prev.clear(); }
  sample(pads, now) {
    const ids = identity(pads);
    if (ids !== this.ids) { this.ids = ids; this.disarm(); }
    const down = new Set();
    for (const p of pads) {
      const x = deadzone(p.axes[0] ?? 0, 0.5), y = deadzone(p.axes[1] ?? 0, 0.5);
      if (pressed(p, PAD.UP) || y < 0) down.add('up'); if (pressed(p, PAD.DOWN) || y > 0) down.add('down');
      if (pressed(p, PAD.LEFT) || x < 0) down.add('left'); if (pressed(p, PAD.RIGHT) || x > 0) down.add('right');
      if (pressed(p, PAD.A)) down.add('confirm'); if (pressed(p, PAD.B)) down.add('back');
    }
    if (!this.armed) { this.armed = pads.every(p => neutral(p, 0.16)); this.prev = new Set(down); return []; }
    const out = [];
    for (const k of ['up', 'down', 'left', 'right', 'confirm', 'back']) if (down.has(k) && !this.prev.has(k)) out.push(k);
    const dirs = ['up', 'down', 'left', 'right'].filter(k => down.has(k));
    if (dirs.length && out.some(k => dirs.includes(k))) { this.heldSince = now; this.lastRepeat = now; }
    else if (dirs.length && now - this.heldSince > 400 && now - this.lastRepeat > 140) { this.lastRepeat = now; out.push(dirs[0]); }
    this.prev = down; return out;
  }
}
