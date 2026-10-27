import { v3, clamp } from '../engine/math.js';
import { playerMove } from '../engine/pmove.js';
import { PL_MINS, PL_MAXS } from '../engine/defs.js';
import { World, MASK_PLAYER } from '../engine/world.js';
import { Random } from './random.js';
import { SPAWN, SUPPLIES, ENCOUNTERS } from './level.js';
import { ENEMIES, updateEnemies } from './enemies.js';
import { activateAbility } from './ability.js';
import { fireWeapon, updateProjectiles } from './weapons.js';
import { updateObjectives } from './objectives.js';
export const TICK=1/60, MAX_ENEMIES=32;
export function normalizeInput(input={}) {
  const finite=(v,f=0)=>Number.isFinite(v)?v:f;
  return {forward:clamp(finite(input.forward),-1,1),side:clamp(finite(input.side),-1,1),jump:!!input.jump,sprint:!!input.sprint,fire:!!input.fire,secondary:!!input.secondary,aim:!!input.aim,ability:!!input.ability,interact:!!input.interact,weapon:input.weapon===1?1:input.weapon===0?0:-1,angles:[clamp(finite(input.angles?.[0]),-85,85),((finite(input.angles?.[1])%360)+360)%360,0]};
}
export class Simulation {
  constructor(map,nav,seed=0xB10A7001) {
    this.map=map;this.world=Object.assign(new World(),map.world,{movers:map.gates.map(g=>({...g})),stamp:new Int32Array(map.world.stamp.length),curStamp:1});this.nav=nav;this.seed=seed>>>0;this.rng=new Random(seed);
    this.tick=0;this.status='playing';this.nextId=1;this.stage=0;this.relays=[false,false];this.wave=0;this.waveAt=0;
    this.interactTicks=0;this.interactId='';this.enemies=[];this.projectiles=[];this.events=[];
    this.stats={shots:0,hits:0,kills:0,damageTaken:0,stuns:0,activations:0};this.lastAbility=false;
    this.player=this.actor(SPAWN,240);Object.assign(this.player,{id:0,health:125,maxHealth:125,angles:[0,0,0],ammo:[220,20],weapon:0,nextFire:0,lastFire:-100,lastWeapon:0,unlocked:false,charge:0,abilityUntil:0,abilityReady:0,aiming:false});
    this.supplies=SUPPLIES.map((origin,id)=>({id,origin:origin.slice(),used:false}));
    this.spawnEncounter(0);
  }
  actor(origin,speed) {return {origin:origin.slice(),prevOrigin:origin.slice(),velocity:[0,0,0],mins:PL_MINS,maxs:PL_MAXS,speed,onGround:false,waterLevel:0,waterType:0,jumpHeld:false,dead:false,trace:(a,b,mn,mx)=>this.world.trace(a,b,mn,mx,MASK_PLAYER),pointContents:p=>this.world.pointContents(p)};}
  eye(a) {return v3.add(a.origin,[0,0,22]);}
  clearHull(a,b) {return this.world.trace(a,b,PL_MINS,PL_MAXS,MASK_PLAYER).fraction===1;}
  get alive() {return this.enemies.reduce((n,e)=>n+!e.dead,0);}
  emit(type,data={}) {if(this.events.length<128)this.events.push({type,tick:this.tick,...data});}
  spawnEncounter(index) {
    // Remove old corpses only at encounter boundaries; no unbounded object accumulation.
    this.enemies=this.enemies.filter(e=>!e.dead);
    for(const [kind,x,y] of ENCOUNTERS[index]) {
      if(this.enemies.length>=MAX_ENEMIES) break;
      const def=ENEMIES[kind],e=this.actor([x,y,25],def.speed);
      Object.assign(e,{id:this.nextId++,kind,health:def.health,maxHealth:def.health,angles:[0,180,0],state:'idle',awake:index>0,windup:0,nextAttack:this.tick+100,stunUntil:0,immuneUntil:0,nextPath:0,path:[],pathIndex:0,heardShot:-999,lastDamage:-999,deathTick:0});
      this.enemies.push(e);
    }
  }
  damage(target,amount,owner) {
    if(target.dead||this.status!=='playing'||amount<=0)return;
    target.health=Math.max(0,target.health-amount);target.lastDamage=this.tick;
    if(target===this.player) {this.stats.damageTaken+=amount;this.emit('damage',{amount});}
    else {target.awake=true;if(owner==='player'){this.stats.hits++;this.player.charge=Math.min(100,this.player.charge+Math.min(8,amount/4));this.emit('hit',{origin:target.origin.slice(),amount});}}
    if(target.health===0){target.dead=true;target.state='dead';target.deathTick=this.tick;target.windup=0;
      if(target===this.player){this.status='defeat';this.emit('defeat');}
      else {this.stats.kills++;this.player.charge=Math.min(100,this.player.charge+20);this.player.ammo[0]=Math.min(300,this.player.ammo[0]+8);this.emit('kill',{origin:target.origin.slice(),kind:target.kind});}
    }
  }
  step(raw={}) {
    if(this.status!=='playing')return;
    this.events.length=0;const input=normalizeInput(raw);this.tick++;
    const p=this.player;p.prevOrigin=p.origin.slice();p.angles=input.angles;p.aiming=input.aim;
    if(input.weapon>=0)p.weapon=input.weapon;
    p.speed=input.aim?145:input.sprint?310:240;
    playerMove(p,{forward:input.forward*p.speed,side:input.side*p.speed,up:0,jump:input.jump,angles:p.angles},TICK);
    if(input.ability&&!this.lastAbility)activateAbility(this);this.lastAbility=input.ability;
    if(input.fire||input.secondary){if(fireWeapon(this,input.secondary?1:p.weapon))for(const e of this.enemies)e.heardShot=this.tick;}
    updateEnemies(this);
    updateProjectiles(this);
    if(this.status!=='playing')return;
    for(const s of this.supplies)if(!s.used&&v3.dist(s.origin,p.origin)<46&&(p.health<p.maxHealth||p.ammo[0]<220||p.ammo[1]<20)) {
      s.used=true;p.health=Math.min(p.maxHealth,p.health+55);p.ammo[0]=Math.min(300,p.ammo[0]+90);p.ammo[1]=Math.min(40,p.ammo[1]+8);this.emit('supply');
    }
    updateObjectives(this,input);
    this.world.movers.forEach((gate,i)=>gate.solid=this.stage<[3,4,6][i]);
  }
  snapshot() {
    const actor=a=>({id:a.id,origin:a.origin,velocity:a.velocity,angles:a.angles,health:a.health,dead:a.dead,onGround:a.onGround,jumpHeld:a.jumpHeld,waterLevel:a.waterLevel,waterType:a.waterType});
    return {version:1,seed:this.seed,rng:this.rng.state,tick:this.tick,nextId:this.nextId,status:this.status,stage:this.stage,relays:this.relays,wave:this.wave,waveAt:this.waveAt,interactTicks:this.interactTicks,interactId:this.interactId,lastAbility:this.lastAbility,
      player:{...actor(this.player),ammo:this.player.ammo,weapon:this.player.weapon,nextFire:this.player.nextFire,lastFire:this.player.lastFire,lastWeapon:this.player.lastWeapon,unlocked:this.player.unlocked,charge:this.player.charge,abilityUntil:this.player.abilityUntil,abilityReady:this.player.abilityReady,aiming:this.player.aiming},
      enemies:this.enemies.map(e=>({...actor(e),kind:e.kind,state:e.state,awake:e.awake,windup:e.windup,nextAttack:e.nextAttack,stunUntil:e.stunUntil,immuneUntil:e.immuneUntil,nextPath:e.nextPath,path:e.path,pathIndex:e.pathIndex,heardShot:e.heardShot,deathTick:e.deathTick,lastDamage:e.lastDamage})),
      projectiles:this.projectiles.map(p=>({...p,prevOrigin:undefined})),supplies:this.supplies.map(s=>s.used),stats:this.stats};
  }
  digest() {
    // Digest coordinates at one-millionth of a world unit; timers/IDs remain exact.
    // Raw snapshots are still compared exactly within each tested runtime.
    const s=JSON.stringify(this.snapshot(),(_key,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*1e6)/1e6:v);let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(16).padStart(8,'0');
  }
}
// Rendering cadence supplies elapsed time; recorded commands are consumed by simulation tick.
export class FixedClock {
  constructor(){this.accum=0;this.dropped=0;}
  advance(seconds,step){const clamped=Math.max(0,Math.min(.25,seconds));this.dropped+=Math.max(0,seconds-clamped);this.accum+=clamped;let count=0;while(this.accum+1e-10>=TICK&&count<15){step();this.accum-=TICK;count++;}this.accum=Math.max(0,this.accum);return count;}
  reset(){this.accum=0;}
}
