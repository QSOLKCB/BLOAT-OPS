// Replay files: identity, strict validation and headless verification. Pure game-layer code.
import { Simulation } from './simulation.js';
import { SPAWN, RIFLE_PICKUP, POWERUP, RELAYS, CORE, EXTRACT, SUPPLIES, ENCOUNTERS } from './level.js';

export const REPLAY_FORMAT = 'bloat-ops-replay', REPLAY_VERSION = 2, MAX_REPLAY_TICKS = 36000;

const fnv = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); };

/** Identity of everything a replay depends on: collision geometry, gates, encounters and mission points. */
export function levelId(map) {
  return fnv(JSON.stringify({
    brushes: map.world.brushes.map(b => [b.mins, b.maxs, b.contents]),
    gates: map.gates.map(g => [g.origin, g.brushes.map(b => [b.mins, b.maxs])]),
    points: [SPAWN, RIFLE_PICKUP, POWERUP, RELAYS, CORE, EXTRACT, SUPPLIES], encounters: ENCOUNTERS,
  }));
}

const BOOLEAN = ['jump', 'sprint', 'fire', 'secondary', 'toggleMode', 'aim', 'ability', 'interact'];
const ALLOWED = new Set([...BOOLEAN, 'forward', 'side', 'firePresses', 'altPresses', 'weapon', 'angles']);
function inputProblem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'is not an object';
  for (const k of Object.keys(input)) if (!ALLOWED.has(k)) return 'has unknown field "' + k + '"';
  for (const k of ['forward', 'side']) if (k in input && !(Number.isFinite(input[k]) && Math.abs(input[k]) <= 1)) return k + ' must be a number from -1 to 1';
  for (const k of BOOLEAN) if (k in input && typeof input[k] !== 'boolean') return k + ' must be true or false';
  for (const k of ['firePresses', 'altPresses']) if (k in input && input[k] !== null && !(Number.isInteger(input[k]) && input[k] >= 0 && input[k] <= 8)) return k + ' must be an integer from 0 to 8';
  if ('weapon' in input && ![-1, 0, 1].includes(input.weapon)) return 'weapon must be -1, 0 or 1';
  if ('angles' in input && !(Array.isArray(input.angles) && input.angles.length >= 2 && input.angles.length <= 3 && input.angles.every(Number.isFinite))) return 'angles must be 2 or 3 finite numbers';
  return '';
}

/** Checks a parsed replay file. Incomplete recordings and other missions are rejected, never repaired. */
export function validateReplay(replay, level) {
  const errors = [];
  if (!replay || typeof replay !== 'object' || replay.format !== REPLAY_FORMAT) errors.push('This is not a BLOAT-OPS replay file.');
  else {
    if (replay.version !== REPLAY_VERSION) errors.push('Unsupported replay version ' + replay.version + ' (expected ' + REPLAY_VERSION + ').');
    if (replay.level !== level) errors.push('Recorded on a different mission build (level ' + replay.level + ', this build ' + level + ').');
    if (replay.truncated !== false) errors.push('The recording is incomplete (truncated), so it cannot be verified.');
    if (!Number.isInteger(replay.seed) || replay.seed < 0 || replay.seed > 0xffffffff) errors.push('Invalid seed.');
    if (!Array.isArray(replay.inputs)) errors.push('Missing inputs.');
    else if (replay.inputs.length > MAX_REPLAY_TICKS) errors.push('Replay is too long (' + replay.inputs.length + ' ticks; the limit is ' + MAX_REPLAY_TICKS + ').');
    else {
      if (replay.ticks !== replay.inputs.length) errors.push('The tick count ' + replay.ticks + ' does not match ' + replay.inputs.length + ' recorded inputs.');
      for (let i = 0; i < replay.inputs.length; i++) { const problem = inputProblem(replay.inputs[i]); if (problem) { errors.push('Recorded input ' + i + ' ' + problem + '.'); break; } }
    }
    if (typeof replay.digest !== 'string' || !/^[0-9a-f]{8}$/.test(replay.digest)) errors.push('Invalid digest.');
  }
  return { ok: errors.length === 0, errors };
}

/** Replays a validated file headlessly and compares its final digest. */
export function verifyReplay(map, nav, replay) {
  const g = new Simulation(map, nav, replay.seed);
  for (const input of replay.inputs) { if (g.status !== 'playing') break; g.step(input); }
  const digest = g.digest();
  return { digest, match: digest === replay.digest, status: g.status, ticks: g.tick, stats: { ...g.stats } };
}
