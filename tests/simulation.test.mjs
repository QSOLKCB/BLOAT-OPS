import test from 'node:test';import assert from 'node:assert/strict';
import {buildLevel,ZONES,RIFLE_PICKUP,SPAWN,POWERUP,RELAYS,CORE,EXTRACT,ENCOUNTERS} from '../src/game/level.js';
import {NavMesh} from '../src/engine/nav.js';
import {Simulation,FixedClock} from '../src/game/simulation.js';
import {activateAbility,ABILITY} from '../src/game/ability.js';
import {fireWeapon,fireGrenade,actorHit,updateProjectiles} from '../src/game/weapons.js';
import {updateEnemies} from '../src/game/enemies.js';
import {updateObjectives} from '../src/game/objectives.js';
import {v3,vecToAngles} from '../src/engine/math.js';
const map=buildLevel(),nav=new NavMesh(map.world,{seeds:[SPAWN]});const make=()=>new Simulation(map,nav,1234);
const ticks=(g,n,input={})=>{for(let i=0;i<n;i++)g.step(input);};
const clear=g=>{for(const e of g.enemies)g.damage(e,1000,'player');};
function moveTo(g,p){g.player.origin=p.slice();g.player.prevOrigin=p.slice();g.player.velocity=[0,0,0];}
function isolated(){const g=make();moveTo(g,[820,0,25]);g.enemies=g.enemies.slice(0,1);g.player.hasRifle=true;g.player.ammo=[120,180,8];const e=g.enemies[0];e.origin=[1000,0,25];e.prevOrigin=e.origin.slice();e.awake=false;e.health=200;e.maxHealth=200;return {g,e};}

