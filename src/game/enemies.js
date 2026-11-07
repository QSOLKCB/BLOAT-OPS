import { v3, vecToAngles } from '../engine/math.js';
import { playerMove } from '../engine/pmove.js';
import { MAX_PROJECTILES } from './weapons.js';
export const ENEMIES = Object.freeze({
  harvester: {name:'TELEMETRY HARVESTER',health:72,speed:190,range:420,damage:8,windup:30,interval:95,model:'harvester'},
  manager: {name:'MIDDLEWARE MANAGER',health:180,speed:105,range:650,damage:16,windup:50,interval:125,model:'manager'},
  // Boss: reuses the CC0 manager mesh, scaled and tinted. Spread volleys; SHITPOSTER stuns it for 60 ticks
  // instead of 180. At half health it escalates once (faster, wider volleys) and calls two bounded adds.
  architect: {name:'ENTERPRISE SOLUTIONS ARCHITECT',health:1500,speed:95,range:720,damage:12,windup:42,interval:85,model:'manager',scale:1.18,tint:[.55,.18,.75,.22],stun:60,boss:true,volley:3,spread:12,phase2:{interval:55,volley:5,spread:24}},
});
export function updateEnemies(g) {
  const p=g.player;
  for(const e of g.enemies) {
    if(e.dead) continue;
    e.prevOrigin=e.origin.slice();
    if(g.tick<e.stunUntil) { e.state='stunned'; e.windup=0; e.velocity=[0,0,0]; continue; }
    if(e.state==='stunned') { e.state='recovering'; g.emit('recover',{id:e.id}); }
    const d=v3.dist(e.origin,p.origin), see=g.world.lineClear(g.eye(e),g.eye(p));
    // Acquisition is bounded and retains awareness so enemies don't forget around cover.
    if((d<1050 && see) || g.tick-e.heardShot<180) e.awake=true;
    if(!e.awake) { e.state='idle'; continue; }
    const def=ENEMIES[e.kind];
    e.angles=vecToAngles(v3.sub(g.eye(p),g.eye(e)));
    if(e.windup) {
      e.state='attack'; e.velocity=[0,0,0];
      if(g.tick>=e.windup) {
        const phase=e.phase2&&def.phase2?def.phase2:def;
        e.windup=0; e.nextAttack=g.tick+phase.interval;
        if(see && d<def.range+100 && g.projectiles.length<MAX_PROJECTILES) {
          const origin=g.eye(e), target=g.eye(p);
          // Enemy projectiles remain dodgeable; seeded aim jitter is simulation state.
          target[0]+=(g.rng.next()-.5)*30;target[1]+=(g.rng.next()-.5)*30;
          const aim=v3.norm(v3.sub(target,origin)),speed=e.kind==='harvester'?500:e.kind==='architect'?420:370,count=phase.volley||1;
          // Volleys fan evenly across +/- spread degrees in yaw; the projectile cap still applies to each bolt.
          for(let i=0;i<count&&g.projectiles.length<MAX_PROJECTILES;i++){
            const a=count>1?(-phase.spread+2*phase.spread*i/(count-1))*Math.PI/180:0,c=Math.cos(a),s=Math.sin(a);
            const dir=[aim[0]*c-aim[1]*s,aim[0]*s+aim[1]*c,aim[2]];
            g.projectiles.push({id:g.nextId++,owner:e.id,origin:origin.slice(),prevOrigin:origin.slice(),velocity:v3.scale(dir,speed),damage:def.damage,radius:0,until:g.tick+240});
          }
          g.emit('enemyShot',{origin:origin.slice(),kind:e.kind});
        }
      }
      continue;
    }
    if(see && d<def.range && g.tick>=e.nextAttack) {
      e.windup=g.tick+def.windup; e.state='attack'; g.emit('windup',{id:e.id,origin:e.origin.slice()}); continue;
    }
    let target=p.origin;
    if(!g.clearHull(e.origin,p.origin)) {
      // Repath at most once per second per enemy, staggered by ID.
      if(g.tick>=e.nextPath) {
        const a=g.nav.nearest(e.origin), b=g.nav.nearest(p.origin);
        e.path=(g.nav.findPath(a,b)||[]).map(n=>n.id); e.pathIndex=1;e.nextPath=g.tick+60+(e.id%15);
      }
      while(e.pathIndex<e.path.length && v3.dist(e.origin,g.nav.nodes[e.path[e.pathIndex]].p)<35) e.pathIndex++;
      if(e.pathIndex<e.path.length) target=g.nav.nodes[e.path[e.pathIndex]].p;
    }
    let dir=v3.sub(target,e.origin);dir[2]=0;
    // Simple deterministic crowd separation, bounded by the enemy cap.
    for(const other of g.enemies) if(other!==e&&!other.dead) {
      const offset=v3.sub(e.origin,other.origin), dist=Math.hypot(offset[0],offset[1]);
      if(dist<48&&dist>0.01) {dir[0]+=offset[0]/dist*55;dir[1]+=offset[1]/dist*55;}
    }
    const moving=d>90 && (!see || d>def.range*.65);
    const yaw=vecToAngles(dir)[1]; e.state=moving?'move':'idle';
    const cmd={forward:moving?def.speed:0,side:0,up:0,jump:false,angles:[0,yaw,0]};
    playerMove(e,cmd,1/60);
  }
}
