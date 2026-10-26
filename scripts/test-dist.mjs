import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const port='18789',origin=`http://127.0.0.1:${port}`;
const service=spawn(process.execPath,['scripts/serve-dist.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:port},stdio:'ignore'});
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`${origin}/health`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Static distribution server did not become ready.');
 const html=await(await fetch(origin+'/')).text();
 assert.match(html,/<style>/);assert.doesNotMatch(html,/rel="stylesheet"/);
 const entry=html.match(/<script type="module"[^>]* src="\.\/(assets\/[^"]+\.js)"/);
 assert.ok(entry,'the page loads its bundled editor module');
 const worker=(await fs.readdir('dist/assets')).find(file=>/^worker-.*\.js$/.test(file));
 assert.ok(worker,'the stitch worker is bundled');
 for(const file of [`/${entry[1]}`,`/assets/${worker}`,'/fonts/neon_blinking/glyphs.json','/fonts/neon_blinking/glyphs.js','/fonts/neon_blinking/LICENSE'])assert.equal((await fetch(origin+file)).status,200,`${file} should exist inside dist`);
 for(const file of ['/server.js','/package.json','/scripts/serve-dist.mjs','/mcp','/src/app.js'])assert.equal((await fetch(origin+file)).status,404,`${file} must not fall through to project root`);
 console.log('Static dist served: embedded CSS, bundled editor and worker, and font files returned 200; root-only files and MCP returned 404.');
}finally{service.kill('SIGTERM');}
