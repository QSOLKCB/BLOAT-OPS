import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {buildLevel} from '../src/game/level.js';import {NavMesh} from '../src/engine/nav.js';
import {Simulation,encodeState,decodeState} from '../src/game/simulation.js';
import {levelId,validateReplay,verifyReplay,REPLAY_FORMAT} from '../src/game/replay.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/mission-replay.json',import.meta.url)));
const map=buildLevel(),nav=new NavMesh(map.world,{seeds:[map.spawn]});
const raw=g=>createHash('sha1').update(encodeState(g.snapshot())).digest('hex');

test('state encoding round-trips -0 and non-finite values exactly',()=>{
 const v=decodeState(encodeState({a:-0,b:Infinity,c:-Infinity,d:[0,-0,1.5],e:{$n:'x',y:1}}));
 assert(Object.is(v.a,-0));assert.equal(v.b,Infinity);assert.equal(v.c,-Infinity);assert(Object.is(v.d[1],-0));assert.deepEqual(v.e,{$n:'x',y:1});
});

test('a run restored from any checkpoint continues with the identical raw state on every later tick',()=>{
 const ref=new Simulation(map,nav,fixture.seed),hashes=[],snaps=new Map(),stages=new Set();let stage=0;
 for(const input of fixture.inputs){ref.step(input);hashes.push(raw(ref));
  if(ref.stage!==stage){stage=ref.stage;stages.add(ref.tick);}
  if(ref.tick%150===0||stages.has(ref.tick))snaps.set(ref.tick,encodeState(ref.snapshot()));}
 assert.equal(ref.status,'victory');assert(stages.size>=6,'every objective boundary is covered');
 for(const [tick,text] of snaps){
  const g=Simulation.fromSnapshot(map,nav,decodeState(text));
  assert.equal(raw(g),hashes[tick-1],'restored state equals the snapshot at tick '+tick);
  for(let i=tick;i<fixture.inputs.length;i++){g.step(fixture.inputs[i]);if(raw(g)!==hashes[i])assert.fail('restored at tick '+tick+' diverged at tick '+(i+1));}
  assert.equal(g.digest(),fixture.finalDigest);assert.equal(g.status,'victory');
 }
});

test('restoring rejects unknown snapshot versions and enemy kinds',()=>{
 const g=new Simulation(map,nav,1),s=g.snapshot();
 assert.throws(()=>Simulation.fromSnapshot(map,nav,{...s,version:2}),/Unsupported snapshot version/);
 assert.throws(()=>Simulation.fromSnapshot(map,nav,{...s,enemies:[{...s.enemies[0],kind:'boss?'}]}),/Unknown enemy kind/);
});

const sample=()=>({format:REPLAY_FORMAT,version:2,level:levelId(map),seed:fixture.seed,ticks:fixture.inputs.length,truncated:false,inputs:fixture.inputs,digest:fixture.finalDigest});
test('replay validation accepts the retained fixture and rejects incomplete, mismatched or malformed files',()=>{
 assert.deepEqual(validateReplay(sample(),levelId(map)),{ok:true,errors:[]});
 const bad=(change,pattern)=>{const r=sample();change(r);const v=validateReplay(r,levelId(map));assert.equal(v.ok,false);assert.match(v.errors.join(' '),pattern);};
 bad(r=>{r.format='other';},/not a BLOAT-OPS replay/);
 bad(r=>{r.version=1;},/version/);
 bad(r=>{r.level='deadbeef';},/different mission/);
 bad(r=>{r.truncated=true;},/incomplete/);
 bad(r=>{r.seed=-1;},/seed/);
 bad(r=>{r.ticks=5;},/tick count/);
 bad(r=>{r.inputs=r.inputs.slice();r.inputs[7]={...r.inputs[7],forward:'fast'};},/input 7/);
 bad(r=>{r.inputs=r.inputs.slice();r.inputs[9]={...r.inputs[9],teleport:true};},/input 9/);
 bad(r=>{r.inputs=Array(36001).fill({});r.ticks=36001;},/too long/);
 bad(r=>{r.digest='nothex';},/digest/);
});
test('headless verification replays the inputs and compares the recorded digest',()=>{
 const ok=verifyReplay(map,nav,sample());assert.equal(ok.match,true);assert.equal(ok.status,'victory');assert.equal(ok.digest,fixture.finalDigest);
 const r=sample();r.digest='00000000';const no=verifyReplay(map,nav,r);assert.equal(no.match,false);assert.equal(no.digest,fixture.finalDigest);
});
test('verification rejects inputs left unconsumed after the mission ends (Codex review)',()=>{
 const r=sample();r.inputs=[...r.inputs,{forward:1}];r.ticks=r.inputs.length;
 assert.equal(validateReplay(r,levelId(map)).ok,true,'well-formed file');
 const v=verifyReplay(map,nav,r);assert.equal(v.match,false,'extra commands after victory must not verify');assert.equal(v.complete,false);assert.equal(v.unconsumed,1);assert.equal(v.ticks,2814);
 const ok=verifyReplay(map,nav,sample());assert.equal(ok.complete,true);assert.equal(ok.unconsumed,0);assert.equal(ok.match,true);
});