test('level spawn hulls, finite brush geometry, and all mission locations are navigable',()=>{
 assert(nav.nodes.length>100&&nav.nodes.length<3000);const start=nav.nearest(SPAWN);
 for(const p of [RIFLE_PICKUP,POWERUP,...RELAYS,CORE,EXTRACT,...ENCOUNTERS.flat().map(e=>[e[1],e[2],25])]){const n=nav.nearest(p);assert(n,'nearest '+p);const path=nav.findPath(start,n);assert(path?.length,'path '+p);}
 for(const b of map.world.brushes)assert([...b.mins,...b.maxs].every(Number.isFinite));
 for(const n of nav.nodes)for(const e of n.edges){assert(nav.nodes.includes(e.to));assert(e.cost>0);assert(nav.walkable(n.p,e.to.p)||nav.jumpable(n.p,e.to.p)||nav.dropable(n.p,e.to.p));}
});
test('Quake movement accelerates, jumps, lands, and cannot cross a closed mission gate',()=>{const g=make();g.enemies=[];g.stage=1;ticks(g,80,{forward:1,angles:[0,0,0]});assert(g.player.origin[0]>400);const before=g.player.origin[2];ticks(g,5,{jump:true});assert(g.player.origin[2]>before+10);ticks(g,90);assert(g.player.onGround);ticks(g,600,{forward:1});assert(g.player.origin[0]<1530);assert(g.world.trace([1500,0,50],[1600,0,50]).fraction<1);});
test('rifle damage, ammunition and cadence are real and seeded',()=>{const {g,e}=isolated();assert(fireWeapon(g,1,true));assert.equal(e.health,176);assert.equal(g.player.ammo[1],179);assert(!fireWeapon(g,1,true));g.tick+=7;assert(fireWeapon(g,1,true));assert.equal(e.health,152);assert.equal(g.stats.hits,2);});
test('world geometry blocks hitscan, projectiles and area damage visibility',()=>{const {g,e}=isolated();g.player.origin=[920,-280,25];e.origin=[1030,-280,25];g.player.angles=[0,0,0];assert(fireWeapon(g,0));assert.equal(e.health,200);g.tick+=60;g.player.weapon=1;assert(fireGrenade(g));for(let i=0;i<25;i++){g.tick++;updateProjectiles(g);}assert.equal(e.health,200);assert.equal(g.projectiles.length,0);});
test('40mm grenade travels, drops, explodes and consumes separate ammunition',()=>{const {g,e}=isolated();const before=e.health;g.player.weapon=1;assert(fireGrenade(g));assert.equal(g.player.ammo[2],7);assert.equal(e.health,before);for(let i=0;i<30;i++){g.tick++;updateProjectiles(g);}assert(e.health<before-65);assert.equal(g.projectiles.length,0);assert(g.events.some(e=>e.type==='explosion'));});
test('empty weapons cannot fire; projectile spawn budget is bounded',()=>{const {g}=isolated();g.player.ammo=[0,0,0];assert(!fireWeapon(g,0));assert(!fireWeapon(g,1));g.player.weapon=1;g.player.ammo[2]=10;g.projectiles=Array(96).fill({});assert(!fireGrenade(g));assert.equal(g.player.ammo[2],10);});
test('SHITPOSTER requires unlock and charge, interrupts attacks and costs its resource',()=>{const {g,e}=isolated();assert(!activateAbility(g));g.player.unlocked=true;assert(!activateAbility(g));g.player.charge=100;e.windup=20;assert(activateAbility(g));assert.equal(g.player.charge,0);assert.equal(e.windup,0);assert.equal(e.state,'stunned');assert.equal(e.stunUntil,ABILITY.stun);assert.equal(g.player.abilityReady,ABILITY.cooldown);});
test('stunned enemies stay frozen then resume normal AI and firing; cooldown and immunity prevent stun lock',()=>{const {g,e}=isolated();e.awake=true;g.player.unlocked=true;g.player.charge=100;activateAbility(g);const pos=e.origin.slice();for(let i=1;i<ABILITY.stun;i++){g.tick=i;updateEnemies(g);assert.deepEqual(e.origin,pos);assert.equal(g.projectiles.length,0);}g.tick=ABILITY.stun;updateEnemies(g);assert.notEqual(e.state,'stunned');g.player.charge=100;assert(!activateAbility(g));g.player.abilityReady=0;assert(activateAbility(g));assert.equal(e.stunUntil,ABILITY.stun,'immunity protects already stunned enemy');for(let i=0;i<150;i++){g.tick++;updateEnemies(g);}assert(g.projectiles.length>0,'recovered enemy shoots');});
test('stun respects distance and line of sight, and ability edge does not retrigger while held',()=>{const {g,e}=isolated();g.player.unlocked=true;g.player.charge=100;e.origin=[1450,420,25];activateAbility(g);assert.equal(e.stunUntil,0);g.player.charge=100;g.player.abilityReady=0;g.player.origin=[920,-280,25];e.origin=[1030,-280,25];activateAbility(g);assert.equal(e.stunUntil,0);g.player.abilityReady=0;g.player.charge=100;ticks(g,2,{ability:true});assert.equal(g.stats.activations,3);});
test('health reaches a terminal defeat and no later step mutates gameplay',()=>{const g=make();g.damage(g.player,999,'enemy');assert.equal(g.status,'defeat');const before=g.digest();ticks(g,600,{fire:true,forward:1,ability:true});assert.equal(g.digest(),before);});
test('enemy AI acquires the player, telegraphs and fires projectiles that can damage',()=>{const {g,e}=isolated();e.awake=true;e.nextAttack=0;g.player.health=125;ticks(g,190);assert(g.stats.damageTaken>0);assert(g.player.health<125);});
test('supply pickup is conditional, single-use and bounded',()=>{const g=make();g.enemies=[];g.stage=2;moveTo(g,g.supplies[0].origin);g.player.health=20;g.player.ammo=[0,0,0];g.step();assert.equal(g.player.health,75);assert.deepEqual(g.player.ammo,[90,0,0]);assert(g.supplies[0].used);g.step();assert.equal(g.player.health,75);});
test('mission has ordered unlock, ambush, relays, core, three finite waves and extraction',()=>{const g=make();clear(g);g.step();assert.equal(g.stage,1);moveTo(g,POWERUP);g.step();assert(g.player.unlocked);assert.equal(g.stage,2);assert.equal(g.alive,4);clear(g);g.step();assert.equal(g.stage,3);clear(g);
 for(const p of RELAYS){moveTo(g,p);ticks(g,120,{interact:true});}
 assert.equal(g.stage,4);assert.equal(g.alive,5);clear(g);moveTo(g,CORE);ticks(g,120,{interact:true});assert.equal(g.stage,5);
 for(let wave=1;wave<=3;wave++){ticks(g,245);assert.equal(g.wave,wave);assert.equal(g.alive,4);clear(g);}ticks(g,245);assert.equal(g.stage,6);assert.equal(g.alive,0);moveTo(g,EXTRACT);g.step();assert.equal(g.status,'victory');
 const hash=g.digest();ticks(g,20);assert.equal(g.digest(),hash);
});
test('interaction resets when released or moving away; core cannot be skipped',()=>{const g=make();moveTo(g,CORE);ticks(g,121,{interact:true});assert.notEqual(g.stage,5);g.stage=3;g.enemies=[];moveTo(g,RELAYS[0]);ticks(g,60,{interact:true});assert.equal(g.interactTicks,60);g.step();assert.equal(g.interactTicks,0);assert(!g.relays[0]);});
test('same recorded per-tick inputs are independent of render batching',()=>{const cmds=Array.from({length:600},(_,i)=>({forward:i<200?1:0,side:i>200&&i<250?.5:0,fire:i>180,angles:[0,Math.sin(i/55)*10],weapon:i>320?1:0}));const a=make(),b=make();for(const cmd of cmds)a.step(cmd);const clock=new FixedClock();let n=0;while(n<cmds.length)clock.advance([1/30,1/60,1/120,1/40][n%4],()=>{if(n<cmds.length)b.step(cmds[n++]);});assert.equal(a.digest(),b.digest());assert.deepEqual(a.snapshot(),b.snapshot());});
test('cosmetic rendering/randomness cannot affect simulation; global random is forbidden during steps',()=>{const old=Math.random;Math.random=()=>{throw new Error('unseeded random');};try{const a=make();ticks(a,300,{forward:1,fire:true});assert.equal(a.tick,300);}finally{Math.random=old;}});
test('simulation instances have independent collision stamps and gate states',()=>{const a=make(),b=make();a.stage=6;a.enemies=[];a.step();assert(!a.world.movers[0].solid);assert(b.world.movers[0].solid);for(let i=0;i<50;i++){assert.equal(a.world.trace([1500,0,50],[1600,0,50]).fraction,1);assert(b.world.trace([1500,0,50],[1600,0,50]).fraction<1);}});

