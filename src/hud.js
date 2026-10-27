import {v3,angleVectors} from './engine/math.js';
import {WEAPONS} from './game/weapons.js';
import {ENEMIES} from './game/enemies.js';
import {ABILITY} from './game/ability.js';
import {OBJECTIVES,objectiveTarget,interactTarget} from './game/objectives.js';
import {ZONES,RIFLE_PICKUP} from './game/level.js';
const AMBER='#eda344',PAPER='#e9e4db';
export class HUD {
  constructor(app,canvas){this.app=app;this.canvas=canvas;this.ctx=canvas.getContext('2d');}
  draw(){
    const a=this.app,g=a.sim,c=this.ctx,w=innerWidth,h=innerHeight;
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    c.clearRect(0,0,w,h);if(!g||a.screen==='menu')return;
    const p=g.player,t=g.tick/60,margin=w<800?18:35;
    const text=(s,x,y,size=11,color=PAPER,align='left')=>{c.font=`${size}px "Courier New",monospace`;c.fillStyle=color;c.textAlign=align;c.fillText(s,x,y);};
    const panel=(x,y,ww,hh)=>{c.fillStyle='rgba(12,15,16,.84)';c.fillRect(x,y,ww,hh);c.fillStyle=AMBER;c.fillRect(x,y,3,hh);};
    const zone=ZONES.find(z=>p.origin[0]>=z.from&&p.origin[0]<z.to)||ZONES[0];
    panel(margin,margin,Math.min(410,w-2*margin),70);
    text('MISSION 001 / '+zone.name,margin+17,margin+21,9,AMBER);
    text(OBJECTIVES[g.stage],margin+17,margin+43,w<800?11:13);
    text('0'+Math.min(7,g.stage+1)+' / 07   •   '+g.alive+' HOSTILES',margin+17,margin+59,9,'#a9aca5');
    // Direction indicator is driven by the actual objective location.
    const target=objectiveTarget(g),d=v3.sub(target,p.origin);let bearing=Math.atan2(d[1],d[0])*180/Math.PI-p.angles[1];bearing=((bearing+540)%360)-180;
    const dir=Math.abs(bearing)<20?'▲':bearing>0?'◀':'▶';
    text(dir+'  OBJECTIVE  '+Math.round(v3.len(d)/40)+'m',w-margin,margin+23,11,AMBER,'right');
    const mm=75,ox=w-margin-mm,oy=margin+48;
    if(w>900){c.fillStyle='rgba(10,13,14,.8)';c.fillRect(ox-mm,oy,mm*2,87);for(const z of ZONES){c.strokeStyle='#76776d';c.strokeRect(ox-mm+z.from/28,oy+42-z.half/15,(z.to-z.from)/28,z.half/7.5);}c.fillStyle=AMBER;c.fillRect(ox-mm+p.origin[0]/28-2,oy+42-p.origin[1]/15-2,4,4);c.fillStyle='#d34e39';for(const e of g.enemies)if(!e.dead)c.fillRect(ox-mm+e.origin[0]/28-1,oy+42-e.origin[1]/15-1,3,3);}
    // Crosshair + confirmed hit marker.
    const cx=w/2,cy=h/2;c.strokeStyle=PAPER;c.lineWidth=1.5;c.beginPath();for(const [x,y,dx,dy]of [[-10,0,-4,0],[4,0,10,0],[0,-10,0,-4],[0,4,0,10]]){c.moveTo(cx+x,cy+y);c.lineTo(cx+dx,cy+dy);}c.stroke();
    if(a.hitUntil>t){c.strokeStyle=AMBER;c.beginPath();for(const s of [-1,1])for(const q of [-1,1]){c.moveTo(cx+s*13,cy+q*13);c.lineTo(cx+s*19,cy+q*19);}c.stroke();}
    const bottom=h-100;panel(margin,bottom,165,66);text('OPERATOR INTEGRITY',margin+15,bottom+17,9,'#aaa99e');text(String(Math.ceil(p.health)).padStart(3,'0'),margin+14,bottom+50,32,p.health<35?'#ef705b':PAPER);text('/ 125',margin+94,bottom+47,11,'#aaa99e');
    panel(w-margin-220,bottom,220,66);text(p.weapon?WEAPONS[1].short+' / '+(p.rifleAuto?'AUTO':'SEMI'):WEAPONS[0].short,w-margin-203,bottom+18,10,AMBER);text(String(p.ammo[p.weapon]).padStart(3,'0'),w-margin-203,bottom+50,30);text(p.weapon?'40mm: '+p.ammo[2]:'ROUNDS / 01',w-margin-127,bottom+47,10,'#aaa99e');
    const bw=Math.min(310,w-465),bx=w/2-bw/2,by=h-83;
    if(bw>100){const cooldown=Math.max(0,(p.abilityReady-g.tick)/60);text(p.unlocked?'SHITPOSTER MODE':'SHITPOSTER / FIRMWARE REQUIRED',w/2,by-10,10,AMBER,'center');c.fillStyle='#222726';c.fillRect(bx,by,bw,7);c.fillStyle=AMBER;c.fillRect(bx,by,bw*p.charge/100,7);text(!p.unlocked?'RECOVER THE FIRMWARE':cooldown>0?'COOLDOWN '+cooldown.toFixed(1)+'s':p.charge>=100?'['+a.settings.abilityKey.slice(3)+'] READY TO DISRUPT':Math.floor(p.charge)+' / 100 CHARGE',w/2,by+27,10,PAPER,'center');}
    text('WASD MOVE  /  LMB FIRE  /  RMB 40mm / B MODE  /  E INTERACT',margin,h-15,w<800?8:9,'#c3bfb1');text(Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+'  |  '+g.stats.kills+' REMOVED',w-margin,h-15,10,AMBER,'right');
    const interact=interactTarget(g);
    if(interact){text('HOLD [E] TO '+(interact.kind==='core'?'SHUT DOWN BLOAT CORE':'ISOLATE RELAY'),cx,cy+75,12,AMBER,'center');c.fillStyle='#121818';c.fillRect(cx-90,cy+86,180,5);c.fillStyle=AMBER;c.fillRect(cx-90,cy+86,180*g.interactTicks/120,5);}
    else if(g.tick<360&&!p.hasRifle)text('MOVE THROUGH THE BAY. PISTOL READY. CLICK ONCE PER SHOT.',cx,h-145,11,AMBER,'center');
    if(a.toast&&a.toast.until>t){const str=a.toast.text;c.fillStyle='rgba(10,13,14,.85)';const tw=Math.min(w-40,str.length*7+38);c.fillRect(cx-tw/2,h-190,tw,35);text(str,cx,h-168,w<900?9:11,AMBER,'center');}
    if(!p.hasRifle&&g.stage>=1){const xy=a.project(v3.add(RIFLE_PICKUP,[0,0,42]));if(xy)text('DEPENDENCY REMOVER / PICK UP',xy[0],xy[1],11,AMBER,'center');}
    // Labels are projected above real actors and occluded by world geometry.
    for(const e of g.enemies){if(e.dead||v3.dist(p.origin,e.origin)>800||!g.world.lineClear(a.eye,g.eye(e)))continue;const xy=a.project(v3.add(e.origin,[0,0,47]));if(!xy)continue;const stunned=g.tick<e.stunUntil;const label=stunned?'PROCESS SUSPENDED':ENEMIES[e.kind].name;text(label,xy[0],xy[1],9,stunned?AMBER:'#ddd8c8','center');c.fillStyle='#201f19';c.fillRect(xy[0]-29,xy[1]+6,58,3);c.fillStyle=stunned?AMBER:'#bc5445';c.fillRect(xy[0]-29,xy[1]+6,58*e.health/e.maxHealth,3);}
    for(const l of a.fx.labels){const xy=a.project(v3.add(l.origin,[0,0,62+(2-l.life)*20]));if(xy)text(l.text,xy[0],xy[1],11,AMBER,'center');}
    if(a.damageUntil>t){c.strokeStyle=`rgba(187,44,28,${a.settings.reduced?.25:.6})`;c.lineWidth=12;c.strokeRect(6,6,w-12,h-12);}
    if(a.fx.pulse>0&&!a.settings.reduced){c.strokeStyle=`rgba(237,163,68,${a.fx.pulse*.55})`;c.lineWidth=3;const r=(1-a.fx.pulse)*Math.hypot(w,h);c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.stroke();}
    if(g.tick<p.abilityUntil)text('SHITPOSTER ACTIVE / '+((p.abilityUntil-g.tick)/60).toFixed(1)+'s',cx,145,12,AMBER,'center');
    if(a.settings.debug){panel(margin,125,300,64);text(`${a.fps.toFixed(0)} FPS / ${a.frameMs.toFixed(1)} ms frame`,margin+12,145,11);text(`SIM ${a.simMs.toFixed(2)}ms / ${g.tick} TICKS / ${g.alive} AI`,margin+12,163,10);text(`${g.projectiles.length} PROJECTILES / ${a.fx.points.length} PARTICLES`,margin+12,178,10);}
  }
}
