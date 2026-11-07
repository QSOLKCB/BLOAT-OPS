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
import {buildLevel,RIFLE_PICKUP,POWERUP,RELAYS,CORE,EXTRACT} from './game/level.js';
import {Simulation,FixedClock,encodeState,decodeState} from './game/simulation.js';
import {levelId,validateReplay,verifyReplay,REPLAY_FORMAT,REPLAY_VERSION} from './game/replay.js';
import {OBJECTIVES} from './game/objectives.js';
import {WEAPONS} from './game/weapons.js';
import {ENEMIES} from './game/enemies.js';
import {FpsGamepad,PadNav,standardPads,lookRate} from './gamepad.js';
const $=id=>document.getElementById(id);
const DEFAULTS={sensitivity:4,fov:90,volume:.6,abilityKey:'KeyF',reduced:false,shake:true,debug:false,padSensitivity:4,padInvert:false};
function readSettings(){let s={};try{s=JSON.parse(localStorage.getItem('bloat-ops.settings.v1')||'{}')||{};}catch{}const out={...DEFAULTS};for(const [k,lo,hi]of [['sensitivity',1,10],['fov',75,115],['volume',0,1],['padSensitivity',1,10]])if(Number.isFinite(s[k]))out[k]=clamp(s[k],lo,hi);for(const k of ['reduced','shake','debug','padInvert'])if(typeof s[k]==='boolean')out[k]=s[k];if(['KeyF','KeyG','KeyV','KeyT'].includes(s.abilityKey))out.abilityKey=s.abilityKey;return out;}
export class App {
  constructor(){this.pad=new FpsGamepad();this.padNav=new PadNav();this.padState=null;this.padUsed=false;this.navContext='';this.settings=readSettings();this.screen='menu';this.sim=null;this.ready=false;this.clock=new FixedClock();this.keys=new Set();this.buttons=new Set();this.angles=[0,0,0];this.weapon=-1;this.fps=60;this.frameMs=0;this.simMs=0;this.last=0;this.hitUntil=0;this.damageUntil=0;this.recording=[];this.recordingLimit=36000;this.recordingTruncated=false;this.frames=0;this.renderMs=0;this.tickSamples=[];this.frameSamples=[];}
  async init(){
    this.bindUI();this.renderer=new Renderer($('game'));this.audio=new Sound();this.fx=new Effects();this.hud=new HUD(this,$('hud'));
    this.loading('BUILDING THE DEPENDENCY FACTORY');this.map=buildLevel();
    this.assets=new Assets(this.renderer);await this.assets.load(f=>this.loading('VERIFYING LOCAL ASSETS / '+Math.round(f*100)+'%'));
    this.loading('PREPARING NAVIGATION');this.nav=new NavMesh(this.map.world,{seeds:[this.map.spawn]});this.level=levelId(this.map);
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
    this.pistol=model([[[0,-1.6,0],[12,1.6,2.5],'gunmetal_fbr'],[[0,-1.4,-7],[3,1.4,0],'grip_fbr'],[[3,-.6,-3],[7,.6,-2],'gunmetal_fbr'],[[6,-.6,-2],[7,.6,0],'gunmetal_fbr'],[[12,-.9,.7],[15,.9,1.8],'gunmetal_fbr'],[[10,-.3,2.5],[11,.3,3.2],'sight_fbr'],[[0,-1.6,2.5],[1,-.7,3.2],'gunmetal_fbr'],[[0,.7,2.5],[1,1.6,3.2],'gunmetal_fbr']]);
    this.launcher=model([[[8,-1.7,-4.5],[20,1.7,-1.5],'grip_fbr'],[[20,-1.3,-4.1],[25,1.3,-1.9],'gunmetal_fbr'],[[8,-1.8,-4],[11,-1.7,-2],'amber_fbr']]);
    this.grenade=model([[[-3,-2,-2],[3,2,2],'amber_fbr']]);
    this.bolt=model([[[-5,-3,-3],[5,3,3],'core_fbr']]);
    this.signs=this.map.signs.map(s=>{
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#242a29';c.fillRect(0,0,1024,256);c.fillStyle='#d79940';c.fillRect(0,0,12,256);c.font='bold 38px monospace';c.fillText(s.title,44,100);c.font='18px monospace';c.fillStyle='#b5b5a7';c.fillText(s.sub,44,155);c.fillStyle='#d79940';c.fillRect(44,193,170,7);
      const verts=[];for(const [x,z,u,v]of [[-160,-40,0,1],[160,-40,1,1],[160,40,1,0],[-160,40,0,0]])verts.push(x,0,z,u,v,0,0,0,-1,0);
      const texture=r.textureFromImage(canvas);const group=r.makeGroupVAO({verts,idx:[0,1,2,0,2,3]});
      // The quad spans x ±160 and z ±40 in model space; its exact bound keeps frustum culling conservative.
      return {...s,model:{groups:[{...group,tex:texture}],bound:Math.hypot(160,40)}};
    });
  }
  bindUI(){
    $('start').onclick=()=>this.start();$('restart').onclick=()=>this.start();$('retry').onclick=()=>this.start();$('resume').onclick=()=>this.resume();
    $('result-menu').onclick=()=>{this.sim=null;this.audio.ambient(false);this.show('menu');};
    $('checkpoint-restart').onclick=$('result-checkpoint').onclick=()=>this.restartCheckpoint();
    $('replay-export').onclick=$('result-export').onclick=()=>this.downloadReplay();
    $('replay-open').onclick=$('replay-again').onclick=()=>{$('replay-file').value='';$('replay-file').click();};
    $('replay-file').onchange=()=>{const f=$('replay-file').files[0];if(f)f.text().then(t=>this.openReplay(t),e=>this.replayReport('FILE UNREADABLE.',e.message,[]));};
    $('replay-watch').onclick=()=>this.startWatch();
    $('replay-close').onclick=()=>{this.sim=null;this.imported=null;this.show('menu');};
    for(const id of ['settings-open','pause-settings'])$(id).onclick=()=>{this.returnScreen=this.screen;this.fillSettings();this.show('settings');};
    $('settings-close').onclick=()=>{this.saveSettings();this.show(this.returnScreen||'menu');};
    $('credits-open').onclick=async()=>{this.show('credits');if(!$('license-text').children.length){for(const [title,path]of [['BLOAT-OPS — full attribution notice','NOTICE'],['Apache-2.0 — code','LICENSE'],['BSD-3-Clause — LibreQuake textures','assets/licenses/librequake/COPYING'],['Quaternius — CC0 models','assets/licenses/quaternius-guns.txt']]){try{const raw=await fetchBuf(path);const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent=title;pre.textContent=new TextDecoder().decode(raw);details.append(summary,pre);$('license-text').append(details);}catch(e){$('license-text').textContent=e.message;}}}};
    $('credits-close').onclick=()=>this.show('menu');
    for(const id of ['sensitivity','fov','volume','padSensitivity'])$(id).oninput=()=>$(`${id}-value`).textContent=$(id).value;
  }
  fillSettings(){for(const k of ['sensitivity','fov','volume','padSensitivity']){$(k).value=this.settings[k];$(k+'-value').textContent=this.settings[k];}for(const k of ['reduced','shake','debug','padInvert'])$(k).checked=this.settings[k];$('ability-key').value=this.settings.abilityKey;}
  saveSettings(){for(const k of ['sensitivity','fov','volume','padSensitivity'])this.settings[k]=Number($(k).value);for(const k of ['reduced','shake','debug','padInvert'])this.settings[k]=$(k).checked;this.settings.abilityKey=$('ability-key').value;this.audio.setVolume(this.settings.volume);try{localStorage.setItem('bloat-ops.settings.v1',JSON.stringify(this.settings));}catch{}}
  show(screen){this.screen=screen;for(const id of ['menu','pause','settings','result','credits','replay'])$(id).hidden=id!==screen;for(const id of ['checkpoint-restart','result-checkpoint'])$(id).hidden=!this.checkpoint||!!this.watch;for(const id of ['replay-export','result-export'])$(id).hidden=!!this.watch;$('interface').classList.toggle('playing',!!this.sim&&screen!=='menu');if(screen!=='playing'){this.clearInput();this.clock.reset();this.audio?.ambient(false);}}
  start(seed=this.sim?.seed??0xB10A7001){if(!this.ready)return;this.watch=null;this.checkpoint=null;this.lastStage=0;this.sim=new Simulation(this.map,this.nav,seed);this.angles=[0,0,0];this.fx=new Effects();this.recording=[];this.recordingTruncated=false;this.toast=null;this.hitUntil=this.damageUntil=0;this.weapon=-1;this.resume();}
  resume(){if(!this.sim||this.sim.status!=='playing')return;this.clearInput();this.clock.reset();this.show('playing');this.audio.start(this.settings.volume);this.audio.ambient(true);this.last=performance.now();const result=$('game').requestPointerLock?.();if(result?.catch)result.catch(()=>{if(!this.padUsed)this.toast={text:'CLICK THE VIEW TO CAPTURE THE MOUSE',until:this.sim.tick/60+5};});}
  pause(){if(this.screen!=='playing')return;this.show('pause');if(document.pointerLockElement)document.exitPointerLock();}
  clearInput(){this.pad.disarm();this.padState=null;this.keys.clear();this.buttons.clear();this.abilityPressed=false;this.modePressed=false;this.firePresses=0;this.altPresses=0;this.weapon=-1;}
  bindInput(){
    window.addEventListener('keydown',e=>{if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&this.screen==='playing')e.preventDefault();if(e.code==='Escape'){if(this.screen==='playing')this.pause();else if(this.screen==='watch')this.stopWatch();return;}if(this.screen!=='playing')return;if(e.repeat)return;this.padUsed=false;this.keys.add(e.code);if(e.code===this.settings.abilityKey)this.abilityPressed=true;if(e.code==='Digit1')this.weapon=0;if(e.code==='Digit2')this.weapon=1;if(e.code==='KeyB')this.modePressed=true;if(e.code==='KeyP')this.settings.debug=!this.settings.debug;});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('mousemove',e=>{if(this.screen==='playing'&&document.pointerLockElement===$('game')){if(this.ignoreMouse){this.ignoreMouse=false;return;}this.angles[1]-=e.movementX*this.settings.sensitivity*.035;this.angles[0]=clamp(this.angles[0]+e.movementY*this.settings.sensitivity*.035,-85,85);}});
    $('game').addEventListener('mousedown',e=>{if(this.screen!=='playing')return;if(!this.buttons.has(e.button)){if(e.button===0)this.firePresses=Math.min(8,this.firePresses+1);if(e.button===2)this.altPresses=Math.min(8,this.altPresses+1);}this.buttons.add(e.button);if(document.pointerLockElement!==$('game')){const p=$('game').requestPointerLock?.();p?.catch?.(()=>{});}});
    window.addEventListener('mouseup',e=>this.buttons.delete(e.button));$('game').addEventListener('contextmenu',e=>e.preventDefault());
    $('game').addEventListener('wheel',e=>{if(this.screen==='playing'){e.preventDefault();this.weapon=1-this.sim.player.weapon;}},{passive:false});
    document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement){this.ignoreMouse=true;if(this.screen!=='playing'){document.exitPointerLock();return;}}if(!document.pointerLockElement&&this.screen==='playing')this.pause();});
    window.addEventListener('blur',()=>this.pause());
    // An unplugged controller pauses instead of leaving the operator stranded mid-fight.
    window.addEventListener('gamepaddisconnected',()=>this.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
  }
  input(){const k=this.keys,firePresses=this.firePresses,altPresses=this.altPresses,toggleMode=this.modePressed;this.firePresses=this.altPresses=0;this.modePressed=false;
    // Controller input merges into the same command the keyboard and mouse produce (src/gamepad.js).
    const ps=this.padState?.armed?this.padState:null,pad=k2=>!!ps?.held[k2];
    return {firePresses,altPresses,toggleMode,forward:clamp((k.has('KeyW')?1:0)-(k.has('KeyS')?1:0)+(ps?ps.move[0]:0),-1,1),side:clamp((k.has('KeyD')?1:0)-(k.has('KeyA')?1:0)+(ps?ps.move[1]:0),-1,1),jump:k.has('Space')||pad('jump'),sprint:k.has('ShiftLeft')||k.has('ShiftRight')||pad('sprint'),aim:k.has('KeyQ')||pad('aim'),fire:this.buttons.has(0)||pad('fire'),secondary:this.buttons.has(2)||pad('secondary'),ability:!!this.abilityPressed,interact:k.has('KeyE')||pad('interact'),weapon:this.weapon,angles:this.angles.slice()};}
  // Called once per rendered frame, like mouse look. Edges queue the same presses as mouse clicks.
  pollPad(dt,now){
    const pads=standardPads(),s=this.padState=this.pad.sample(pads);
    if(this.screen==='playing'&&this.sim){
      if(!s.armed)return;if(s.active)this.padUsed=true;
      if(s.pressed.pause){this.pause();return;}
      if(s.pressed.fire)this.firePresses=Math.min(8,this.firePresses+1);if(s.pressed.secondary)this.altPresses=Math.min(8,this.altPresses+1);
      if(s.pressed.ability)this.abilityPressed=true;if(s.pressed.mode)this.modePressed=true;if(s.pressed.weapon)this.weapon=1-this.sim.player.weapon;
      const k=this.settings.padSensitivity*dt*(s.held.aim?.45:1);
      this.angles[1]-=lookRate(s.look[1],1)*k;this.angles[0]=clamp(this.angles[0]+lookRate(s.look[0],1)*k*(this.settings.padInvert?-1:1),-85,85);
      return;
    }
    if(s.pressed.pause&&this.screen==='pause'){this.resume();return;}
    if(this.screen==='watch'){if(s.pressed.pause||s.pressed.mode)this.stopWatch();return;}
    this.menuPad(pads,now);
  }
  // Menus: D-pad / stick moves focus spatially, A activates, left/right adjusts a focused setting, B goes back.
  menuPad(pads,now){
    const root=['menu','pause','settings','result','credits','replay'].includes(this.screen)?$('interface'):null,context=root?this.screen:'';
    if(context!==this.navContext){this.navContext=context;this.padNav.disarm();}
    if(!root)return;const actions=this.padNav.sample(pads,now);if(!actions.length)return;
    const items=[...root.querySelectorAll('button,select,input,summary,a[href]')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.getClientRects().length);if(!items.length)return;
    const cur=items.includes(document.activeElement)?document.activeElement:null;
    const nudge=(el,dir)=>{if(el.tagName==='SELECT'){const i=clamp(el.selectedIndex+dir,0,el.options.length-1);if(i!==el.selectedIndex){el.selectedIndex=i;el.dispatchEvent(new Event('change',{bubbles:true}));}return true;}if(el.tagName==='INPUT'&&el.type==='range'){dir>0?el.stepUp():el.stepDown();el.dispatchEvent(new Event('input',{bubbles:true}));return true;}return false;};
    const focus=el=>{el.focus({preventScroll:true,focusVisible:true});el.classList.add('pad-focus');el.addEventListener('blur',()=>el.classList.remove('pad-focus'),{once:true});el.scrollIntoView?.({block:'nearest'});};
    for(const a of actions){
      if(a==='back'){if(this.screen==='settings')$('settings-close').click();else if(this.screen==='credits')$('credits-close').click();else if(this.screen==='pause')this.resume();else if(this.screen==='replay')$('replay-close').click();return;}
      // The first press lands on the screen's primary action (BEGIN, RESUME, RUN IT AGAIN, SAVE), not the logo link.
      if(!cur){focus(items.find(el=>el.classList.contains('primary'))||items[0]);return;}
      if(a==='confirm'){if(cur.tagName==='SELECT'){cur.selectedIndex=(cur.selectedIndex+1)%cur.options.length;cur.dispatchEvent(new Event('change',{bubbles:true}));}else if(cur.tagName==='INPUT'&&cur.type==='range')nudge(cur,1);else cur.click();return;}
      if((a==='left'||a==='right')&&nudge(cur,a==='left'?-1:1))return;
      const r=cur.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let best=null,score=Infinity;
      for(const el of items){if(el===cur)continue;const q=el.getBoundingClientRect(),dx=q.left+q.width/2-cx,dy=q.top+q.height/2-cy,main=a==='up'?-dy:a==='down'?dy:a==='left'?-dx:dx,side=a==='up'||a==='down'?Math.abs(dx):Math.abs(dy);if(main<=1)continue;const sc=main+side*2;if(sc<score){score=sc;best=el;}}
      if(!best){const i=items.indexOf(cur);best=items[clamp(i+(a==='up'||a==='left'?-1:1),0,items.length-1)];}
      focus(best);return;
    }
  }
  consumeEvents(){const g=this.sim,t=g.tick/60;for(const e of g.events){
    if(e.type==='shot'){this.audio.fx(e.alt?'cannon':e.weapon?'rifle':'pistol');this.fx.lines.push({a:e.origin,b:e.end,color:[1,.66,.23],life:.06});this.fx.burst(e.end,[.95,.66,.25],e.hit?6:3);}
    if(e.type==='hit'){this.hitUntil=t+.12;this.audio.fx('hit',null,.3);}
    if(e.type==='explosion'){this.fx.burst(e.origin,[1,.45,.12],this.settings.reduced?12:50);this.audio.fx('explosion',e.origin);}
    if(e.type==='enemyShot')this.audio.fx('enemy',e.origin,.45);
    if(e.type==='damage'){this.damageUntil=t+.24;this.audio.fx('damage',null,.35);}
    if(e.type==='kill')this.fx.burst(e.origin,[.63,.5,.3],15);
    if(e.type==='ability'){this.audio.fx('ability');this.fx.pulse=1;this.fx.burst(e.origin,[1,.72,.25],this.settings.reduced?10:60);this.toast={text:e.count+' PROCESSES SUSPENDED. SKILL ISSUE DETECTED.',until:t+3};}
    if(e.type==='stun'){this.fx.labels.push({origin:e.origin,text:e.text,life:2});}
    if(e.type==='boss'||e.type==='phase'){this.audio.fx('explosion',e.origin||null,.6);this.fx.pulse=1;}
    if(['objective','unlock','core','weaponPickup','mode','boss','phase'].includes(e.type)){this.toast={text:e.text,until:t+5};$('live-message').textContent=e.text;this.audio.fx('pickup');}
    if(e.type==='supply'){this.toast={text:'SUPPLIES RESTORED. NO SUBSCRIPTION REQUIRED.',until:t+2};this.audio.fx('pickup');}
    if(e.type==='victory'||e.type==='defeat')this.end();
  }}
  end(){if(this.watch){this.finishWatch();return;}const g=this.sim,win=g.status==='victory';this.show('result');if(document.pointerLockElement)document.exitPointerLock();$('result-kind').textContent=win?'OPERATION COMPLETE':'PROCESS TERMINATED';$('result-title').textContent=win?'BLOAT REMOVED.':'SEGMENTATION FAULT.';$('result-message').textContent=win?'Your dependencies have been terminated. The extraction vehicle has zero mandatory updates.':'Corporate overhead got you. Restart the same mission and try a different approach.';$('result-stats').replaceChildren();for(const [label,value]of [['DEPENDENCIES REMOVED',g.stats.kills],['PROCESSES STUNNED',g.stats.stuns],['ELAPSED',Math.floor(g.tick/3600)+':'+String(Math.floor(g.tick/60)%60).padStart(2,'0')],['REPLAY DIGEST',g.digest()]]){const el=document.createElement('div'),n=document.createElement('strong');n.textContent=value;el.append(n,document.createTextNode(label));$('result-stats').append(el);}}
  frame(now){const dt=Math.min(.25,Math.max(0,(now-this.last)/1000));this.last=now;this.frameMs+=(dt*1000-this.frameMs)*.05;this.fps+=(1/Math.max(dt,.001)-this.fps)*.05;
    this.pollPad(dt,now);
    const before=performance.now();if(this.screen==='playing'){this.clock.advance(dt,()=>{if(this.sim.status!=='playing')return;const input=this.input();if(this.recording.length<this.recordingLimit)this.recording.push(input);else this.recordingTruncated=true;this.sim.step(input);this.abilityPressed=false;this.weapon=-1;if(this.sim.stage!==this.lastStage){this.lastStage=this.sim.stage;if(this.sim.status==='playing')this.saveCheckpoint();}this.consumeEvents();});this.fx.update(dt);}
    else if(this.screen==='watch'){this.clock.advance(dt,()=>{const w=this.watch;if(!w||this.sim.status!=='playing')return;if(w.index>=w.replay.inputs.length){this.finishWatch();return;}const input=w.replay.inputs[w.index++];if(input.angles)this.angles=[input.angles[0],input.angles[1],0];this.sim.step(input);this.consumeEvents();});this.fx.update(dt);}this.simMs=performance.now()-before;
    const r0=performance.now();this.render(now/1000);this.hud.draw();this.renderMs=performance.now()-r0;this.frames++;
    if(this.screen==='playing'&&this.frames%10===0){this.tickSamples.push(this.simMs);this.frameSamples.push(this.renderMs);if(this.frameSamples.length>600){this.tickSamples.shift();this.frameSamples.shift();}}
    requestAnimationFrame(t=>this.frame(t));
  }
  render(time){const r=this.renderer,g=this.sim,p=g?.player;
    let angles,eye;
    if(!g){eye=[2510,-470,100];angles=vecToAngles(v3.sub([3190,120,78],eye));angles[1]+=Math.sin(time*.12)*5;}
    else{eye=v3.add(v3.lerp(p.prevOrigin,p.origin,clamp(this.clock.accum*60,0,1)),[0,0,p.dead?0:22]);angles=this.angles.slice();if(this.settings.shake&&this.screen==='playing'){const speed=Math.hypot(p.velocity[0],p.velocity[1]);eye[2]+=Math.sin(g.tick*.15)*Math.min(1,speed/240)*1.1;const kick=Math.max(0,1-(g.tick-p.lastFire)/9);angles[0]-=kick*(p.lastAlt?3:WEAPONS[p.lastWeapon].recoil);}}
    this.eye=eye;r.dlights=[];
    if(g){for(const pr of g.projectiles.slice(0,6))r.dlights.push({origin:pr.origin,radius:150,color:pr.owner==='player'?[1,.6,.2]:[1,.22,.08]});if(g.tick<p.abilityUntil)r.dlights.push({origin:eye,radius:300,color:[.7,.45,.13]});}
    r.beginFrame(eye,angles,g&&p.aiming?65:this.settings.fov,time);r.drawWorld();
    // Exact frustum culling (ported from QwakeTF): a model whose all-frame bounding sphere lies outside the
    // view volume rasterizes no pixels, so skipping it leaves the image unchanged.
    // A model without a finite bound is never culled (Codex review: unbounded sign quads vanished early).
    const vis=(o,m,scale=1)=>!m||!Number.isFinite(m.bound)||r.sphereVisible(o,m.bound*scale+2);
    for(const s of this.signs)if(vis(s.origin,s.model))r.drawBrushModel(s.model,s.origin,[.9,.85,.72],s.origin[1]<0?[0,180,0]:[0,0,0]);
    for(let i=0;i<this.gates.length;i++)if(!g||g.world.movers[i].solid)r.drawBrushModel(this.gates[i],this.map.gates[i].origin,[.55,.5,.4]);
    if(g){const t=g.tick/60,alpha=clamp(this.clock.accum*60,0,1);
      for(const s of g.supplies)if(!s.used&&r.sphereVisible(s.origin,this.pickup.bound+5))r.drawBrushModel(this.pickup,v3.add(s.origin,[0,0,Math.sin(t*2+s.id)*3]),[.9,1,.85],[0,t*25,0]);
      if(!p.hasRifle)r.drawModel(this.assets.model('rifle'),0,0,0,m4.model(v3.add(RIFLE_PICKUP,[0,0,15]),[0,t*35,0],.65),'default',[1.3,1.1,.7]);
      if(!p.unlocked)r.drawBrushModel(this.firmware,POWERUP,[1,.9,.6],[0,t*35,0]);
      for(let i=0;i<2;i++)if(vis(RELAYS[i],this.terminal))r.drawBrushModel(this.terminal,RELAYS[i],g.relays[i]?[.2,.35,.2]:[1,1,.7]);
      r.drawBrushModel(this.terminal,CORE,g.stage>=5?[.2,.25,.2]:[1,.8,.5]);
      if(g.stage===7)r.drawBrushModel(this.firmware,EXTRACT,[.6,1,.7],[0,t*40,0]);
      for(const e of g.enemies){if(e.dead&&g.tick-e.deathTick>180)continue;const o=v3.lerp(e.prevOrigin,e.origin,alpha);const state=e.dead?'death':e.state==='stunned'?'stun':e.state==='attack'?'attack':e.state==='move'?'move':'idle';const age=e.dead?(g.tick-e.deathTick)/60:state==='stun'?(180-(e.stunUntil-g.tick))/60:state==='attack'?(ENEMIES[e.kind].windup-(e.windup-g.tick))/60:t+e.id*.17;
        const model=ENEMIES[e.kind].model;if(!vis(o,this.assets.model(model),ENEMIES[e.kind].scale||1))continue;const [fa,fb,blend]=this.assets.frame(model,state,Math.max(0,age));const def=ENEMIES[e.kind],tint=g.tick<e.stunUntil?[1,.7,.2,.45]:g.tick-e.lastDamage<7?[1,.25,.1,.4]:def.tint||null;
        // Both character meshes already include a gun animated with the hand.
        r.drawModel(this.assets.model(model),fa,fb,blend,m4.model(o,[0,e.angles[1],0],def.scale||1),'default',[.95,.9,.8],tint);
      }
      for(const pr of g.projectiles)if(vis(pr.origin,pr.gravity?this.grenade:this.bolt))r.drawBrushModel(pr.gravity?this.grenade:this.bolt,pr.origin,pr.owner==='player'?[1,.8,.3]:[1,.3,.1]);
      this.fx.draw(r);
      if(!p.dead){const {forward,right,up}=angleVectors(angles),kick=Math.max(0,1-(g.tick-p.lastFire)/10);let pos=v3.add(v3.ma(eye,12-kick*3,forward),v3.add(v3.scale(right,p.aiming?3:9),v3.scale(up,-10-kick)));r.beginViewModel();if(p.weapon===0)r.drawBrushModel(this.pistol,v3.add(pos,v3.add(v3.scale(right,-3),v3.scale(up,3))),[1.3,1.2,1.05],[angles[0]+kick*3,angles[1],0]);else {r.drawModel(this.assets.model('rifle'),0,0,0,m4.model(pos,[angles[0]+kick*3,angles[1],0],.60),'default',[1.3,1.2,1.05]);r.drawBrushModel(this.launcher,pos,[1.1,1,.85],[angles[0]+kick*3,angles[1],0]);}r.endViewModel();}
      const basis=angleVectors(angles);this.audio.setListener(eye,basis.forward,basis.up);
    }
  }
  project(pos){const m=this.renderer.vp,x=pos[0],y=pos[1],z=pos[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;const xx=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,yy=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;if(Math.abs(xx)>1.2||Math.abs(yy)>1.2)return null;return [(xx*.5+.5)*innerWidth,(-yy*.5+.5)*innerHeight];}
  exportReplay(){return {format:REPLAY_FORMAT,version:REPLAY_VERSION,level:this.level,seed:this.sim.seed,ticks:this.recording.length,truncated:this.recordingTruncated,inputs:this.recording,digest:this.sim.digest()};}
  downloadReplay(){if(!this.sim||this.watch)return;const r=this.exportReplay(),url=URL.createObjectURL(new Blob([JSON.stringify(r)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='bloat-ops-replay-'+r.digest+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  // Checkpoints: an exact state image at each completed objective, with the inputs that led to it so an
  // exported replay stays complete. Session memory only; the restored state is checked against its digest.
  saveCheckpoint(){const g=this.sim;this.checkpoint={tick:g.tick,stage:g.stage,state:encodeState(g.snapshot()),digest:g.digest(),inputs:this.recording.slice(),truncated:this.recordingTruncated};}
  restartCheckpoint(){
    const cp=this.checkpoint;if(!cp||!this.ready)return;const g=Simulation.fromSnapshot(this.map,this.nav,decodeState(cp.state));
    if(g.digest()!==cp.digest){this.checkpoint=null;this.start();this.toast={text:'CHECKPOINT REJECTED. MISSION RESTARTED.',until:this.sim.tick/60+4};return;}
    this.watch=null;this.sim=g;this.lastStage=g.stage;this.recording=cp.inputs.slice();this.recordingTruncated=cp.truncated;this.angles=g.player.angles.slice();this.fx=new Effects();this.hitUntil=this.damageUntil=0;this.weapon=-1;
    this.resume();this.toast={text:'CHECKPOINT RESTORED / '+OBJECTIVES[g.stage],until:g.tick/60+4};
  }
  replayReport(title,message,errors,watchable=false){this.sim=null;this.watch=null;$('replay-title').textContent=title;$('replay-message').textContent=message;$('replay-errors').replaceChildren(...errors.map(e=>{const li=document.createElement('li');li.textContent=e;return li;}));$('replay-watch').hidden=!watchable;this.show('replay');}
  openReplay(text){
    let replay;try{replay=JSON.parse(text);}catch(e){return this.replayReport('NOT A REPLAY.','The file is not valid JSON.',[e.message]);}
    const v=validateReplay(replay,this.level);if(!v.ok){this.imported=null;return this.replayReport('REPLAY REJECTED.','Nothing was played. Fix or re-export the file:',v.errors);}
    const r=verifyReplay(this.map,this.nav,replay);
    if(!r.complete){this.imported=null;return this.replayReport('REPLAY REJECTED.','Nothing was played. The file declares '+replay.ticks+' ticks, but the mission ended after '+r.ticks+'.',[r.unconsumed+' recorded input'+(r.unconsumed===1?' was':'s were')+' left unconsumed after '+r.status.toUpperCase()+'.']);}
    this.imported=replay;
    this.replayReport(r.match?'REPLAY VERIFIED.':'DIGEST MISMATCH.',(r.match?'The recorded inputs reproduce the recorded result exactly':'The inputs replay to digest '+r.digest+', not the recorded '+replay.digest)+': '+r.status.toUpperCase()+' after '+Math.floor(r.ticks/3600)+':'+String(Math.floor(r.ticks/60)%60).padStart(2,'0')+', '+r.stats.kills+' removed.',[],true);
  }
  startWatch(){const replay=this.imported;if(!replay)return;this.sim=new Simulation(this.map,this.nav,replay.seed);this.watch={replay,index:0};this.checkpoint=null;this.angles=[0,0,0];this.fx=new Effects();this.toast={text:'REPLAY / ESC OR START TO STOP',until:4};this.hitUntil=this.damageUntil=0;this.show('watch');this.audio.start(this.settings.volume);}
  stopWatch(){if(!this.watch)return;this.openReplay(JSON.stringify(this.watch.replay));}
  finishWatch(){const w=this.watch;if(!w)return;const g=this.sim,digest=g.digest();this.watch=null;this.replayReport(digest===w.replay.digest?'PLAYBACK MATCHED.':'PLAYBACK DIFFERED.','Watched '+g.tick+' ticks: '+g.status.toUpperCase()+', digest '+digest+(digest===w.replay.digest?' (matches the file).':' (file says '+w.replay.digest+').'),[],true);}
}
const app=new App();
// Small inspectable debug surface, also exercised by browser regressions; no network access.
window.bloat=app;
app.init().catch(e=>{console.error(e);$('load-status').textContent='STARTUP FAILED: '+e.message;$('start').textContent='UNABLE TO START';$('start').disabled=true;});