test('narrowing sector shoulders contain the player with mission gates closed or open',()=>{
 for(let i=1;i<ZONES.length;i++) {
  const previous=ZONES[i-1],next=ZONES[i];if(previous.half<=next.half)continue;
  for(const side of [-1,1])for(const stage of [1,6]) {
   const g=make();g.enemies=[];g.stage=stage;
   const start=[next.from-50,side*(previous.half+next.half)/2,25];
   assert(!g.world.trace(start,start,g.player.mins,g.player.maxs).startsolid);
   moveTo(g,start);ticks(g,180,{forward:1,angles:[0,0,0]});
   assert(g.player.origin[0]<next.from-20,'shoulder blocks forward travel');
   assert(g.player.origin[2]>=24,'player remains above the floor');
   assert.equal(g.status,'playing');
  }
 }
});

test('pistol fires once per press, preserves batched fast clicks and never repeats on hold',()=>{
 const g=make();g.enemies=[];g.stage=1;
 ticks(g,30,{fire:true});assert.equal(g.stats.shots,1);
 g.step({fire:false});g.step({fire:true});assert.equal(g.stats.shots,2);
 g.step({fire:false,firePresses:4});assert.equal(g.stats.shots,6);
 g.step({fire:false,firePresses:0});assert.equal(g.stats.shots,6);
 assert.equal(g.player.ammo[0],114);
});
test('rifle is a single pickup after intake and cannot be selected or fired before ownership',()=>{
 const g=make();g.step({weapon:1,secondary:true});assert.equal(g.player.weapon,0);assert.equal(g.stats.shots,0);assert(!fireWeapon(g,1));
 moveTo(g,RIFLE_PICKUP);g.step();assert(!g.player.hasRifle);
 clear(g);g.step();g.step();assert(g.player.hasRifle);assert.equal(g.player.weapon,1);assert.deepEqual(g.player.ammo.slice(1),[180,8]);
 g.player.ammo[1]=50;g.step();assert.equal(g.player.ammo[1],50);
 const fresh=make();assert(!fresh.player.hasRifle);assert.equal(fresh.player.weapon,0);
});
test('rifle auto cadence and semi selector use separate press/hold semantics',()=>{
 const {g}=isolated();g.enemies=[];g.stage=1;g.player.weapon=1;
 ticks(g,15,{fire:true});assert.equal(g.stats.shots,3);
 g.step({toggleMode:true});assert(!g.player.rifleAuto);
 ticks(g,20,{fire:true,toggleMode:true});assert.equal(g.stats.shots,4);assert(!g.player.rifleAuto);
 g.step({firePresses:3});assert.equal(g.stats.shots,7);
 g.step({toggleMode:true});assert(g.player.rifleAuto);
});
test('grenade alt fire is edge-triggered, bounded, ballistic and disabled on the pistol',()=>{
 const {g}=isolated();g.player.weapon=0;assert(!fireGrenade(g));g.player.weapon=1;
 g.step({secondary:true});const pr=g.projectiles[0];assert(pr.gravity>0);const height=pr.origin[2];
 g.tick++;updateProjectiles(g);assert(pr.origin[2]<height);assert(pr.velocity[2]<0);
 g.enemies=[];g.stage=1;ticks(g,80,{secondary:true});assert.equal(g.player.ammo[2],7);
 g.step({secondary:false});g.step({secondary:true});assert.equal(g.player.ammo[2],6);
});

test('pistol cannot reset rifle automatic cadence; grenades expire on their fuse',()=>{
 const {g}=isolated();g.player.weapon=1;assert(fireWeapon(g,1,true));
 g.tick++;assert(fireWeapon(g,0));assert(!fireWeapon(g,1,true));
 assert(fireGrenade(g));const pr=g.projectiles[0];pr.origin=[800,0,1000];pr.velocity=[0,0,0];pr.until=g.tick+2;
 g.tick++;updateProjectiles(g);assert.equal(g.projectiles.length,1);
 g.tick++;updateProjectiles(g);assert.equal(g.projectiles.length,0);assert(g.events.some(e=>e.type==='explosion'));
});
