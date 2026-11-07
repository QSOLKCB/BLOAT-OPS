// Exact A/B parity and timing between two source trees (development tool, not part of the runtime).
// node tools/parity-ab.mjs <baselineDir> [repetitions=5]
// The baseline is any older checkout, e.g. `git archive <rev> src tests | tar -x -C <dir>`.
// Both trees replay the retained mission fixture in this process. The raw snapshot (unrounded
// floats, every field) is hashed after every tick and must match exactly; the quantized digest
// used by the regression tests is a weaker check and is not relied on here.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';
const here=path.resolve(import.meta.dirname,'..'),baseDir=path.resolve(process.argv[2]||''),reps=Number(process.argv[3])||5;
if(!process.argv[2]||!fs.existsSync(path.join(baseDir,'src/game/simulation.js'))){console.error('usage: node tools/parity-ab.mjs <baselineDir> [repetitions]');process.exit(2);}
const fixture=JSON.parse(fs.readFileSync(path.join(here,'tests/fixtures/mission-replay.json')));
async function load(root){const u=f=>pathToFileURL(path.join(root,f)).href;const [{buildLevel},{NavMesh},{Simulation}]=await Promise.all(['src/game/level.js','src/engine/nav.js','src/game/simulation.js'].map(f=>import(u(f))));return {buildLevel,NavMesh,Simulation};}
function run(src){const t0=performance.now(),map=src.buildLevel(),nav=new src.NavMesh(map.world,{seeds:[map.spawn]}),startup=performance.now()-t0;const g=new src.Simulation(map,nav,fixture.seed),h=createHash('sha256');let sim=0;
 for(const input of fixture.inputs){const t=performance.now();g.step(input);sim+=performance.now()-t;h.update(JSON.stringify(g.snapshot()));}
 return {hash:h.digest('hex'),digest:g.digest(),status:g.status,ticks:g.tick,sim,startup};}
const base=await load(baseDir),cur=await load(here);const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1];const out={base:[],cur:[]};let ref=null;
for(let i=0;i<reps+1;i++)for(const [k,src] of i%2?[['cur',cur],['base',base]]:[['base',base],['cur',cur]]){const r=run(src);if(ref===null)ref=r.hash;if(r.hash!==ref){console.error('RAW STATE DIVERGED in',k,'run',i);process.exit(1);}if(i)out[k].push(r);}
const s=k=>`sim median ${med(out[k].map(r=>r.sim)).toFixed(1)} ms over ${out[k][0].ticks} ticks, level+nav build median ${med(out[k].map(r=>r.startup)).toFixed(1)} ms`;
console.log(`node ${process.version}; ${reps} alternating runs each; raw per-tick snapshot hash identical (${ref.slice(0,16)}…), final digest ${out.cur[0].digest}, ${out.cur[0].status}`);
console.log('baseline:',s('base'));console.log('current: ',s('cur'));console.log(`simulation speedup ${(med(out.base.map(r=>r.sim))/med(out.cur.map(r=>r.sim))).toFixed(2)}x`);
