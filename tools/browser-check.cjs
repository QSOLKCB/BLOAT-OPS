// Chromium integration tests adapted from QwakeTF: HTTP project prefix and offline file.
// Development dependency only: npm install --prefix /tmp/bloat-browser playwright@1.56.1
const {chromium}=require('playwright');const assert=require('node:assert/strict');const http=require('node:http');const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/mission-replay.json')));
(async()=>{let browser,server;const report=[];try{
 const {handler}=await import('./serve.mjs');server=http.createServer(handler);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
 for(const [name,url]of [['http',`http://127.0.0.1:${server.address().port}/BLOAT-OPS/`],['offline',pathToFileURL(path.join(root,'index.html')).href]]){
   const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[];page.setDefaultTimeout(20000);
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>errors.push(`Failed ${r.url()}: ${r.failure()?.errorText}`));page.on('request',r=>requests.push(r.url()));
   if(name==='offline')await page.route(/^https?:/,route=>route.abort());
   const started=Date.now();await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>window.bloat?.ready,null,{timeout:90000});const loadMs=Date.now()-started;
   assert.equal(await page.evaluate(()=>bloat.assets.models.size),4);
   if(name==='offline'){assert(page.url().endsWith('/dist/BLOAT-OPS-standalone.html'));assert(!requests.some(u=>/^https?:/.test(u)));}
   await page.screenshot({path:path.join(root,'test-results',`${name}-menu.png`)});
   // Every distribution exposes the complete adaptation NOTICE, including offline.
   await page.getByRole('button',{name:'CREDITS +',exact:true}).click();
   const notice=page.locator('#license-text details').filter({has:page.getByText('BLOAT-OPS — full attribution notice',{exact:true})});
   await notice.waitFor();await notice.locator('summary').click();assert.equal(await notice.locator('pre').textContent(),fs.readFileSync(path.join(root,'NOTICE'),'utf8'));
   await page.getByRole('button',{name:'RETURN ↗',exact:true}).click();
   // Settings persist and can reduce effects / rebind the defining ability.
   await page.getByRole('button',{name:'CONTROLS & SETTINGS'}).first().click();await page.locator('#ability-key').selectOption('KeyG');await page.locator('#reduced').check();await page.locator('#shake').uncheck();await page.locator('#volume').fill('0');await page.getByRole('button',{name:'SAVE & RETURN'}).click();
   await page.getByRole('button',{name:'BEGIN OPERATION'}).click();await page.waitForFunction(()=>bloat.screen==='playing');
   const startX=await page.evaluate(()=>bloat.sim.player.origin[0]);await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');assert(await page.evaluate(()=>bloat.sim.player.origin[0])>startX+10);
   await page.keyboard.press('2');await page.waitForFunction(()=>bloat.sim.player.weapon===1);const before=await page.evaluate(()=>bloat.sim.player.ammo[1]);await page.mouse.down({button:'left'});await page.waitForTimeout(250);await page.mouse.up({button:'left'});assert(await page.evaluate(()=>bloat.sim.player.ammo[1])<before);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>bloat.screen==='pause');const paused=await page.evaluate(()=>bloat.sim.tick);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>bloat.sim.tick),paused);
   // Normal keyboard binding drives a real stunned state in a controlled browser fixture.
   await page.getByRole('button',{name:'RESUME OPERATION'}).click();await page.evaluate(()=>{const g=bloat.sim;g.player.origin=[820,0,25];g.player.prevOrigin=[820,0,25];g.player.velocity=[0,0,0];g.player.unlocked=true;g.player.charge=100;g.player.abilityReady=0;g.enemies[0].origin=[1000,0,25];g.enemies[0].windup=g.tick+100;bloat.angles=[0,0,0];});await page.keyboard.press('g');await page.waitForFunction(()=>bloat.sim.stats.stuns>0);assert(await page.evaluate(()=>bloat.sim.enemies.some(e=>e.state==='stunned'&&e.windup===0)));
   await page.screenshot({path:path.join(root,'test-results',`${name}-stun.png`)});
   // The full retained mission uses only recorded inputs. Same quantized digest in Node and Chromium; raw snapshots repeat exactly in Chromium.
   const replay=await page.evaluate(f=>{const a=bloat;a.pause();a.start(f.seed);a.screen='fixture';a.audio.ambient(false);let checkpoints=[];for(const input of f.inputs){a.sim.step(input);if(a.sim.tick%300===0)checkpoints.push([a.sim.tick,a.sim.digest()]);}const repeated=new a.sim.constructor(a.map,a.nav,f.seed);for(const input of f.inputs)repeated.step(input);const exactRepeat=JSON.stringify(repeated.snapshot())===JSON.stringify(a.sim.snapshot());a.angles=a.sim.player.angles.slice();a.consumeEvents();return {exactRepeat,digest:a.sim.digest(),stats:a.sim.stats,status:a.sim.status,checkpoints,gl:a.renderer.gl.getError(),snapshot:a.sim.snapshot()};},fixture);
   assert(replay.exactRepeat,'Raw state repeats exactly within Chromium');assert.equal(replay.digest,fixture.finalDigest);assert.equal(replay.status,'victory');assert.deepEqual(replay.checkpoints,fixture.checkpoints);assert.equal(replay.gl,0);await page.getByText('BLOAT REMOVED.',{exact:true}).waitFor();await page.screenshot({path:path.join(root,'test-results',`${name}-victory.png`)});
   // Restart is fresh. A genuine terminal death displays the defeat UI.
   await page.getByRole('button',{name:'RUN IT AGAIN'}).click();assert.equal(await page.evaluate(()=>bloat.sim.stage),0);await page.evaluate(()=>{bloat.sim.damage(bloat.sim.player,999,'browser-fixture');bloat.consumeEvents();});await page.getByText('SEGMENTATION FAULT.',{exact:true}).waitFor();
   // Render an input-replayed encounter for visual QA and a fixed, bounded workload.
   const perf=await page.evaluate(f=>{const a=bloat;a.start(f.seed);a.screen='fixture';a.audio.ambient(false);for(const i of f.inputs.slice(0,250))a.sim.step(i);a.angles=a.sim.player.angles.slice();const samples=[];for(let i=0;i<90;i++){const t=performance.now();a.render(i/60);a.hud.draw();a.renderer.gl.finish();samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);const gl=a.renderer.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return {meanRenderMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95RenderMs:samples[Math.floor(samples.length*.95)],draws:90,viewport:[1440,900],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),gl:gl.getError()};},fixture);
   assert.equal(perf.gl,0);
   // Allow bounded extra time for CI capture; other actions retain the 20s default.
   const captureStarted=Date.now();console.log(`CAPTURE ${name} combat screenshot (timeout 60000ms)`);
   await page.screenshot({path:path.join(root,'test-results',`${name}-combat.png`),timeout:60000});
   console.log(`CAPTURED ${name} combat screenshot in ${Date.now()-captureStarted}ms`);
   assert.deepEqual(errors,[],`${name} console/resources`);assert(!requests.some(u=>/^https?:/.test(u)&&!u.startsWith(`http://127.0.0.1:${server.address().port}/`)),'No external runtime requests');
   report.push({mode:name,browser:await browser.version(),loadMs,requests:requests.length,consoleErrors:errors,replayDigest:replay.digest,performance:perf});console.log('PASS',name,JSON.stringify(report.at(-1)));await page.close();
 }
 fs.writeFileSync(path.join(root,'test-results/browser.json'),JSON.stringify(report,null,2)+'\n');
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e);process.exitCode=1;});
