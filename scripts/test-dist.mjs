import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port='18789',origin=`http://127.0.0.1:${port}`;
const service=spawn(process.execPath,['scripts/serve-dist.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:port},stdio:'ignore'});
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`${origin}/health`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Static distribution server did not become ready.');
 for(const file of ['/','/src/app.js','/src/worker.js','/src/engine.js','/src/readers.js','/fonts/neon_blinking/glyphs.json','/fonts/neon_blinking/glyphs.js','/fonts/neon_blinking/LICENSE'])assert.equal((await fetch(origin+file)).status,200,`${file} should exist inside dist`);
 const html=await(await fetch(origin+'/')).text();assert.match(html,/<style>/);assert.doesNotMatch(html,/rel="stylesheet" href="\/styles\.css"/);
 for(const file of ['/server.js','/package.json','/scripts/serve-dist.mjs','/mcp'])assert.equal((await fetch(origin+file)).status,404,`${file} must not fall through to project root`);
 console.log('Static dist served: embedded CSS and all runtime assets returned 200; root-only files and MCP returned 404.');
}finally{service.kill('SIGTERM');}
