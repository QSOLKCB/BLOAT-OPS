import { v3, angleVectors } from '../engine/math.js';
import { sweepAABB } from '../engine/world.js';
export const WEAPONS = Object.freeze([
  { name:'PATCH-9', short:'PATCH-9 / SEMI', damage:30, interval:0, model:'pistol', ammo:0, recoil:.7 },
  { name:'DEPENDENCY REMOVER', short:'REMOVER', damage:24, interval:7, model:'rifle', ammo:1, recoil:1.0 },
]);
export const GRENADE = Object.freeze({damage:115,radius:150,speed:650,gravity:500,interval:52,fuse:180});
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
export function fireWeapon(g,index,automatic=false) {
  const p=g.player,w=WEAPONS[index];
  if(g.status!=='playing'||p.dead||!w||(index===1&&!p.hasRifle)||p.ammo[w.ammo]<=0||(automatic&&g.tick<p.nextFire))return false;
  p.ammo[w.ammo]--;if(index===1)p.nextFire=g.tick+w.interval;p.lastFire=g.tick;p.lastWeapon=index;p.lastAlt=false;g.stats.shots++;
  const {forward,right,up}=angleVectors(p.angles),origin=g.eye(p),spread=p.aiming?.001:.009;
  const dir=v3.norm(v3.add(forward,v3.add(v3.scale(right,(g.rng.next()-.5)*spread),v3.scale(up,(g.rng.next()-.5)*spread))));
  const tr=actorHit(g,origin,v3.ma(origin,2200,dir),g.enemies);
  if(tr.entity)g.damage(tr.entity,w.damage,'player');
  g.emit('shot',{weapon:index,origin,end:tr.endpos,hit:!!tr.entity});return true;
}
export function fireGrenade(g) {
  const p=g.player;
  if(g.status!=='playing'||p.dead||!p.hasRifle||p.weapon!==1||p.ammo[2]<=0||g.tick<p.nextGrenade||g.projectiles.length>=MAX_PROJECTILES)return false;
  p.ammo[2]--;p.nextGrenade=g.tick+GRENADE.interval;p.lastFire=g.tick;p.lastWeapon=1;p.lastAlt=true;g.stats.shots++;
  const origin=g.eye(p),velocity=v3.scale(angleVectors(p.angles).forward,GRENADE.speed);
  g.projectiles.push({id:g.nextId++,owner:'player',origin:origin.slice(),prevOrigin:origin.slice(),velocity,damage:GRENADE.damage,radius:GRENADE.radius,gravity:GRENADE.gravity,until:g.tick+GRENADE.fuse});
  g.emit('shot',{weapon:1,alt:true,origin,end:v3.ma(origin,20,v3.norm(velocity))});return true;
}
// Press counts retain quick down/up clicks between rendering frames. Held booleans
// also support headless callers; explicit counts override edge inference.
export function updateWeapons(g,input) {
  const p=g.player;
  if(input.toggleMode&&!g.lastMode&&p.hasRifle&&p.weapon===1){p.rifleAuto=!p.rifleAuto;g.emit('mode',{text:'REMOVER / '+(p.rifleAuto?'AUTO':'SEMI')});}
  const presses=input.firePresses??Number(input.fire&&!g.lastFireHeld);
  const altPresses=input.altPresses??Number(input.secondary&&!g.lastAltHeld);
  let fired=false;
  if(p.weapon===1&&p.rifleAuto){if(input.fire||presses)fired=fireWeapon(g,1,true);}
  else for(let i=0;i<presses;i++)fired=fireWeapon(g,p.weapon)||fired;
  if(altPresses)fired=fireGrenade(g)||fired;
  g.lastFireHeld=input.fire;g.lastAltHeld=input.secondary;g.lastMode=input.toggleMode;
  if(fired)for(const e of g.enemies)e.heardShot=g.tick;
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
    if(p.gravity){end[2]-=.5*p.gravity/3600;p.velocity[2]-=p.gravity/60;}
    const tr=actorHit(g,p.origin,end,p.owner==='player'?g.enemies:[g.player],2);
    p.origin=tr.endpos;
    if(tr.fraction<1 || g.tick>=p.until) {
      if(p.radius) explode(g,p,p.origin);
      else { if(tr.entity) g.damage(tr.entity,p.damage,p.owner); g.emit('impact',{origin:p.origin.slice()}); }
    } else alive.push(p);
  }
  g.projectiles=alive;
}
