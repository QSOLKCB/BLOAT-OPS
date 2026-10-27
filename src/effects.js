// Cosmetic RNG and buffers never feed simulation state.
import {Random} from './game/random.js';
export class Effects {
  constructor(){this.random=new Random(7);this.points=[];this.lines=[];this.labels=[];this.data=new Float32Array(600*8);this.lineData=new Float32Array(128*14);this.pulse=0;}
  burst(p,color,n=16){for(let i=0;i<n&&this.points.length<600;i++)this.points.push({p:p.slice(),v:[(this.random.next()-.5)*140,(this.random.next()-.5)*140,this.random.next()*160],life:.25+this.random.next()*.4,color});}
  update(dt){this.pulse=Math.max(0,this.pulse-dt);for(const p of this.points){p.life-=dt;for(let j=0;j<3;j++)p.p[j]+=p.v[j]*dt;p.v[2]-=150*dt;}this.points=this.points.filter(p=>p.life>0);this.lines=this.lines.filter(l=>(l.life-=dt)>0);this.labels=this.labels.filter(l=>(l.life-=dt)>0);}
  draw(r){let i=0;for(const p of this.points){this.data.set([...p.p,...p.color,Math.min(1,p.life*3),2.2],i++*8);}r.drawParticles(this.data,i);i=0;for(const l of this.lines.slice(-128)){this.lineData.set([...l.a,...l.color,1,...l.b,...l.color,1],i++*14);}r.drawLines(this.lineData,i*2);}
}
