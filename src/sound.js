// Original offline synthetic effects; playback and spatialisation reuse QwakeTF Audio.
import {Audio} from './engine/audio.js';
export class Sound extends Audio {
  constructor(){super();this.buffers=new Map();this.ambience=null;}
  start(volume){this.init();this.resume();this.setVolume(volume);if(!this.ctx)return;
    if(!this.buffers.size)for(const [name,freq,duration,noise]of [['pistol',160,.10,.55],['rifle',105,.13,.7],['cannon',60,.35,.8],['enemy',200,.2,.3],['hit',700,.055,.2],['explosion',45,.6,.8],['ability',115,.9,.2],['pickup',550,.25,.05],['damage',80,.15,.2]]) {
      const n=Math.ceil(this.ctx.sampleRate*duration),b=this.ctx.createBuffer(1,n,this.ctx.sampleRate),out=b.getChannelData(0);let seed=31;
      for(let i=0;i<n;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const t=i/this.ctx.sampleRate,env=(1-i/n)**2;const tone=Math.sin(2*Math.PI*(freq*t-(name==='ability'?60:freq*.2)*t*t));out[i]=(tone*(1-noise)+(seed/2147483648-1)*noise)*env*.6;}
      this.buffers.set(name,b);
    }
  }
  fx(name,origin=null,volume=.7){return this.play(this.buffers.get(name),origin,volume);}
  ambient(on){
    if(this.ambience){this.ambience.stop();this.ambience=null;}
    if(!on||!this.ctx)return;
    const osc=this.ctx.createOscillator(),gain=this.ctx.createGain();osc.type='triangle';osc.frequency.value=43;gain.gain.value=.018;osc.connect(gain);gain.connect(this.master);osc.start();osc.onended=()=>{osc.disconnect();gain.disconnect();};this.ambience=osc;
  }
}
