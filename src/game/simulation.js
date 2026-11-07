import { v3, clamp } from '../engine/math.js';
import { playerMove } from '../engine/pmove.js';
import { PL_MINS, PL_MAXS } from '../engine/defs.js';
import { World, MASK_PLAYER } from '../engine/world.js';
import { Random } from './random.js';
import { SPAWN, RIFLE_PICKUP, SUPPLIES, ENCOUNTERS } from './level.js';
import { ENEMIES, updateEnemies } from './enemies.js';
import { activateAbility } from './ability.js';
import { updateWeapons, updateProjectiles } from './weapons.js';
import { updateObjectives } from './objectives.js';
export const TICK=1/60, MAX_ENEMIES=32, SNAPSHOT_VERSION=3;
// A gate opens when the mission reaches this stage (intake, hall, chamber exit after the Architect).
export const GATE_STAGES=[3,4,7];
export function normalizeInput(input={}) {
  const finite=(v,f=0)=>Number.isFinite(v)?v:f;
  return {forward:clamp(finite(input.forward),-1,1),side:clamp(finite(input.side),-1,1),jump:!!input.jump,sprint:!!input.sprint,fire:!!input.fire,secondary:!!input.secondary,firePresses:Number.isInteger(input.firePresses)?clamp(input.firePresses,0,8):null,altPresses:Number.isInteger(input.altPresses)?clamp(input.altPresses,0,8):null,toggleMode:!!input.toggleMode,aim:!!input.aim,ability:!!input.ability,interact:!!input.interact,weapon:input.weapon===1?1:input.weapon===0?0:-1,angles:[clamp(finite(input.angles?.[0]),-85,85),((finite(input.angles?.[1])%360)+360)%360,0]};
}
export class Simulation {
  constructor(map,nav,seed=0xB10A7001) {
    this.map=map;this.world=Object.assign(new World(),map.world,{movers:map.gates.map(g=>({...g})),stamp:new Int32Array(map.world.stamp.length),curStamp:1});this.nav=nav;this.seed=seed>>>0;this.rng=new Random(seed);
    this.tick=0;this.status='playing';this.nextId=1;this.stage=0;this.relays=[false,false];this.wave=0;this.waveAt=0;
    this.interactTicks=0;this.interactId='';this.enemies=[];this.projectiles=[];this.events=[];
    this.stats={shots:0,hits:0,kills:0,damageTaken:0,stuns:0,activations:0};this.lastAbility=false;this.lastFireHeld=false;this.lastAltHeld=false;this.lastMode=false;
    this.player=this.actor(SPAWN,240);Object.assign(this.player,{id:0,health:125,maxHealth:125,angles:[0,0,0],ammo:[120,0,0],hasRifle:false,rifleAuto:true,weapon:0,nextFire:0,nextGrenade:0,lastAlt:false,lastFire:-100,lastWeapon:0,unlocked:false,charge:0,abilityUntil:0,abilityReady:0,aiming:false});
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
      else {this.stats.kills++;this.player.charge=Math.min(100,this.player.charge+20);const slot=this.player.hasRifle?1:0;this.player.ammo[slot]=Math.min(300,this.player.ammo[slot]+8);this.emit('kill',{origin:target.origin.slice(),kind:target.kind});}
    }
  }
  step(raw={}) {
    if(this.status!=='playing')return;
    this.events.length=0;const input=normalizeInput(raw);this.tick++;
    const p=this.player;p.prevOrigin=p.origin.slice();p.angles=input.angles;p.aiming=input.aim;
    if(input.weapon===0||(input.weapon===1&&p.hasRifle))p.weapon=input.weapon;
    p.speed=input.aim?145:input.sprint?310:240;
    playerMove(p,{forward:input.forward*p.speed,side:input.side*p.speed,up:0,jump:input.jump,angles:p.angles},TICK);
    if(input.ability&&!this.lastAbility)activateAbility(this);this.lastAbility=input.ability;
    updateWeapons(this,input);
    updateEnemies(this);
    updateProjectiles(this);
    if(this.status!=='playing')return;
    if(!p.hasRifle&&this.stage>=1&&v3.dist(p.origin,RIFLE_PICKUP)<55){p.hasRifle=true;p.weapon=1;p.ammo[1]=180;p.ammo[2]=8;this.emit('weaponPickup',{text:'DEPENDENCY REMOVER ACQUIRED / B: SEMI-AUTO / RMB: 40mm'});}
    for(const s of this.supplies)if(!s.used&&v3.dist(s.origin,p.origin)<46&&(p.health<p.maxHealth||p.ammo[0]<120||(p.hasRifle&&(p.ammo[1]<180||p.ammo[2]<8)))) {
      s.used=true;p.health=Math.min(p.maxHealth,p.health+55);p.ammo[0]=Math.min(300,p.ammo[0]+90);if(p.hasRifle){p.ammo[1]=Math.min(300,p.ammo[1]+90);p.ammo[2]=Math.min(20,p.ammo[2]+4);}this.emit('supply');
    }
    updateObjectives(this,input);
    this.world.movers.forEach((gate,i)=>gate.solid=this.stage<GATE_STAGES[i]);
  }
  snapshot() {
    const actor=a=>({id:a.id,origin:a.origin,velocity:a.velocity,angles:a.angles,health:a.health,dead:a.dead,onGround:a.onGround,jumpHeld:a.jumpHeld,waterLevel:a.waterLevel,waterType:a.waterType});
    return {version:SNAPSHOT_VERSION,seed:this.seed,rng:this.rng.state,tick:this.tick,nextId:this.nextId,status:this.status,stage:this.stage,relays:this.relays,wave:this.wave,waveAt:this.waveAt,interactTicks:this.interactTicks,interactId:this.interactId,lastAbility:this.lastAbility,lastFireHeld:this.lastFireHeld,lastAltHeld:this.lastAltHeld,lastMode:this.lastMode,
      player:{...actor(this.player),ammo:this.player.ammo,hasRifle:this.player.hasRifle,rifleAuto:this.player.rifleAuto,nextGrenade:this.player.nextGrenade,lastAlt:this.player.lastAlt,weapon:this.player.weapon,nextFire:this.player.nextFire,lastFire:this.player.lastFire,lastWeapon:this.player.lastWeapon,unlocked:this.player.unlocked,charge:this.player.charge,abilityUntil:this.player.abilityUntil,abilityReady:this.player.abilityReady,aiming:this.player.aiming},
      enemies:this.enemies.map(e=>({...actor(e),kind:e.kind,phase2:e.phase2,state:e.state,awake:e.awake,windup:e.windup,nextAttack:e.nextAttack,stunUntil:e.stunUntil,immuneUntil:e.immuneUntil,nextPath:e.nextPath,path:e.path,pathIndex:e.pathIndex,heardShot:e.heardShot,deathTick:e.deathTick,lastDamage:e.lastDamage})),
      projectiles:this.projectiles.map(p=>({...p,prevOrigin:undefined})),supplies:this.supplies.map(s=>s.used),stats:this.stats};
  }
  // Rebuild a run from snapshot() output (checkpoints, replay tooling). Every field gameplay reads is either
  // in the snapshot or a per-kind constant; tests/checkpoint.test.mjs proves that a restored run continues
  // with the identical raw state on every later tick.
  static fromSnapshot(map,nav,snap) {
    if(!snap||snap.version!==SNAPSHOT_VERSION) throw new Error('Unsupported snapshot version '+snap?.version);
    const g=new Simulation(map,nav,snap.seed),copy=v=>Array.isArray(v)?v.slice():v;
    g.rng.state=snap.rng>>>0;
    for(const k of ['tick','nextId','status','stage','wave','waveAt','interactTicks','interactId','lastAbility','lastFireHeld','lastAltHeld','lastMode'])g[k]=snap[k];
    g.relays=snap.relays.slice();g.stats={...snap.stats};g.events=[];
    const sp=snap.player,p=g.player;
    for(const [k,v] of Object.entries(sp))p[k]=copy(v);
    p.prevOrigin=p.origin.slice();
    g.enemies=snap.enemies.map(se=>{const def=ENEMIES[se.kind];if(!def)throw new Error('Unknown enemy kind '+se.kind);const e=g.actor(se.origin,def.speed);for(const [k,v] of Object.entries(se))e[k]=copy(v);e.maxHealth=def.health;e.prevOrigin=e.origin.slice();return e;});
    g.projectiles=snap.projectiles.map(sp=>{const pr={};for(const [k,v] of Object.entries(sp))pr[k]=copy(v);pr.prevOrigin=pr.origin.slice();return pr;});
    g.supplies.forEach((s,i)=>s.used=!!snap.supplies[i]);
    g.world.movers.forEach((gate,i)=>gate.solid=g.stage<GATE_STAGES[i]);
    return g;
  }
  digest() {
    // Digest coordinates at one-millionth of a world unit; timers/IDs remain exact.
    // Raw snapshots are still compared exactly within each tested runtime.
    const s=JSON.stringify(this.snapshot(),(_key,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*1e6)/1e6:v);let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return (h>>>0).toString(16).padStart(8,'0');
  }
}
// Exact text encoding for checkpoints: JSON, except that -0 and non-finite numbers survive the round trip.
export function encodeState(snap){return JSON.stringify(snap,(_k,v)=>typeof v==='number'&&(Object.is(v,-0)||!Number.isFinite(v))?{$n:Object.is(v,-0)?'-0':String(v)}:v);}
export function decodeState(text){return JSON.parse(text,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.$n==='string'&&Object.keys(v).length===1?Number(v.$n):v);}
// Rendering cadence supplies elapsed time; recorded commands are consumed by simulation tick.
// Browsers round frame timestamps (often to 0.1 ms), so a 60 Hz display reports 16.7, 16.6, 16.7 ms.
// Compared exactly, one frame in three then runs no tick and the next runs two. A frame within 0.5 ms
// of a whole number of ticks counts as exactly that many (as in QSOLKCB/ARCADE v0.4.0). This changes
// only real-time pacing: replays and the simulation consume one command per tick regardless.
export class FixedClock {
  constructor(){this.accum=0;this.dropped=0;}
  advance(seconds,step){if(!Number.isFinite(seconds))seconds=0;let clamped=Math.max(0,Math.min(.25,seconds));this.dropped+=Math.max(0,seconds-clamped);const whole=Math.round(clamped/TICK);if(whole>=1&&Math.abs(clamped-whole*TICK)<.0005)clamped=whole*TICK;this.accum+=clamped;let count=0;while(this.accum+1e-10>=TICK&&count<15){step();this.accum-=TICK;count++;}this.accum=Math.max(0,this.accum);return count;}
  reset(){this.accum=0;}
}
