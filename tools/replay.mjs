import fs from 'node:fs';import {buildLevel} from '../src/game/level.js';import {NavMesh} from '../src/engine/nav.js';import {Simulation} from '../src/game/simulation.js';
export function runReplay(fixture){
 const map=buildLevel(),nav=new NavMesh(map.world,{seeds:[map.spawn]}),g=new Simulation(map,nav,fixture.seed),checkpoints=[];
 for(const input of fixture.inputs){g.step(input);if(g.tick%300===0)checkpoints.push([g.tick,g.digest()]);}
 return {digest:g.digest(),status:g.status,ticks:g.tick,stats:g.stats,checkpoints};
}
if(process.argv[1]?.endsWith('/replay.mjs')){const fixture=JSON.parse(fs.readFileSync(new URL('../tests/fixtures/mission-replay.json',import.meta.url)));console.log(JSON.stringify(runReplay(fixture),null,2));}
