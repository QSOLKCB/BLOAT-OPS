// BLOAT-OPS browser shell. Engine adapters stay separate from deterministic gameplay.
import {Renderer} from './engine/renderer.js';
import {v3,m4,vecToAngles,angleVectors,clamp} from './engine/math.js';
import {boxBrush} from './engine/world.js';
import {NavMesh} from './engine/nav.js';
import {visibleFaces,bakeLightmaps,LM_SIZE} from './engine/lightmap.js';
import {fetchBuf} from './engine/formats.js';
import {Assets} from './assets.js';
import {Sound} from './sound.js';
import {Effects} from './effects.js';
import {HUD} from './hud.js';
import {buildLevel,POWERUP,RELAYS,CORE,EXTRACT} from './game/level.js';
import {Simulation,FixedClock} from './game/simulation.js';
import {WEAPONS} from './game/weapons.js';
import {ENEMIES} from './game/enemies.js';
const $=id=>document.getElementById(id);
const DEFAULTS={sensitivity:4,fov:90,volume:.6,abilityKey:'KeyF',reduced:false,shake:true,debug:false};
function readSettings(){let s={};try{s=JSON.parse(localStorage.getItem('bloat-ops.settings.v1')||'{}')||{};}catch{}const out={...DEFAULTS};for(const [k,lo,hi]of [['sensitivity',1,10],['fov',75,115],['volume',0,1]])if(Number.isFinite(s[k]))out[k]=clamp(s[k],lo,hi);for(const k of ['reduced','shake','debug'])if(typeof s[k]==='boolean')out[k]=s[k];if(['KeyF','KeyG','KeyV','KeyT'].includes(s.abilityKey))out.abilityKey=s.abilityKey;return out;}
export class App {
  constructor(){this.settings=readSettings();this.screen='menu';this.sim=null;this.ready=false;this.clock=new FixedClock();this.keys=new Set();this.buttons=new Set();this.angles=[0,0,0];this.weapon=-1;this.fps=60;this.frameMs=0;this.simMs=0;this.last=0;this.hitUntil=0;this.damageUntil=0;this.recording=[];this.recordingLimit=36000;this.recordingTruncated=false;this.frames=0;this.renderMs=0;this.tickSamples=[];this.frameSamples=[];}
  async init(){
    this.bindUI();this.renderer=new Renderer($('game'));this.audio=new Sound();this.fx=new Effects();this.hud=new HUD(this,$('hud'));
    this.loading('BUILDING THE DEPENDENCY FACTORY');this.map=buildLevel();
    this.assets=new Assets(this.renderer);await this.assets.load(f=>this.loading('VERIFYING LOCAL ASSETS / '+Math.round(f*100)+'%'));
    this.loading('PREPARING NAVIGATION');this.nav=new NavMesh(this.map.world,{seeds:[this.map.spawn]});
    this.loading('BAKING INDUSTRIAL LIGHTING');
    const bake=await bakeLightmaps(this.map.world,visibleFaces(this.map.world),{lights:this.map.lights,ambient:this.map.ambient},f=>this.loading('BAKING LIGHTING / '+Math.round(f*100)+'%'));
    this.renderer.buildWorld(bake,n=>this.assets.tex(n),LM_SIZE);
    this.prepareModels();
    this.ready=true;$('start').disabled=false;$('start').innerHTML='BEGIN OPERATION <span>↗</span>';this.loading('SYSTEM READY / ALL RESOURCES LOCAL');
    this.bindInput();this.last=performance.now();requestAnimationFrame(t=>this.frame(t));
  }
  loading(text){$('load-status').textContent=text;}
  prepareModels(){
    const r=this.renderer,tex=n=>this.assets.tex(n),model=boxes=>r.buildBrushModel(boxes.map(([a,b,t])=>boxBrush(a,b,t)),tex);
    this.gates=this.map.gates.map(g=>r.buildBrushModel(g.brushes,tex));
    this.pickup=model([[[-14,-14,-10],[14,14,10],'steel'],[[-15,-5,-2],[15,5,3],'health_fbr']]);
    this.firmware=model([[[-13,-13,-13],[13,13,13],'amber_fbr'],[[-19,-19,-18],[19,19,-13],'steel']]);
    this.terminal=model([[[-22,-16,0],[22,16,12],'terminal_fbr']]);
    this.bolt=model([[[-5,-3,-3],[5,3,3],'core_fbr']]);
    this.signs=this.map.signs.map(s=>{
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#242a29';c.fillRect(0,0,1024,256);c.fillStyle='#d79940';c.fillRect(0,0,12,256);c.font='bold 38px monospace';c.fillText(s.title,44,100);c.font='18px monospace';c.fillStyle='#b5b5a7';c.fillText(s.sub,44,155);c.fillStyle='#d79940';c.fillRect(44,193,170,7);
      const verts=[];for(const [x,z,u,v]of [[-160,-40,0,1],[160,-40,1,1],[160,40,1,0],[-160,40,0,0]])verts.push(x,0,z,u,v,0,0,0,-1,0);
      const texture=r.textureFromImage(canvas);const group=r.makeGroupVAO({verts,idx:[0,1,2,0,2,3]});
      return {...s,model:{groups:[{...group,tex:texture}]}};
    });
  }
  bindUI(){
    $('start').onclick=()=>this.start();$('restart').onclick=()=>this.start();$('retry').onclick=()=>this.start();$('resume').onclick=()=>this.resume();
    $('result-menu').onclick=()=>{this.sim=null;this.audio.ambient(false);this.show('menu');};
    for(const id of ['settings-open','pause-settings'])$(id).onclick=()=>{this.returnScreen=this.screen;this.fillSettings();this.show('settings');};
    $('settings-close').onclick=()=>{this.saveSettings();this.show(this.returnScreen||'menu');};
    $('credits-open').onclick=async()=>{this.show('credits');if(!$('license-text').children.length){for(const [title,path]of [['Apache-2.0 — code','LICENSE'],['BSD-3-Clause — LibreQuake textures','assets/licenses/librequake/COPYING'],['Quaternius — CC0 models','assets/licenses/quaternius-guns.txt']]){try{const raw=await fetchBuf(path);const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=title;pre.textContent=new TextDecoder().decode(raw);details.append(summary,pre);$('license-text').append(details);}catch(e){$('license-text').textContent=e.message;}}}};
    $('credits-close').onclick=()=>this.show('menu');
    for(const id of ['sensitivity','fov','volume'])$(id).oninput=()=>$(`${id}-value`).textContent=$(id).value;
  }
  fillSettings(){for(const k of ['sensitivity','fov','volume']){$(k).value=this.settings[k];$(k+'-value').textContent=this.settings[k];}for(const k of ['reduced','shake','debug'])$(k).checked=this.settings[k];$('ability-key').value=this.settings.abilityKey;}
  saveSettings(){for(const k of ['sensitivity','fov','volume'])this.settings[k]=Number($(k).value);for(const k of ['reduced','shake','debug'])this.settings[k]=$(k).checked;this.settings.abilityKey=$('ability-key').value;this.audio.setVolume(this.settings.volume);try{localStorage.setItem('bloat-ops.settings.v1',JSON.stringify(this.settings));}catch{}}
  show(screen){this.screen=screen;for(const id of ['menu','pause','settings','result','credits'])$(id).hidden=id!==screen;$('interface').classList.toggle('playing',!!this.sim&&screen!=='menu');if(screen!=='playing'){this.clearInput();this.clock.reset();this.audio?.ambient(false);}}
  start(seed=this.sim?.seed??0xB10A7001){if(!this.ready)return;this.sim=new Simulation(this.map,this.nav,seed);this.angles=[0,0,0];this.fx=new Effects();this.recording=[];this.recordingTruncated=false;this.toast=null;this.hitUntil=this.damageUntil=0;this.weapon=-1;this.resume();}
  resume(){if(!this.sim||this.sim.status!=='playing')return;this.clearInput();this.clock.reset();this.show('playing');this.audio.start(this.settings.volume);this.audio.ambient(true);this.last=performance.now();const result=$('game').requestPointerLock?.();if(result?.catch)result.catch(()=>{this.toast={text:'CLICK THE VIEW TO CAPTURE THE MOUSE',until:this.sim.tick/60+5};});}
  pause(){if(this.screen!=='playing')return;this.show('pause');if(document.pointerLockElement)document.exitPointerLock();}
  clearInput(){this.keys.clear();this.buttons.clear();this.abilityPressed=false;this.weapon=-1;}
  bindInput(){
    window.addEventListener('keydown',e=>{if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&this.screen==='playing')e.preventDefault();if(e.code==='Escape'){if(this.screen==='playing')this.pause();return;}if(this.screen!=='playing')return;if(e.repeat)return;this.keys.add(e.code);if(e.code===this.settings.abilityKey)this.abilityPressed=true;if(e.code==='Digit1')this.weapon=0;if(e.code==='Digit2')this.weapon=1;if(e.code==='KeyP')this.settings.debug=!this.settings.debug;});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('mousemove',e=>{if(this.screen==='playing'&&document.pointerLockElement===$('game')){if(this.ignoreMouse){this.ignoreMouse=false;return;}this.angles[1]-=e.movementX*this.settings.sensitivity*.035;this.angles[0]=clamp(this.angles[0]+e.movementY*this.settings.sensitivity*.035,-85,85);}});
    $('game').addEventListener('mousedown',e=>{if(this.screen!=='playing')return;this.buttons.add(e.button);if(document.pointerLockElement!==$('game')){const p=$('game').requestPointerLock?.();p?.catch?.(()=>{});}});
    window.addEventListener('mouseup',e=>this.buttons.delete(e.button));$('game').addEventListener('contextmenu',e=>e.preventDefault());
    $('game').addEventListener('wheel',e=>{if(this.screen==='playing'){e.preventDefault();this.weapon=1-this.sim.player.weapon;}},{passive:false});
    document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement){this.ignoreMouse=true;if(this.screen!=='playing'){document.exitPointerLock();return;}}if(!document.pointerLockElement&&this.screen==='playing')this.pause();});
    window.addEventListener('blur',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
  }
  input(){const k=this.keys;return {forward:(k.has('KeyW')?1:0)-(k.has('KeyS')?1:0),side:(k.has('KeyD')?1:0)-(k.has('KeyA')?1:0),jump:k.has('Space'),sprint:k.has('ShiftLeft')||k.has('ShiftRight'),aim:k.has('KeyQ'),fire:this.buttons.has(0),secondary:this.buttons.has(2),ability:!!this.abilityPressed,interact:k.has('KeyE'),weapon:this.weapon,angles:this.angles.slice()};}
  consumeEvents(){const g=this.sim,t=g.tick/60;for(const e of g.events){
    if(e.type==='shot'){this.audio.fx(e.weapon?'cannon':'rifle');this.fx.lines.push({a:e.origin,b:e.end,color:[1,.66,.23],life:.06});this.fx.burst(e.end,[.95,.66,.25],e.hit?6:3);}
    if(e.type==='hit'){this.hitUntil=t+.12;this.audio.fx('hit',null,.3);}
    if(e.type==='explosion'){this.fx.burst(e.origin,[1,.45,.12],this.settings.reduced?12:50);this.audio.fx('explosion',e.origin);}
    if(e.type==='enemyShot')this.audio.fx('enemy',e.origin,.45);
    if(e.type==='damage'){this.damageUntil=t+.24;this.audio.fx('damage',null,.35);}
    if(e.type==='kill')this.fx.burst(e.origin,[.63,.5,.3],15);
    if(e.type==='ability'){this.audio.fx('ability');this.fx.pulse=1;this.fx.burst(e.origin,[1,.72,.25],this.settings.reduced?10:60);this.toast={text:e.count+' PROCESSES SUSPENDED. SKILL ISSUE DETECTED.',until:t+3};}
    if(e.type==='stun'){this.fx.labels.push({origin:e.origin,text:e.text,life:2});}
    if(['objective','unlock','core'].includes(e.type)){this.toast={text:e.text,until:t+5};$('live-message').textContent=e.text;this.audio.fx('pickup');}
    if(e.type==='supply'){this.toast={text:'SUPPLIES RESTORED. NO SUBSCRIPTION REQUIRED.',until:t+2};this.audio.fx('pickup');}
    if(e.type==='victory'||e.type==='defeat')this.end();
  }}
  end(){const g=this.sim,win=g.status==='victory';this.show('result');if(document.pointerLockElement)document.exitPointerLock();$('result-kind').textContent=win?'OPERATION COMPLETE':'PROCESS TERMINATED';$('result-title').textContent=win?'BLOAT REMOVED.':'SEGMENTATION FAULT.';$('result-message').textContent=win?'Your dependencies have been terminated. The extraction vehicle has zero mandatory updates.':'Corporate overhead got you. Restart the same mission and try a different approach.';$('result-stats').replaceChildren();for(const [label,value]of [['DEPENDENCIES REMOVED',g.stats.kills],['PROCESSES STUNNED',g.stats.stuns],['ELAPSED',Math.floor(g.tick/3600)+':'+String(Math.floor(g.tick/60)%60).padStart(2,'0')],['REPLAY DIGEST',g.digest()]]){const el=document.createElement('div'),n=document.createElement('strong');n.textContent=value;el.append(n,document.createTextNode(label));$('result-stats').append(el);}}
  frame(now){const dt=Math.min(.25,Math.max(0,(now-this.last)/1000));this.last=now;this.frameMs+=(dt*1000-this.frameMs)*.05;this.fps+=(1/Math.max(dt,.001)-this.fps)*.05;
    const before=performance.now();if(this.screen==='playing'){this.clock.advance(dt,()=>{if(this.sim.status!=='playing')return;const input=this.input();if(this.recording.length<this.recordingLimit)this.recording.push(input);else this.recordingTruncated=true;this.sim.step(input);this.abilityPressed=false;this.weapon=-1;this.consumeEvents();});this.fx.update(dt);}this.simMs=performance.now()-before;
    const r0=performance.now();this.render(now/1000);this.hud.draw();this.renderMs=performance.now()-r0;this.frames++;
    if(this.screen==='playing'&&this.frames%10===0){this.tickSamples.push(this.simMs);this.frameSamples.push(this.renderMs);if(this.frameSamples.length>600){this.tickSamples.shift();this.frameSamples.shift();}}
    requestAnimationFrame(t=>this.frame(t));
  }
  render(time){const r=this.renderer,g=this.sim,p=g?.player;
    let angles,eye;
    if(!g){eye=[2510,-470,100];angles=vecToAngles(v3.sub([3190,120,78],eye));angles[1]+=Math.sin(time*.12)*5;}
    else{eye=v3.add(v3.lerp(p.prevOrigin,p.origin,clamp(this.clock.accum*60,0,1)),[0,0,p.dead?0:22]);angles=this.angles.slice();if(this.settings.shake&&this.screen==='playing'){const speed=Math.hypot(p.velocity[0],p.velocity[1]);eye[2]+=Math.sin(g.tick*.15)*Math.min(1,speed/240)*1.1;const kick=Math.max(0,1-(g.tick-p.lastFire)/9);angles[0]-=kick*WEAPONS[p.lastWeapon].recoil;}}
    this.eye=eye;r.dlights=[];
    if(g){for(const pr of g.projectiles.slice(0,6))r.dlights.push({origin:pr.origin,radius:150,color:pr.owner==='player'?[1,.6,.2]:[1,.22,.08]});if(g.tick<p.abilityUntil)r.dlights.push({origin:eye,radius:300,color:[.7,.45,.13]});}
    r.beginFrame(eye,angles,g&&p.aiming?65:this.settings.fov,time);r.drawWorld();
    for(const s of this.signs)r.drawBrushModel(s.model,s.origin,[.9,.85,.72],s.origin[1]<0?[0,180,0]:[0,0,0]);
    for(let i=0;i<this.gates.length;i++)if(!g||g.world.movers[i].solid)r.drawBrushModel(this.gates[i],this.map.gates[i].origin,[.55,.5,.4]);
    if(g){const t=g.tick/60,alpha=clamp(this.clock.accum*60,0,1);
      for(const s of g.supplies)if(!s.used)r.drawBrushModel(this.pickup,v3.add(s.origin,[0,0,Math.sin(t*2+s.id)*3]),[.9,1,.85],[0,t*25,0]);
      if(!p.unlocked)r.drawBrushModel(this.firmware,POWERUP,[1,.9,.6],[0,t*35,0]);
      for(let i=0;i<2;i++)r.drawBrushModel(this.terminal,RELAYS[i],g.relays[i]?[.2,.35,.2]:[1,1,.7]);
      r.drawBrushModel(this.terminal,CORE,g.stage>=5?[.2,.25,.2]:[1,.8,.5]);
      if(g.stage===6)r.drawBrushModel(this.firmware,EXTRACT,[.6,1,.7],[0,t*40,0]);
      for(const e of g.enemies){if(e.dead&&g.tick-e.deathTick>180)continue;const o=v3.lerp(e.prevOrigin,e.origin,alpha);const state=e.dead?'death':e.state==='stunned'?'stun':e.state==='attack'?'attack':e.state==='move'?'move':'idle';const age=e.dead?(g.tick-e.deathTick)/60:state==='stun'?(180-(e.stunUntil-g.tick))/60:state==='attack'?(ENEMIES[e.kind].windup-(e.windup-g.tick))/60:t+e.id*.17;
        const model=ENEMIES[e.kind].model,[fa,fb,blend]=this.assets.frame(model,state,Math.max(0,age));const tint=g.tick<e.stunUntil?[1,.7,.2,.45]:g.tick-e.lastDamage<7?[1,.25,.1,.4]:null;
        r.drawModel(this.assets.model(model),fa,fb,blend,m4.model(o,[0,e.angles[1],0]),'default',[.95,.9,.8],tint);
        // Visible held weapon, kept lightweight and separate from skinned character animation.
        if(!e.dead){const f=angleVectors([0,e.angles[1],0]).forward;const gunPos=v3.add(v3.ma(o,9,f),[0,0,12]);r.drawModel(this.assets.model(e.kind==='harvester'?'rifle':'cannon'),0,0,0,m4.model(gunPos,[0,e.angles[1],0],.55),'default',[.9,.87,.8]);}
      }
      for(const pr of g.projectiles)r.drawBrushModel(this.bolt,pr.origin,pr.owner==='player'?[1,.8,.3]:[1,.3,.1]);
      this.fx.draw(r);
      if(!p.dead){const {forward,right,up}=angleVectors(angles),kick=Math.max(0,1-(g.tick-p.lastFire)/10);let pos=v3.add(v3.ma(eye,12-kick*3,forward),v3.add(v3.scale(right,p.aiming?3:9),v3.scale(up,-10-kick)));r.beginViewModel();r.drawModel(this.assets.model(WEAPONS[p.weapon].model),0,0,0,m4.model(pos,[angles[0]+kick*3,angles[1],0],p.weapon?.40:.60),'default',[1.3,1.2,1.05]);r.endViewModel();}
      const basis=angleVectors(angles);this.audio.setListener(eye,basis.forward,basis.up);
    }
  }
  project(pos){const m=this.renderer.vp,x=pos[0],y=pos[1],z=pos[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;const xx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,yy=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;if(Math.abs(xx)>1.2||Math.abs(yy)>1.2)return null;return [(xx*.5+.5)*innerWidth,(-yy*.5+.5)*innerHeight];}
  exportReplay(){return {version:1,seed:this.sim.seed,truncated:this.recordingTruncated,inputs:this.recording,digest:this.sim.digest()};}
}
const app=new App();
// Small inspectable debug surface, also exercised by browser regressions; no network access.
window.bloat=app;
app.init().catch(e=>{console.error(e);$('load-status').textContent='STARTUP FAILED: '+e.message;$('start').textContent='UNABLE TO START';$('start').disabled=true;});
