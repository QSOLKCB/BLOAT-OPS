// Development-only autoplayer. Produces inputs; never changes gameplay state.
import fs from 'node:fs';import {createHash} from 'node:crypto';import {buildLevel,POWERUP,RELAYS,CORE,EXTRACT} from '../src/game/level.js';
import {Simulation} from '../src/game/simulation.js';import {NavMesh} from '../src/engine/nav.js';import {v3,angleVectors,vecToAngles} from '../src/engine/math.js';
const map=buildLevel(),nav=new NavMesh(map.world,{seeds:[map.spawn]}),g=new Simulation(map,nav,0xB10A7001);
let path=[],nextPath=0,lastStage=-1,lastGoal='',stuck=0;const inputs=[],checkpoints=[];
for(let tick=0;tick<36000&&g.status==='playing';tick++){
 const p=g.player;let target,enemy=null;const visible=g.enemies.filter(e=>!e.dead&&g.world.lineClear(g.eye(p),g.eye(e))).sort((a,b)=>v3.dist2(a.origin,p.origin)-v3.dist2(b.origin,p.origin));
 enemy=visible[0]||g.enemies.filter(e=>!e.dead).sort((a,b)=>v3.dist2(a.origin,p.origin)-v3.dist2(b.origin,p.origin))[0];
 if(enemy)target=enemy.origin;
 else if(g.stage===1)target=POWERUP;
 else if(g.stage===3)target=RELAYS[g.relays[0]?1:0];
 else if(g.stage===6)target=EXTRACT;
 else target=CORE;
 const goal=target.map(v=>Math.round(v/40)).join(',');
 if(g.tick>=nextPath||lastGoal!==goal){const a=nav.nearest(p.origin),b=nav.nearest(target);path=(nav.findPath(a,b)||[]).map(n=>n.p);if(path.length>1)path.shift();nextPath=g.tick+30;lastGoal=goal;}
 while(path.length>1&&v3.dist(p.origin,path[0])<38)path.shift();
 let dest=g.clearHull(p.origin,[target[0],target[1],25])?[target[0],target[1],25]:(path[0]||target);
 let delta=v3.sub(dest,p.origin);delta[2]=0;let direction=v3.norm(delta);
 const see=enemy&&g.world.lineClear(g.eye(p),g.eye(enemy)),distance=enemy?v3.dist(p.origin,enemy.origin):0;
 let angles=vecToAngles(v3.sub(see?g.eye(enemy):v3.add(dest,[0,0,22]),g.eye(p)));angles=angles.map(v=>Math.round(v*100)/100);
 if(see&&distance<300){const sign=Math.floor(g.tick/120)%2?1:-1;const side=angleVectors(angles).right;direction=v3.scale(side,sign);if(distance<140)direction=v3.norm(v3.add(direction,v3.scale(angleVectors(angles).forward,-1)));}
 if(!enemy&&v3.dist(p.origin,target)<65)direction=[0,0,0];
 const {forward,right}=angleVectors(angles);
 const ability=p.unlocked&&p.charge>=100&&g.tick>=p.abilityReady&&visible.some(e=>v3.dist(p.origin,e.origin)<450);
 const input={forward:Math.round(v3.dot(direction,forward)*100)/100,side:Math.round(v3.dot(direction,right)*100)/100,angles,jump:stuck>30,sprint:!enemy,fire:!!see,weapon:see&&enemy.health>90&&distance>180&&distance<600&&p.ammo[1]>0?1:0,ability,interact:!enemy&&(g.stage===3||g.stage===4)};
 const before=p.origin.slice();g.step(input);stuck=v3.dist(p.origin,before)<.2&&v3.len(direction)>0?stuck+1:0;
 inputs.push(input);
 if(g.stage!==lastStage){console.log('stage',g.stage,'tick',g.tick,'health',p.health,'position',p.origin.map(Math.round));lastStage=g.stage;}
 if(g.tick%300===0)checkpoints.push([g.tick,g.digest()]);
 if(g.tick%3000===0)console.log('progress',g.tick,g.alive,p.origin.map(Math.round),p.ammo);
}
console.log('END',g.status,g.tick,g.stats,g.player.health,g.digest());
if(g.status!=='victory')process.exitCode=1;
else{fs.mkdirSync(new URL('../tests/fixtures/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../tests/fixtures/mission-replay.json',import.meta.url),JSON.stringify({version:1,seed:g.seed,inputs,checkpoints,finalDigest:g.digest(),finalStats:g.stats,digestPrecision:1e-6,inputSHA256:createHash('sha256').update(JSON.stringify(inputs)).digest('hex')})+'\n');}
