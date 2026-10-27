import { v3, angleVectors } from '../engine/math.js';
import { sweepAABB } from '../engine/world.js';
export const WEAPONS = Object.freeze([
  { name:'DEPENDENCY REMOVER', short:'REMOVER', damage:24, interval:7, model:'rifle', ammo:0, recoil:1.0 },
  { name:'REFACTOR CANNON', short:'REFACTOR', damage:115, interval:52, model:'cannon', ammo:1, recoil:3.0 },
]);
export const MAX_PROJECTILES=96;
export function actorHit(g,a,b,targets,pad=0) {
  let result=g.world.trace(a,b,[-pad,-pad,-pad],[pad,pad,pad]);
  for(const e of targets) {
    if(e.dead) continue;
    const hit=sweepAABB(a,b,v3.add(e.origin,[-16-pad,-16-pad,-24-pad]),v3.add(e.origin,[16+pad,16+pad,32+pad]));
    if(hit && hit.fraction<result.fraction) result={...hit,endpos:v3.lerp(a,b,hit.fraction),entity:e};
  }
  return result;
}
export function fireWeapon(g,index) {
  const p=g.player, w=WEAPONS[index];
  if(g.tick<p.nextFire || p.ammo[w.ammo]<=0 || (index===1 && g.projectiles.length>=MAX_PROJECTILES)) return false;
  p.ammo[w.ammo]--; p.nextFire=g.tick+w.interval; p.lastFire=g.tick; p.lastWeapon=index; g.stats.shots++;
  const {forward,right,up}=angleVectors(p.angles), origin=g.eye(p);
  if(index===0) {
    // Small seeded spread; precision aim trades movement speed for a tighter cone.
    const spread=p.aiming?.001:.009;
    const dir=v3.norm(v3.add(forward,v3.add(v3.scale(right,(g.rng.next()-.5)*spread),v3.scale(up,(g.rng.next()-.5)*spread))));
    const tr=actorHit(g,origin,v3.ma(origin,2200,dir),g.enemies);
    if(tr.entity) g.damage(tr.entity,w.damage,'player');
    g.emit('shot',{weapon:index,origin,end:tr.endpos,hit:!!tr.entity});
  } else {
    g.projectiles.push({id:g.nextId++,owner:'player',origin:origin.slice(),prevOrigin:origin.slice(),velocity:v3.scale(forward,900),damage:w.damage,radius:150,until:g.tick+180});
    g.emit('shot',{weapon:index,origin,end:v3.ma(origin,32,forward)});
  }
  return true;
}
export function explode(g,pr,p) {
  for(const target of [...g.enemies,g.player]) {
    if(target.dead) continue;
    const d=v3.dist(p,target.origin); if(d>pr.radius || !g.world.lineClear(p,g.eye(target))) continue;
    const scale=target===g.player?.35:1;
    g.damage(target,Math.ceil(pr.damage*Math.max(0,1-d/pr.radius)*scale),pr.owner);
  }
  g.emit('explosion',{origin:p.slice(),radius:pr.radius});
}
export function updateProjectiles(g) {
  const alive=[];
  for(const p of g.projectiles) {
    p.prevOrigin=p.origin.slice(); const end=v3.ma(p.origin,1/60,p.velocity);
    const tr=actorHit(g,p.origin,end,p.owner==='player'?g.enemies:[g.player],2);
    p.origin=tr.endpos;
    if(tr.fraction<1 || g.tick>=p.until) {
      if(p.radius) explode(g,p,p.origin);
      else { if(tr.entity) g.damage(tr.entity,p.damage,p.owner); g.emit('impact',{origin:p.origin.slice()}); }
    } else alive.push(p);
  }
  g.projectiles=alive;
}
