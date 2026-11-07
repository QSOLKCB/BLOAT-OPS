import test from 'node:test';import assert from 'node:assert/strict';
import {deadzone,FpsGamepad,PadNav,PAD,lookRate} from '../src/gamepad.js';
import {FixedClock} from '../src/game/simulation.js';

const pad=(over={})=>({index:0,id:over.id||'Pad',mapping:'standard',connected:true,axes:over.axes||[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:!!over.buttons?.includes(i),value:over.buttons?.includes(i)?1:0}))});

test('stick deadzone is rescaled and rejects invalid values',()=>{
 assert.equal(deadzone(.1),0);assert.equal(deadzone(-.16),0);assert.equal(deadzone(1),1);assert.equal(deadzone(-1),-1);
 assert(Math.abs(deadzone(.58)-.5)<1e-9);assert.equal(deadzone(NaN),0);assert.equal(deadzone(.5,1),0);
 assert.equal(lookRate(0,4),0);assert.equal(lookRate(1,1),45);assert.equal(lookRate(-.5,2),-22.5);
});

test('gameplay pad ignores anything held when it connects, re-arms on a controller change and edges fire once',()=>{
 const gp=new FpsGamepad();
 let s=gp.sample([pad({buttons:[PAD.RT]})]);assert(s.connected&&!s.armed&&!s.held.fire,'trigger held at connect is ignored');
 s=gp.sample([pad({axes:[.9,0,0,0]})]);assert(!s.armed,'a deflected stick also blocks');
 s=gp.sample([pad()]);assert(s.armed&&!s.active);
 s=gp.sample([pad({buttons:[PAD.RT,PAD.A,PAD.LT],axes:[.5,-1,1,0]})]);
 assert(s.held.fire&&s.held.jump&&s.held.aim);assert(s.pressed.fire,'RT press is an edge');assert.equal(s.move[0],1);assert(s.move[1]>.3&&s.move[1]<.5);assert.equal(s.look[1],1);
 s=gp.sample([pad({buttons:[PAD.RT]})]);assert(s.held.fire&&!s.pressed.fire,'holding does not repeat the press');
 s=gp.sample([pad({buttons:[PAD.LB,PAD.Y,PAD.B,PAD.RB]})]);assert(s.pressed.ability&&s.pressed.weapon&&s.pressed.mode&&s.pressed.secondary);
 s=gp.sample([pad({id:'Replacement',buttons:[PAD.RT]})]);assert(!s.armed,'a replacement controller re-arms');
 s=gp.sample([]);assert(!s.connected&&!s.armed);
 gp.sample([pad()]);gp.sample([pad()]);gp.disarm();
 s=gp.sample([pad({buttons:[PAD.START]})]);assert(s.armed&&!s.pressed.pause,'Start held across a pause does not toggle again');
 gp.sample([pad()]);s=gp.sample([pad({buttons:[PAD.START]})]);assert(s.pressed.pause);
});

test('menu navigation is edge-triggered, repeats when held and re-arms on menu or controller changes',()=>{
 const inner=new PadNav(),nav=(p,t)=>[...inner.sample(p,t)];
 assert.deepEqual(nav([pad({buttons:[PAD.A]})],0),[],'A held into a menu does not select');
 nav([pad()],16);assert.deepEqual(nav([pad({buttons:[PAD.A]})],32),['confirm']);assert.deepEqual(nav([pad({buttons:[PAD.A]})],48),[]);
 nav([pad()],64);assert.deepEqual(nav([pad({axes:[0,.9,0,0]})],80),['down']);assert.deepEqual(nav([pad({axes:[0,.9,0,0]})],300),[]);
 assert.deepEqual(nav([pad({axes:[0,.9,0,0]})],560),['down'],'held direction repeats');
 assert.deepEqual(nav([pad({id:'Replacement',buttons:[PAD.B]})],600),[],'a replacement controller holding B does not go back');
 nav([pad({id:'Replacement'})],620);assert.deepEqual(nav([pad({id:'Replacement',buttons:[PAD.B]})],640),['back']);
 inner.disarm();assert.deepEqual(nav([pad({id:'Replacement',buttons:[PAD.A]})],700),[]);
});

test('fixed clock absorbs rounded browser timestamps: one tick per 60 Hz frame, two per 30 Hz frame',()=>{
 for(const [hz,per] of [[60,1],[30,2]]){const c=new FixedClock();let last=0,uneven=0,ticks=0;for(let i=1;i<=hz*60;i++){const now=Math.round(i*1000/hz*10)/10;const n=c.advance((now-last)/1000,()=>ticks++);last=now;if(n!==per)uneven++;}assert.equal(uneven,0,hz+' Hz frames with an uneven tick count');assert.equal(ticks,3600);assert.equal(c.dropped,0);}
 const c=new FixedClock();assert.equal(c.advance(2,()=>{}),15);assert(Math.abs(c.dropped-1.75)<1e-9,'only time beyond the 250 ms clamp counts as dropped');
});
