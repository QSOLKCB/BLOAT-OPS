import { v3 } from '../engine/math.js';
import { POWERUP, RELAYS, CORE, EXTRACT, ENCOUNTERS } from './level.js';
export const OBJECTIVES = [
  'CLEAR TELEMETRY INTAKE', 'RECOVER SHITPOSTER FIRMWARE',
  'BREAK THE CORPORATE AMBUSH', 'ISOLATE BOTH MIDDLEWARE RELAYS',
  'DISABLE THE BLOAT CORE', 'SURVIVE THE RESTRUCTURING', 'REACH EXTRACTION',
];
export function objectiveTarget(g) {
  if(g.stage===0) return [1070,0,30];
  if(g.stage===1) return POWERUP;
  if(g.stage===2||g.stage===5) return g.enemies.find(e=>!e.dead)?.origin||CORE;
  if(g.stage===3) return RELAYS[g.relays[0]?1:0];
  return g.stage===4?CORE:EXTRACT;
}
export function interactTarget(g) {
  if(g.stage===3) {for(let i=0;i<2;i++) if(!g.relays[i]&&v3.dist(g.player.origin,RELAYS[i])<90) return {kind:'relay',index:i,origin:RELAYS[i]};}
  if(g.stage===4 && g.alive===0 && v3.dist(g.player.origin,CORE)<100) return {kind:'core',index:0,origin:CORE};
  return null;
}
export function updateObjectives(g,input) {
  const p=g.player;
  if(g.stage===0 && g.alive===0) {g.stage=1;g.emit('objective',{text:'RECOVER THE FIRMWARE / AMBER BEACON'});}
  if(g.stage===1 && v3.dist(p.origin,POWERUP)<65) {
    p.unlocked=true;p.charge=100;g.stage=2;g.spawnEncounter(1);
    g.emit('unlock',{text:'FIRMWARE INSTALLED. PRESS YOUR ABILITY KEY TO STUN THE AMBUSH.'});
  }
  if(g.stage===2 && g.alive===0) {g.stage=3;g.spawnEncounter(2);g.emit('objective',{text:'ISOLATE BOTH RELAYS / HOLD E'});}
  const target=interactTarget(g);
  if(input.interact && target && g.world.lineClear(g.eye(p),target.origin)) {
    const id=target.kind+target.index;
    if(g.interactId!==id) {g.interactId=id;g.interactTicks=0;}
    g.interactTicks++;
    if(g.interactTicks>=120) {
      g.interactTicks=0;g.interactId='';
      if(target.kind==='relay') {g.relays[target.index]=true;p.charge=Math.min(100,p.charge+35);g.emit('objective',{text:'RELAY ISOLATED. MANAGEMENT HAS BEEN NOTIFIED.'});}
      else {g.stage=5;g.wave=0;g.waveAt=g.tick+120;g.emit('core',{text:'CORE OFFLINE. SURVIVE THREE RESTRUCTURING WAVES.'});}
    }
  } else {g.interactTicks=0;g.interactId='';}
  if(g.stage===3 && g.relays.every(Boolean) && g.alive===0) {g.stage=4;g.spawnEncounter(3);g.emit('objective',{text:'ENTER THE DEPENDENCY CHAMBER. CLEAR CORE SECURITY.'});}
  if(g.stage===5 && g.alive===0 && g.tick>=g.waveAt) {
    if(g.wave<3) {g.spawnEncounter(4+g.wave);g.wave++;g.waveAt=g.tick+240;g.emit('objective',{text:'RESTRUCTURING WAVE '+g.wave+' / 3'});}
    else {g.stage=6;g.emit('objective',{text:'CORPORATE OVERHEAD REDUCED. REACH EXTRACTION.'});}
  }
  if(g.stage===6 && v3.dist(p.origin,EXTRACT)<95) {g.status='victory';g.emit('victory',{text:'YOUR DEPENDENCIES HAVE BEEN TERMINATED.'});}
}
