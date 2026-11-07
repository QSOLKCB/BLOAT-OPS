// Exact render A/B between two checkouts in Chromium (development tool; not part of the runtime or CI).
// NODE_PATH=<playwright>/node_modules node tools/render-ab.cjs <baselineCheckout> [--headed]
// Both builds replay the retained fixture to the same ticks; each state is rendered from fixed views and
// the framebuffers must be byte-identical. Timing runs each build in its own browser, ABBA order.
// Headless runs use SwiftShader: timings include software rasterization, not a particular GPU.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const here=path.resolve(__dirname,'..'),base=path.resolve(process.argv[2]||''),headed=process.argv.includes('--headed');
if(!process.argv[2]||!fs.existsSync(path.join(base,'src/main.js'))){console.error('usage: node tools/render-ab.cjs <baseline checkout> [--headed]');process.exit(2);}
const fixture=JSON.parse(fs.readFileSync(path.join(here,'tests/fixtures/mission-replay.json')));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.mdl':'application/octet-stream','.pal':'application/octet-stream','.wav':'audio/wav'};
function serve(root){return http.createServer((q,s)=>{let f=path.join(root,decodeURIComponent(new URL(q.url,'http://x').pathname));if(f.endsWith('/'))f+='index.html';if(!f.startsWith(root)){s.writeHead(403);return s.end();}try{s.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');s.end(fs.readFileSync(f));}catch{s.writeHead(404);s.end();}});}
const TICKS=[420,1300,2000],VIEWS=[[0,0],[5,60],[-5,120],[0,180],[10,240],[0,300]];
async function session(root,timing){
 const srv=serve(root);await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:!headed,args:headed?[]:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);await page.waitForFunction(()=>window.bloat&&bloat.ready,null,{timeout:120000});await page.bringToFront();
  return await page.evaluate(async({fixture,TICKS,VIEWS,timing})=>{const a=bloat,gl=a.renderer.gl;a.start(fixture.seed);a.screen='fixture';a.audio.ambient(false);a.clock.reset();
   const hash=()=>{const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);let x=2166136261;for(let i=0;i<px.length;i++)x=Math.imul(x^px[i],16777619);return (x>>>0).toString(16);};
   const hashes=[];let t=0,n=0,frames=0;
   for(const tick of TICKS){while(a.sim.tick<tick&&a.sim.status==='playing')a.sim.step(fixture.inputs[a.sim.tick]);
    for(const [pitch,yaw] of VIEWS){a.angles=[pitch,yaw,0];a.render(100);hashes.push(hash());
     if(timing)for(let k=0;k<30;k++){await new Promise(r=>requestAnimationFrame(r));const t0=performance.now();a.render(100);gl.finish();t+=performance.now()-t0;frames++;}}}
   return {hashes,renderer:gl.getParameter(gl.RENDERER),msPerFrame:frames?t/frames:0,frames};},{fixture,TICKS,VIEWS,timing});
 }finally{await browser.close();srv.close();}
}
(async()=>{const order=[['base',base],['cur',here],['cur',here],['base',base]],res={base:[],cur:[]};let ref={};
 for(const [k,root] of order){const r=await session(root,true);if(ref[k])assert.deepEqual(r.hashes,ref[k],k+' framebuffer changed between runs');ref[k]=r.hashes;res[k].push(r.msPerFrame);res.renderer=r.renderer;}
 assert.deepEqual(ref.cur,ref.base,'rendered frames differ from the baseline');
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
 console.log(`renderer: ${res.renderer}`);console.log(`PASS: ${ref.cur.length} frames (${TICKS.length} replay states x ${VIEWS.length} views) byte-identical to the baseline`);
 console.log(`render() + gl.finish per frame: baseline ${mean(res.base).toFixed(3)} ms, current ${mean(res.cur).toFixed(3)} ms (2 sessions x ${TICKS.length*VIEWS.length*30} frames each)`);
})().catch(e=>{console.error(e);process.exitCode=1;});
