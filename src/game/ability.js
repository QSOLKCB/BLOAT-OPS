import { v3 } from '../engine/math.js';
export const ABILITY = Object.freeze({cost:100, duration:240, stun:180, immunity:360, cooldown:900, radius:470});
export const TAUNTS = ['SKILL ISSUE DETECTED','YOUR FRAMEWORK IS NOW DEPRECATED','404: COMPETENCE NOT FOUND','WORKS ON MY MACHINE','YOU NEED 64GB FOR THAT?','PR REJECTED: EXCESSIVE BULLSHIT'];
export function activateAbility(g) {
  const p=g.player, t=g.tick;
  if(!p.unlocked || p.charge<ABILITY.cost || t<p.abilityReady || g.status!=='playing') return false;
  p.charge-=ABILITY.cost; p.abilityUntil=t+ABILITY.duration; p.abilityReady=t+ABILITY.cooldown;
  let count=0;
  for(const e of g.enemies) {
    if(e.dead || t<e.immuneUntil || v3.dist(p.origin,e.origin)>ABILITY.radius || !g.world.lineClear(g.eye(p),g.eye(e))) continue;
    e.stunUntil=t+ABILITY.stun; e.immuneUntil=e.stunUntil+ABILITY.immunity;
    e.windup=0; e.nextAttack=e.stunUntil+60; e.state='stunned'; e.velocity=[0,0,0]; count++;
    g.emit('stun',{id:e.id,origin:e.origin.slice(),text:TAUNTS[e.id%TAUNTS.length]});
  }
  g.stats.stuns+=count; g.stats.activations++;
  g.emit('ability',{origin:p.origin.slice(),count}); return true;
}
