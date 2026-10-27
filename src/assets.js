// Strict asset loading: a missing required resource is a startup error, never a silent fallback.
import {fetchBuf,loadImage,Palette,parseMDL} from './engine/formats.js';
export const TEXTURES=['concrete','floor','wall','ceiling','steel','server','hazard'];
export const MODELS=['rifle','cannon','harvester','manager'];
export class Assets {
  constructor(renderer){this.r=renderer;this.textures=new Map();this.models=new Map();this.meta=new Map();}
  async load(progress=()=>{}) {
    let done=0;const tick=()=>progress(++done/(TEXTURES.length+MODELS.length));
    await Promise.all(TEXTURES.map(async name=>{const img=await loadImage('assets/textures/'+name+'.png');this.textures.set(name,this.r.textureFromImage(img));tick();}));
    await Promise.all(MODELS.map(async name=>{
      const [data,pal,info]=await Promise.all(['mdl','pal','json'].map(ext=>fetchBuf('assets/models/'+name+'.'+ext)));
      const mdl=parseMDL(data),meta=JSON.parse(new TextDecoder().decode(info));
      if(mdl.numFrames!==meta.frames || mdl.vcount!==meta.triangles*3)throw new Error('Model integrity: '+name);
      const model=this.r.uploadModel(name,mdl,new Palette(pal));model.frontCCW=true;
      this.models.set(name,model);this.meta.set(name,meta);tick();
    }));
    for(const [name,color] of Object.entries({amber_fbr:[188,112,28],lamp_fbr:[255,209,132],core_fbr:[205,59,27],terminal_fbr:[191,143,54],health_fbr:[157,196,154]}))this.textures.set(name,this.r.makeTexture(new Uint8Array([...color,255]),1,1,false));
  }
  tex(name){const t=this.textures.get(name);if(!t)throw new Error('Unknown texture '+name);return t;}
  model(name){return this.models.get(name);}
  frame(name,state,seconds){const c=this.meta.get(name).clips[state]||this.meta.get(name).clips.idle;let f=seconds*c.fps;if(c.loop)f%=c.count;else f=Math.min(c.count-1,f);const a=Math.floor(f);return [c.start+a,c.start+(c.loop?(a+1)%c.count:Math.min(c.count-1,a+1)),f-a];}
}
