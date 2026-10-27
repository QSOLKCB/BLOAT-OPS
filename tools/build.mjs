// Dependency-free standalone packer. Source ES modules are bundled as local Blob URLs.
// No transpilation, CDN, remote import or runtime package manager.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modules={},assets={};
function walk(dir,fn){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);e.isDirectory()?walk(p,fn):fn(p);}}
walk(path.join(root,'src'),p=>{if(p.endsWith('.js'))modules[path.relative(root,p).split(path.sep).join('/')]=fs.readFileSync(p,'utf8');});
walk(path.join(root,'assets'),p=>{if(!p.includes(path.sep+'source'+path.sep))assets[path.relative(path.join(root,'assets'),p).split(path.sep).join('/')]=fs.readFileSync(p).toString('base64');});
assets.LICENSE=fs.readFileSync(path.join(root,'LICENSE')).toString('base64');
const boot=`globalThis.QWAKE_ASSETS=${JSON.stringify(assets)};const modules=${JSON.stringify(modules)},urls={};function resolve(base,rel){const parts=base.split('/');parts.pop();for(const x of rel.split('/')){if(x==='..')parts.pop();else if(x!=='.')parts.push(x);}return parts.join('/');}function moduleURL(id){if(urls[id])return urls[id];if(!modules[id])throw Error('Missing bundled module '+id);const code=modules[id].replace(/from\\s+(['"])(\\.[^'"]+)\\1/g,(_,q,rel)=>'from '+q+moduleURL(resolve(id,rel))+q);return urls[id]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));}const script=document.createElement('script');script.type='module';script.src=moduleURL('src/main.js');document.body.append(script);`;
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+fs.readFileSync(path.join(root,'style.css'),'utf8')+'</style>');
html=html.replace(/<!-- BLOAT_BOOTSTRAP_START -->[\s\S]*?<!-- BLOAT_BOOTSTRAP_END -->/,'<script>'+boot.replace(/<\/script/gi,'<\\/script')+'</script>');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});fs.writeFileSync(path.join(root,'dist/BLOAT-OPS-standalone.html'),html);
console.log(`Built standalone: ${Object.keys(modules).length} modules, ${Object.keys(assets).length} embedded resources, ${Buffer.byteLength(html)} bytes`);
