import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const port='18790',origin=`http://127.0.0.1:${port}`;
const service=spawn(process.execPath,['server.js'],{env:{...process.env,HOST:'127.0.0.1',PORT:port,WELCOME_SESSION_FILE:''},stdio:'ignore'});
try{
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`${origin}/`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 if(!ready)throw Error('Self-host server did not become ready.');
 const html=await(await fetch(origin+'/')).text();
 assert.match(html,/<style>/,'the page embeds its stylesheet');
 const entry=html.match(/<script type="module"[^>]* src="\.\/(assets\/[^"]+\.js)"/);
 assert.ok(entry,'the page loads its bundled editor module');
 const worker=(await fs.readdir('dist/assets')).find(file=>/^worker-.*\.js$/.test(file));
 assert.ok(worker,'the stitch worker is bundled');
 for(const file of [`/${entry[1]}`,`/assets/${worker}`,'/fonts/neon_blinking/glyphs.json','/fonts/inkstitch/allegria20.json'])assert.equal((await fetch(origin+file)).status,200,`${file} should be served from dist`);
 for(const file of ['/server.js','/package.json','/src/app.js','/src/worker.js','/styles.css','/mcp'])assert.equal((await fetch(origin+file)).status,404,`${file} must not be served`);
 console.log('Self-host server: the built editor page, its bundle, worker and fonts returned 200; source files and MCP without a session returned 404.');
}finally{service.kill('SIGTERM');}
